import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/units/[unitId]
 * Public unit detail for the guest-facing unit page (S4).
 * Only live units are visible; returns the guest-safe subset of fields
 * (no owner identity, no engagement economics, no internal status detail).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { unitId: string } }
) {
  try {
    const unit = await prisma.unit.findUnique({
      where: { id: params.unitId },
      select: {
        id: true,
        projectId: true,
        name: true,
        unitType: true,
        bedrooms: true,
        bathrooms: true,
        maxGuests: true,
        sizeSqm: true,
        amenityKeys: true,
        baseNightlyThb: true,
        minNights: true,
        instantBook: true,
        cancellationPolicyKey: true,
        status: true,
        project: {
          select: { id: true, name: true },
        },
      },
    });

    if (!unit || unit.status !== 'live') {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    }

    const { status: _status, ...publicUnit } = unit;
    return NextResponse.json(publicUnit);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
