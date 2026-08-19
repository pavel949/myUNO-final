import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { createNotification } from '@/modules/comms';
import { checkOutBooking } from '@/modules/booking';
import { handleError, createPublicError } from '@/app/libs/errorHandler';

/**
 * POST /api/bookings/[id]/check-out
 * Check out a stay: checked_in → checked_out (staff or the guest).
 * Notifies the owner that the unit is free for turnaround.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw createPublicError('unauthorized', 401);
    }

    const booking = await prisma.booking.findUnique({
      where: { id: params.id },
      include: { unit: { select: { name: true, ownerIdentityId: true } } },
    });

    if (!booking) {
      throw createPublicError('not found', 404);
    }

    const isGuest = booking.guestIdentityId === user.identityId;
    const isStaff = user.roles.some((role) => role.role === 'staff_ops');
    if (!isGuest && !isStaff && !user.isAdmin) {
      throw createPublicError('Access denied.', 403);
    }

    // Through the booking module rather than an inline update: the state
    // machine is the tested definition of this transition, and it also records
    // `checkedOutAt` and emits `stay_checked_out`, both of which the inline
    // version dropped.
    let updated;
    try {
      updated = await checkOutBooking(prisma, booking.id);
    } catch (error) {
      throw createPublicError(
        `invalid request: ${error instanceof Error ? error.message : 'booking is not checked in'}`,
        400
      );
    }

    if (booking.unit?.ownerIdentityId) {
      await createNotification(prisma, {
        identityId: booking.unit.ownerIdentityId,
        type: 'stay_post_stay',
        titleKey: 'notify.stay_checked_out.title',
        bodyKey: 'notify.stay_checked_out.body',
        params: { unit_name: booking.unit.name },
      });
    }

    return NextResponse.json({ booking: updated });
  } catch (error) {
    return handleError(error);
  }
}
