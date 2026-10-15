import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { projectExperienceAccess } from '@/app/libs/projectExperienceGuard';
import { logAudit } from '@/modules/audit';
import { projectAmenityData } from '@/modules/projects';

async function ownedAmenity(projectId: string, amenityId: string) {
  return prisma.projectAmenity.findFirst({ where: { id: amenityId, projectId } });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string; amenityId: string } }) {
  const guard = await projectExperienceAccess(params.id);
  if ('error' in guard) return guard.error;
  const current = await ownedAmenity(params.id, params.amenityId);
  if (!current) return NextResponse.json({ error: 'Amenity not found' }, { status: 404 });

  try {
    const body = await req.json();
    if (typeof body.expectedUpdatedAt !== 'string') {
      return NextResponse.json({ error: 'Reload this facility before saving; an edit version is required.' }, { status: 428 });
    }
    const expectedUpdatedAt = new Date(body.expectedUpdatedAt);
    if (Number.isNaN(expectedUpdatedAt.getTime())) {
      return NextResponse.json({ error: 'Invalid amenity edit version.' }, { status: 400 });
    }
    const conflict = () => NextResponse.json({ error: 'This facility changed since you opened it. Your input is kept; copy it, reload the page, and reconcile before saving.' }, { status: 409 });
    if (current.updatedAt.getTime() !== expectedUpdatedAt.getTime()) return conflict();
    const merged = projectAmenityData({
      name: current.name,
      slug: current.slug,
      categoryKey: current.categoryKey,
      shortDescription: current.shortDescription,
      description: current.description,
      iconKey: current.iconKey,
      locationLabel: current.locationLabel,
      accessType: current.accessType,
      accessInstructions: current.accessInstructions,
      bookingRequired: current.bookingRequired,
      bookingMode: current.bookingMode,
      bookingUrl: current.bookingUrl,
      reservationConfig: current.reservationConfig,
      pricingType: current.pricingType,
      priceBaht: current.priceThb == null ? null : current.priceThb / 100,
      capacity: current.capacity,
      minAge: current.minAge,
      openingHours: current.openingHours,
      rules: current.rules,
      terms: current.terms,
      isFeatured: current.isFeatured,
      published: current.published,
      sort: current.sort,
      ...body,
    });
    // PostgreSQL timestamps use millisecond precision here; advance even in the same clock tick.
    const nextUpdatedAt = new Date(Math.max(Date.now(), current.updatedAt.getTime() + 1));
    const amenity = await prisma.$transaction(async tx => {
      // Compare and swap also protects edits that race after the initial read.
      const updated = await tx.projectAmenity.updateMany({
        where: { id: current.id, projectId: params.id, updatedAt: expectedUpdatedAt },
        data: { ...merged, updatedAt: nextUpdatedAt },
      });
      if (updated.count !== 1) return null;
      return tx.projectAmenity.findUnique({ where: { id: current.id } });
    });
    if (!amenity) return conflict();
    await logAudit({
      actorIdentityId: guard.user.identityId,
      action: 'project_amenity:update',
      entityType: 'ProjectAmenity',
      entityId: amenity.id,
      data: {
        projectId: params.id,
        before: JSON.parse(JSON.stringify(current)),
        after: JSON.parse(JSON.stringify(amenity)),
      },
    });
    return NextResponse.json({ amenity });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not update amenity' }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; amenityId: string } }) {
  const guard = await projectExperienceAccess(params.id);
  if ('error' in guard) return guard.error;
  const current = await ownedAmenity(params.id, params.amenityId);
  if (!current) return NextResponse.json({ error: 'Amenity not found' }, { status: 404 });

  await prisma.projectAmenity.delete({ where: { id: current.id } });
  await logAudit({
    actorIdentityId: guard.user.identityId,
    action: 'project_amenity:delete',
    entityType: 'ProjectAmenity',
    entityId: current.id,
    data: { projectId: params.id, name: current.name, slug: current.slug },
  });
  return NextResponse.json({ ok: true });
}
