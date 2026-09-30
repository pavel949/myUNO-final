import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/libs/onboardingGuard';
import { prisma } from '@/lib/prisma';

function parseCoordinate(value: unknown, min: number, max: number) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    throw new Error('Invalid coordinates');
  }
  return number;
}

export async function PATCH(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;

  try {
    const body = await req.json();
    const kind = body.kind;
    const id = String(body.id || '');
    if (!id || (kind !== 'project' && kind !== 'provider')) {
      return NextResponse.json({ error: 'Invalid map entity' }, { status: 400 });
    }

    const latitude = parseCoordinate(body.latitude, -90, 90);
    const longitude = parseCoordinate(body.longitude, -180, 180);
    const mapVisibility = body.mapVisibility !== false;
    const googlePlaceId =
      typeof body.googlePlaceId === 'string' && body.googlePlaceId.trim()
        ? body.googlePlaceId.trim()
        : null;

    if (kind === 'project') {
      if (latitude === null || longitude === null) {
        return NextResponse.json({ error: 'Project coordinates are required' }, { status: 400 });
      }
      const project = await prisma.project.update({
        where: { id },
        data: {
          latitude,
          longitude,
          mapVisibility,
          googlePlaceId,
          ...(typeof body.address === 'string' ? { address: body.address.trim() } : {}),
        },
        select: { id: true },
      });
      return NextResponse.json(project);
    }

    const provider = await prisma.provider.update({
      where: { id },
      data: {
        latitude,
        longitude,
        mapVisibility,
        googlePlaceId,
        ...(typeof body.address === 'string'
          ? { address: body.address.trim() || null }
          : {}),
      },
      select: { id: true },
    });
    return NextResponse.json(provider);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Map location update failed' },
      { status: 400 }
    );
  }
}
