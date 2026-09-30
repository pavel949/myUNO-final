import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/app/libs/onboardingGuard';
import { logAudit } from '@/modules/audit';
import { projectAmenityData } from '@/modules/projects';

async function ownedAmenity(projectId: string, amenityId: string) {
  return prisma.projectAmenity.findFirst({ where: { id: amenityId, projectId } });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string; amenityId: string } }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;
  const current = await ownedAmenity(params.id, params.amenityId);
  if (!current) return NextResponse.json({ error: 'Amenity not found' }, { status: 404 });

  try {
    const body = await req.json();
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
    const amenity = await prisma.projectAmenity.update({
      where: { id: current.id },
      data: merged,
    });
    await logAudit({
      actorIdentityId: guard.actorIdentityId,
      action: 'project_amenity:update',
      entityType: 'ProjectAmenity',
      entityId: amenity.id,
      data: { projectId: params.id, before: current, after: amenity },
    });
    return NextResponse.json({ amenity });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not update amenity' }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; amenityId: string } }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;
  const current = await ownedAmenity(params.id, params.amenityId);
  if (!current) return NextResponse.json({ error: 'Amenity not found' }, { status: 404 });

  await prisma.projectAmenity.delete({ where: { id: current.id } });
  await logAudit({
    actorIdentityId: guard.actorIdentityId,
    action: 'project_amenity:delete',
    entityType: 'ProjectAmenity',
    entityId: current.id,
    data: { projectId: params.id, name: current.name, slug: current.slug },
  });
  return NextResponse.json({ ok: true });
}
