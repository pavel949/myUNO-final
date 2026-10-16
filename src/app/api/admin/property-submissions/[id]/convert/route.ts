import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/libs/onboardingGuard';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { EmployeeCreationError } from '@/modules/onboarding/employee-creation.schema';
import { employeeCreationForConversionTx, employeeCreationFailure } from '@/modules/onboarding/employee-creation.service';
import { setUnitOwnerTx } from '@/modules/projects';
import { createDraftUnitEngagementTx } from '@/modules/core';
import { createSubmissionDescriptionTx, resolveSubmissionDescription, SubmissionDescriptionError } from '@/modules/onboarding/submission-description';
import {
  ensureDraftCommercialOfferingsTx,
  resolveCanonicalUnitTx,
  deriveUnitOnboardingState,
} from '@/modules/onboarding';

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
      await tx.$queryRaw`SELECT id FROM crm_opportunity WHERE id = ${params.id} FOR UPDATE`;
      const application = await tx.crmOpportunity.findUnique({
        where: { id: params.id },
        select: { id: true, source: true, identityId: true, projectId: true, unitId: true, requirements: true },
      });
      if (!application || application.source !== 'myuno_property_submission_v1') throw new EmployeeCreationError(400, 'Application not found');
      const data = application.requirements as Record<string, unknown>;
      const employee = await employeeCreationForConversionTx(tx, application, guard.actorIdentityId, review);
      if (data.status === 'converted') {
        if (employee && application.unitId) {
          const bound = await tx.unit.findFirst({ where: { id: application.unitId, projectId: application.projectId! }, select: { id: true } });
          if (!bound) throw new EmployeeCreationError(400, 'Converted property scope changed.');
        }
        return { projectId: String(data.canonicalProjectId), unitId: data.canonicalUnitId ? String(data.canonicalUnitId) : null, alreadyConverted: true,
          ...(employee ? { createdProjectId: employee.createdProjectId, createdUnitId: employee.createdUnitId, matchedExisting: !employee.createdProjectId && !employee.createdUnitId } : {}) };
      }
      if (data.status !== 'submitted') throw new EmployeeCreationError(400, 'Only submitted applications can be converted.');
      const description = resolveSubmissionDescription(data, review.descriptionLocale);
      const applicant = await tx.identity.findUnique({
        where: { id: application.identityId },
        select: { id: true },
      });
      if (!applicant) throw new EmployeeCreationError(400, 'Applicant identity not found');

      const name = String(data.proposedProject || '').trim();
      const unitName = String(data.unitName || '').trim();
      const chosenProjectId = typeof review.projectId === 'string' && review.projectId ? review.projectId : application.projectId;
      const isNew = !chosenProjectId;
      let projectId = chosenProjectId;

      if (isNew) {
        const address = String(review.projectAddress || data.projectAddress || '').trim();
        const areaId = typeof review.areaId === 'string' && review.areaId ? review.areaId : typeof data.areaId === 'string' ? data.areaId : '';
        const latitudeInput = review.latitude ?? data.latitude;
        const longitudeInput = review.longitude ?? data.longitude;
        const lat = latitudeInput == null || latitudeInput === '' ? NaN : Number(latitudeInput);
        const lng = longitudeInput == null || longitudeInput === '' ? NaN : Number(longitudeInput);
        if (!name || !address || !areaId || !Number.isFinite(lat) || !Number.isFinite(lng) ||
            Math.abs(lat) > 90 || Math.abs(lng) > 180) {
          throw new EmployeeCreationError(400, 'New complexes require name, address, canonical area and valid map coordinates.');
        }
        const area = await tx.area.findUnique({ where: { id: areaId }, select: { id: true, status: true } });
        if (!area || area.status !== 'live') throw new EmployeeCreationError(400, 'Choose a live canonical area.');
        // Name OR address duplicates serialize across different applications and
        // both owner and employee flows. Separate sorted keys match the OR.
        for (const key of [`project-name:${name.normalize('NFKC').toLowerCase()}`, `project-address:${address.normalize('NFKC').toLowerCase()}`].sort()) {
          await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text`;
        }
        const duplicate = await tx.project.findFirst({
          where: { OR: [{ name: { equals: name, mode: 'insensitive' } }, { address: { equals: address, mode: 'insensitive' } }] },
          select: { id: true, name: true },
        });
        if (duplicate) throw new EmployeeCreationError(400, `Possible existing complex: ${duplicate.name}. Link the application to that project instead of duplicating it.`);
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
        // A complex-only application describes the project. A home application
        // describes its Unit, even when it also proposes a new complex.
        if (!unitName && description) {
          await createSubmissionDescriptionTx(tx, {
            key: `project.${slug}.description`, namespace: 'project',
            ...description, actorIdentityId: guard.actorIdentityId,
          });
        }
        const projectPhotos = Array.isArray(data.projectPhotos) ? data.projectPhotos.filter((id): id is string => typeof id === 'string') : [];
        if (projectPhotos.length) {
          const count = await tx.mediaAsset.count({ where: { id: { in: projectPhotos }, uploadedByIdentityId: applicant.id, kind: 'photo', encrypted: false } });
          if (count !== new Set(projectPhotos).size) throw new EmployeeCreationError(400, 'Project photographs are not verified applicant media.');
          await tx.projectMedia.createMany({ data: projectPhotos.map((mediaId, sort) => ({ projectId: project.id, mediaId, sort })), skipDuplicates: true });
          await tx.project.update({ where: { id: project.id }, data: { coverMediaId: projectPhotos[0] } });
        }
      }
      if (!projectId) throw new EmployeeCreationError(400, 'Project is required.');
      const project = await tx.project.findUnique({ where: { id: projectId }, select: { id: true, status: true } });
      if (!project || project.status === 'archived') throw new EmployeeCreationError(400, 'Selected project cannot accept submissions.');
      const requestedOrgId = typeof review.organizationId === 'string' && review.organizationId ? review.organizationId : null;
      const operatingModel = ['owner_direct', 'via_management_company', 'direct_managed'].includes(String(data.operatingModel))
        ? String(data.operatingModel)
        : null;
      if (operatingModel === 'via_management_company') {
        if (!requestedOrgId) throw new EmployeeCreationError(400, 'Choose the verified management company before conversion.');
        const org = await tx.organization.findFirst({
          where: {
            id: requestedOrgId,
            status: 'active',
            orgType: 'management_company',
            OR: [{ projectId: null }, { projectId }],
          },
          select: { id: true },
        });
        if (!org) throw new EmployeeCreationError(400, 'Management organization is not approved for this project.');
      }

      let unitId: string | null = null;
      let createdUnitId: string | null = null;
      if (unitName) {
        const existingUnitId = employee && Object.prototype.hasOwnProperty.call(review, 'existingUnitId')
          ? typeof review.existingUnitId === 'string' && review.existingUnitId ? review.existingUnitId : null
          : typeof data.existingUnitId === 'string' && data.existingUnitId ? data.existingUnitId : null;
        const resolved = await resolveCanonicalUnitTx(tx, { projectId, existingUnitId, unitName });
        if (resolved.duplicateCandidateId && !existingUnitId) {
          throw new EmployeeCreationError(409, 'Possible existing property found. Select the existing Unit instead of creating another.');
        }

        if (resolved.unitId) {
          unitId = resolved.unitId;
        } else {
          const bedrooms = Number(data.bedrooms ?? 0);
          const bathrooms = Number(data.bathrooms ?? 0);
          const maxGuests = Number(data.maxGuests ?? Math.max(1, bedrooms * 2));
          if (![bedrooms, bathrooms, maxGuests].every(Number.isSafeInteger) || bedrooms < 0 || bathrooms < 0 || maxGuests < 1) {
            throw new EmployeeCreationError(400, 'Bedrooms, bathrooms and capacity must be valid.');
          }

          const proposedNightlyBaht = data.proposedNightlyBaht == null ? 0 : Number(data.proposedNightlyBaht);
          const proposedMinNights = data.proposedMinNights == null ? 1 : Number(data.proposedMinNights);
          if (!Number.isSafeInteger(proposedNightlyBaht) || proposedNightlyBaht < 0 || proposedNightlyBaht > 10000000 || !Number.isSafeInteger(proposedMinNights) || proposedMinNights < 1 || proposedMinNights > 365) throw new EmployeeCreationError(400, 'Invalid proposed rental terms.');
          const unit = await tx.unit.create({
            data: {
              projectId,
              inventoryCategoryId: null,
              categoryKey: null,
              name: unitName,
              unitType: String(data.unitType) === 'villa' ? 'villa' : String(data.unitType) === 'house' ? 'townhouse' : 'condo',
              accommodationType: String(data.unitType || 'condo'),
              bedrooms,
              bathrooms,
              maxGuests,
              sizeSqm: data.sizeSqm == null ? null : Number(data.sizeSqm),
              floor: String(data.floor || '') || null,
              addressSupplement: unitName,
              descriptionKey: `unit.${application.id.replace(/-/g, '')}.description`,
              baseNightlyThb: proposedNightlyBaht * 100,
              minNights: proposedMinNights,
              status: 'draft',
              instantBook: false,
            },
            select: { id: true },
          });
          unitId = unit.id;
          createdUnitId = unit.id;
          if (description) {
            await createSubmissionDescriptionTx(tx, {
              key: `unit.${application.id.replace(/-/g, '')}.description`, namespace: 'unit',
              ...description, actorIdentityId: guard.actorIdentityId,
            });
          }
        }

        const ownerIdentityId = !employee && review.verifiedOwner === true ? applicant.id : null;
        if (ownerIdentityId) {
          await setUnitOwnerTx(tx, {
            unitId,
            ownerIdentityId,
            recordedByIdentityId: guard.actorIdentityId,
            note: 'Verified during property submission conversion',
          });
        }

        const canonicalUnitId = unitId;
        const photos = Array.isArray(data.photos) ? data.photos.filter((id): id is string => typeof id === 'string') : [];
        if (photos.length && (!employee || createdUnitId !== null)) {
          const count = await tx.mediaAsset.count({
            where: { id: { in: photos }, uploadedByIdentityId: applicant.id, kind: 'photo', encrypted: false },
          });
          if (count !== new Set(photos).size) throw new EmployeeCreationError(400, 'Unit photographs are not verified applicant media.');
          await tx.unitMedia.createMany({
            data: photos.map((mediaId, sort) => ({ unitId: canonicalUnitId, mediaId, sort })),
            skipDuplicates: true,
          });
          const unit = await tx.unit.findUnique({ where: { id: unitId }, select: { coverMediaId: true } });
          if (!unit?.coverMediaId) {
            await tx.unit.update({ where: { id: unitId }, data: { coverMediaId: photos[0] } });
          }
        }

        if (!employee) await ensureDraftCommercialOfferingsTx(tx, unitId, data.offers);

        if (ownerIdentityId && operatingModel) {
          const existingDraft = await tx.unitEngagement.findFirst({
            where: { unitId, status: 'draft', engagementType: operatingModel as 'owner_direct' | 'via_management_company' | 'direct_managed' },
            select: { id: true },
          });
          if (!existingDraft) {
            await createDraftUnitEngagementTx(tx, {
              unitId,
              ownerIdentityId,
              engagementType: operatingModel as 'owner_direct' | 'via_management_company' | 'direct_managed',
              managementOrgId: operatingModel === 'via_management_company' ? requestedOrgId ?? undefined : undefined,
            });
          }
        }
      }

      const readiness = unitId
        ? await deriveUnitOnboardingState(tx, unitId)
        : { state: 'draft' as const, blockers: [] as string[] };
      const result = {
        ...data,
        status: 'converted',
        ...(description ? { descriptionLocale: description.locale } : {}),
        canonicalProjectId: projectId,
        canonicalUnitId: unitId,
        onboardingState: readiness.state,
        onboardingBlockers: readiness.blockers,
        convertedAt: new Date().toISOString(),
        reviewedByIdentityId: guard.actorIdentityId,
        ...(employee ? { employeeCreation: { ...employee, createdProjectId: isNew ? projectId : null, createdUnitId } } : {}),
      };
      await tx.crmOpportunity.update({ where: { id: application.id }, data: { projectId, unitId, requirements: result as Prisma.InputJsonValue } });
      await tx.auditLog.create({
        data: { actorIdentityId: guard.actorIdentityId, action: 'property_submission:convert', entityType: 'CrmOpportunity', entityId: application.id,
          data: { projectId, unitId, applicantIdentityId: application.identityId, createdNewProject: isNew, verifiedOwner: !employee && Boolean(review.verifiedOwner), organizationId: employee?.organizationId ?? requestedOrgId, employeeCreation: Boolean(employee), createdUnitId } },
      });
      return { projectId, unitId, alreadyConverted: false,
        ...(employee ? { createdProjectId: isNew ? projectId : null, createdUnitId, matchedExisting: !isNew && !createdUnitId } : {}) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20000 });
    return NextResponse.json(converted);
  } catch (error) {
    if (error instanceof SubmissionDescriptionError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    const failure = employeeCreationFailure(error);
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
}
