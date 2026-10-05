import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { projectExperienceAccess } from '@/app/libs/projectExperienceGuard';
import { logAudit } from '@/modules/audit';
import { projectNearbyPlaceData } from '@/modules/projects';

function serializePlace(place: any) {
  return {
    ...place,
    latitude: place.latitude === null ? null : Number(place.latitude),
    longitude: place.longitude === null ? null : Number(place.longitude),
  };
}

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const guard = await projectExperienceAccess(params.id);
  if ('error' in guard) return guard.error;
  const project = await prisma.project.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const places = await prisma.projectNearbyPlace.findMany({
    where: { projectId: params.id },
    orderBy: [{ isFeatured: 'desc' }, { sort: 'asc' }, { name: 'asc' }],
  });
  return NextResponse.json({ places: places.map(serializePlace) });
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const guard = await projectExperienceAccess(params.id);
  if ('error' in guard) return guard.error;
  const project = await prisma.project.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  try {
    const body = await request.json();
    const place = await prisma.projectNearbyPlace.create({
      data: { ...projectNearbyPlaceData(body), projectId: params.id },
    });
    await logAudit({
      actorIdentityId: guard.user.identityId,
      action: 'project_nearby_place:create',
      entityType: 'ProjectNearbyPlace',
      entityId: place.id,
      data: { projectId: params.id, slug: place.slug, name: place.name },
    });
    return NextResponse.json({ place: serializePlace(place) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not create nearby place';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
