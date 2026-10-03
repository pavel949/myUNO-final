import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { hasOperatingSpaceCapability } from '@/modules/ops';
import { createReservationGroup } from '@/modules/booking';

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json() as {
      operatingSpaceId?: string;
      guestIdentityId?: string;
      title?: string;
      notes?: string;
      bookingIds?: string[];
    };
    if (!body.operatingSpaceId || !body.guestIdentityId) {
      return NextResponse.json({ error: 'Missing group scope or guest' }, { status: 400 });
    }

    if (!user.isAdmin) {
      const allowed = await hasOperatingSpaceCapability(
        prisma,
        body.operatingSpaceId,
        user.identityId,
        'manage_reservations',
      );
      if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const group = await createReservationGroup(prisma, {
      guestIdentityId: body.guestIdentityId,
      createdByIdentityId: user.identityId,
      operatingSpaceId: body.operatingSpaceId,
      title: body.title || null,
      notes: body.notes || null,
      bookingIds: Array.isArray(body.bookingIds) ? body.bookingIds : [],
    });

    return NextResponse.json({ group }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Reservation group creation failed' },
      { status: 400 },
    );
  }
}
