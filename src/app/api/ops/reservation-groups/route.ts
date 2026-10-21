import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { getScopedOperationalAccess, OperatingAccessError } from '@/modules/ops/operating-space-access.service';
import { canUseReservationGuest, RESERVATION_DEPARTMENTS } from '@/modules/ops/reservation-guests.service';
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

    const group = await createReservationGroup(prisma, {
      guestIdentityId: body.guestIdentityId,
      authorizeScope: async tx => {
        const access = await getScopedOperationalAccess(tx, user.identityId, body.operatingSpaceId!, 'manage_reservations', RESERVATION_DEPARTMENTS);
        if (!await canUseReservationGuest(tx, body.guestIdentityId!, body.operatingSpaceId!, access.unitIds, access.isAdmin)) {
          throw new OperatingAccessError('Guest is outside this workspace');
        }
        return access.unitIds;
      },
      createdByIdentityId: user.identityId,
      operatingSpaceId: body.operatingSpaceId,
      title: body.title || null,
      notes: body.notes || null,
      bookingIds: Array.isArray(body.bookingIds) ? body.bookingIds : [],
    });

    return NextResponse.json({ group }, { status: 201 });
  } catch (error) {
    if (error instanceof OperatingAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Reservation group creation failed' },
      { status: 400 },
    );
  }
}
