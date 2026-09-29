import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/libs/onboardingGuard';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

/**
 * Converts a verified intake into canonical DRAFT records. This endpoint does
 * not publish projects, units, categories or offerings and cannot bypass the
 * existing readiness, permitted-use, licensing or engagement gates.
 *
 * A row lock serializes double-clicks and concurrent admin reviews. Every
 * canonical write, ownership-period initialization and application outcome
 * is atomic; retry returns the same canonical IDs.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;

  try {
    const review = await req.json();
    if (review.verifiedAuthority !== true || review.checkedDuplicates !== true || review.checkedMedia !== true) {
      return NextResponse.json({ error: 'Confirm authority, duplicate search and media review first.' }, { status: 400 });
    }

    const converted = await prisma.$transaction(async (tx) => {
      // Lock before read; JSON requirements is the existing immutable application record.
      await tx.$queryRaw`SELECT id FROM crm_opportunity WHERE id = ${params.id}::uuid FOR UPDATE`;
      const application = await tx.crmOpportunity.findUnique({
        where: { id: params.id },
        select: { id: true, source: true, identityId: true, projectId: true, requirements: true },
      });
      if (!application || application.source !== 'myuno_property_submission_v1') throw new Error('Application not found');
      const data = application.requirements as Record<string, unknown>;
      if (data.status === 'converted') {
        return { projectId: String(data.canonicalProjectId), unitId: data.canonicalUnitId ? String(data.canonicalUnitId) : null, alreadyConverted: true };
      }
      if (data.status !== 'submitted') throw new Error('Only submitted applications can be converted.');
      const applicant = await tx.identity.findUnique({
        where: { id: application.identityId },
        select: { id: true },
      });
      if (!applicant) throw new Error('Applicant identity not found');

      const name = String(data.proposedProject || '').trim();
      const unitName = String(data.unitName || '').trim();
      const chosenProjectId = typeof review.projectId === 'string' && review.projectId ? review.projectId : application.projectId;
      const isNew = !chosenProjectId;
      let projectId = chosenProjectId;

      if (isNew) {
        const address = String(data.projectAddress || '').trim();
        const areaId = typeof data.areaId === 'string' ? data.areaId : '';
        const lat = Number(data.latitude), lng = Number(data.longitude);
        if (!name || !address || !areaId || !Number.isFinite(lat) || !Number.isFinite(lng) ||
            Math.abs(lat) > 90 || Math.abs(lng) > 180) {
          throw new Error('New complexes require name, address, canonical area and valid map coordinates.');
        }
        const area = await tx.area.findUnique({ where: { id: areaId }, select: { id: true, status: true } });
        if (!area || area.status !== 'live') throw new Error('Choose a live canonical area.');
        const duplicate = await tx.project.findFirst({
          where: { OR: [{ name: { equals: name, mode: 'insensitive' } }, { address: { equals: address, mode: 'insensitive' } }] },
          select: { id: true, name: true },
        });
        if (duplicate) throw new Error(`Possible existing complex: ${duplicate.name}. Link the application to that project instead of duplicating it.`);
        const slug = (name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'property') + '-' + application.id.slice(0, 8);
        const project = await tx.project.create({
          data: {
            slug, name, address, latitude: lat, longitude: lng, areaId, status: 'draft',
            projectType: ['resort', 'condominium', 'villa_estate', 'standalone'].includes(String(data.projectType)) ? String(data.projectType) : 'standalone',
            areaLabelKey: `project.${slug}.area`, descriptionKey: `project.${slug}.description`,
            handbookKey: `project.${slug}.handbook`,
          },
          select: { id: true },
        });
        projectId = project.id;
        const projectPhotos = Array.isArray(data.projectPhotos) ? data.projectPhotos.filter((id): id is string => typeof id === 'string') : [];
        if (projectPhotos.length) {
          const count = await tx.mediaAsset.count({ where: { id: { in: projectPhotos }, uploadedByIdentityId: applicant.id, kind: 'photo', encrypted: false } });
          if (count !== new Set(projectPhotos).size) throw new Error('Project photographs are not verified applicant media.');
          await tx.projectMedia.createMany({ data: projectPhotos.map((mediaId, sort) => ({ projectId: project.id, mediaId, sort })), skipDuplicates: true });
          await tx.project.update({ where: { id: project.id }, data: { coverMediaId: projectPhotos[0] } });
        }
      }
      if (!projectId) throw new Error('Project is required.');
      const project = await tx.project.findUnique({ where: { id: projectId }, select: { id: true, status: true } });
      if (!project || project.status === 'archived') throw new Error('Selected project cannot accept submissions.');
      const requestedOrgId = typeof review.organizationId === 'string' && review.organizationId ? review.organizationId : null;
      if (requestedOrgId) {
        if (data.kind !== 'management') throw new Error('An organization may only be linked to a management-company application.');
        const org = await tx.organization.findFirst({ where: { id: requestedOrgId, status: 'active', orgType: 'management_company', OR: [{ projectId: null }, { projectId }] }, select: { id: true } });
        if (!org) throw new Error('Management organization is not approved for this project.');
        await tx.roleAssignment.create({ data: { identityId: applicant.id, role: 'mc_member', scopeType: 'project', projectId, organizationId: org.id, status: 'active', grantedByIdentityId: guard.actorIdentityId } });
      }

      let unitId: string | null = null;
      // A complex can be registered independently of its future inventory.
      if (unitName) {
        const duplicateUnit = await tx.unit.findFirst({
          where: { projectId, name: { equals: unitName, mode: 'insensitive' } },
          select: { id: true },
        });
        if (duplicateUnit) throw new Error('An object with that name already exists in this complex. Review its ownership instead of creating another.');
        const bedrooms = Number(data.bedrooms ?? 0);
        const bathrooms = Number(data.bathrooms ?? 0);
        const maxGuests = Number(data.maxGuests ?? Math.max(1, bedrooms * 2));
        if (![bedrooms, bathrooms, maxGuests].every(Number.isSafeInteger) || bedrooms < 0 || bathrooms < 0 || maxGuests < 1) {
          throw new Error('Bedrooms, bathrooms and capacity must be valid.');
        }
        const categoryKey = 'unit_' + application.id.replace(/-/g, '').slice(0, 24);
        const category = await tx.inventoryCategory.create({
          data: { projectId, categoryKey, name: unitName + ' category', bedrooms, bathrooms, maxGuests, baseNightlyThb: 0, minNights: 1, status: 'draft' },
          select: { id: true },
        });
        const ownerIdentityId = review.verifiedOwner === true ? applicant.id : null;
        const unit = await tx.unit.create({
          data: {
            projectId, inventoryCategoryId: category.id, categoryKey,
            name: unitName, unitType: String(data.unitType) === 'villa' ? 'villa' : String(data.unitType) === 'house' ? 'townhouse' : 'condo',
            accommodationType: String(data.unitType || 'condo'),
            bedrooms, bathrooms, maxGuests,
            sizeSqm: data.sizeSqm == null ? null : Number(data.sizeSqm),
            floor: String(data.floor || '') || null, addressSupplement: unitName,
            descriptionKey: `unit.${application.id.replace(/-/g, '')}.description`,
            baseNightlyThb: 0, minNights: 1, status: 'draft', instantBook: false, ownerIdentityId,
          },
          select: { id: true },
        });
        unitId = unit.id;
        if (ownerIdentityId) {
          await tx.roleAssignment.create({ data: { identityId: ownerIdentityId, role: 'owner', scopeType: 'unit', unitId: unit.id, status: 'active', grantedByIdentityId: guard.actorIdentityId } });
          await tx.ownershipPeriod.create({
            data: { unitId, ownerIdentityId, startsOn: new Date(new Date().toISOString().slice(0, 10)), recordedByIdentityId: guard.actorIdentityId, note: 'Verified during property submission conversion' },
          });
        }
        const photos = Array.isArray(data.photos) ? data.photos.filter((id): id is string => typeof id === 'string') : [];
        if (photos.length) {
          const count = await tx.mediaAsset.count({ where: { id: { in: photos }, uploadedByIdentityId: applicant.id, kind: 'photo', encrypted: false } });
          if (count !== new Set(photos).size) throw new Error('Unit photographs are not verified applicant media.');
          await tx.unitMedia.createMany({ data: photos.map((mediaId, sort) => ({ unitId: unit.id, mediaId, sort })), skipDuplicates: true });
          await tx.unit.update({ where: { id: unit.id }, data: { coverMediaId: photos[0] } });
        }
        const offers = Array.isArray(data.offers) ? data.offers.filter((v): v is string => typeof v === 'string' && ['short_stay','monthly','yearly','sale'].includes(v)) : [];
        if (offers.length) await tx.commercialOffering.createMany({ data: offers.map(offeringType => ({ unitId: unit.id, offeringType, status: 'draft' })) });
      }

      const result = { ...data, status: 'converted', canonicalProjectId: projectId, canonicalUnitId: unitId, convertedAt: new Date().toISOString(), reviewedByIdentityId: guard.actorIdentityId };
      await tx.crmOpportunity.update({ where: { id: application.id }, data: { projectId, unitId, requirements: result as Prisma.InputJsonValue } });
      await tx.auditLog.create({
        data: { actorIdentityId: guard.actorIdentityId, action: 'property_submission:convert', entityType: 'CrmOpportunity', entityId: application.id,
          data: { projectId, unitId, applicantIdentityId: application.identityId, createdNewProject: isNew, verifiedOwner: Boolean(review.verifiedOwner), organizationId: requestedOrgId } },
      });
      return { projectId, unitId, alreadyConverted: false };
    }, { timeout: 20000 });
    return NextResponse.json(converted);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Conversion failed' }, { status: 400 });
  }
}
