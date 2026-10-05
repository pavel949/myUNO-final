import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { projectExperienceAccess } from '@/app/libs/projectExperienceGuard';
import { logAudit } from '@/modules/audit';
import { projectNearbyPlaceData } from '@/modules/projects';

async function ownedPlace(projectId: string, placeId: string) {
  return prisma.projectNearbyPlace.findFirst({ where: { id: placeId, projectId } });
}

function serializePlace(place: any) {
  return {
    ...place,
    latitude: place.latitude === null ? null : Number(place.latitude),
    longitude: place.longitude === null ? null : Number(place.longitude),
  };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; placeId: string } }
) {
  const guard = await projectExperienceAccess(params.id);
  if ('error' in guard) return guard.error;
  const current = await ownedPlace(params.id, params.placeId);
  if (!current) return NextResponse.json({ error: 'Nearby place not found' }, { status: 404 });

  try {
    const body = await request.json();
    const merged = projectNearbyPlaceData({
      name: current.name,
      slug: current.slug,
      categoryKey: current.categoryKey,
      shortDescription: current.shortDescription,
      address: current.address,
      latitude: current.latitude === null ? null : Number(current.latitude),
      longitude: current.longitude === null ? null : Number(current.longitude),
      distanceKm: current.distanceMeters === null ? null : current.distanceMeters / 1000,
      walkingMinutes: current.walkingMinutes,
      drivingMinutes: current.drivingMinutes,
      externalUrl: current.externalUrl,
      isFeatured: current.isFeatured,
      published: current.published,
      sort: current.sort,
      ...body,
    });
    const place = await prisma.projectNearbyPlace.update({
      where: { id: current.id },
      data: merged,
    });
    await logAudit({
      actorIdentityId: guard.user.identityId,
      action: 'project_nearby_place:update',
      entityType: 'ProjectNearbyPlace',
      entityId: place.id,
      data: {
        projectId: params.id,
        before: JSON.parse(JSON.stringify(current)),
        after: JSON.parse(JSON.stringify(place)),
      },
    });
    return NextResponse.json({ place: serializePlace(place) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not update nearby place' },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; placeId: string } }
) {
  const guard = await projectExperienceAccess(params.id);
  if ('error' in guard) return guard.error;
  const current = await ownedPlace(params.id, params.placeId);
  if (!current) return NextResponse.json({ error: 'Nearby place not found' }, { status: 404 });

  await prisma.projectNearbyPlace.delete({ where: { id: current.id } });
  await logAudit({
    actorIdentityId: guard.user.identityId,
    action: 'project_nearby_place:delete',
    entityType: 'ProjectNearbyPlace',
    entityId: current.id,
    data: { projectId: params.id, slug: current.slug, name: current.name },
  });
  return NextResponse.json({ ok: true });
}
