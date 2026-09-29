import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { completeBooking } from '@/modules/booking';
import { canOperateBookingAsStaff, resolveBookingAccess } from '@/app/libs/bookingAccess';
import { handleError, createPublicError } from '@/app/libs/errorHandler';

/** Staff-only operational completion after checkout.
 * Financial close is a distinct milestone in the owner statement / payout ledger.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) throw createPublicError('unauthorized', 401);

    const booking = await prisma.booking.findUnique({
      where: { id: params.id },
      select: {
        id: true, status: true, guestIdentityId: true, projectId: true, unitId: true,
        unit: { select: { ownerIdentityId: true } },
      },
    });
    if (!booking) throw createPublicError('not found', 404);

    const access = await resolveBookingAccess(user, {
      guestIdentityId: booking.guestIdentityId,
      projectId: booking.projectId,
      unitId: booking.unitId,
      ownerIdentityId: booking.unit?.ownerIdentityId,
    });
    if (!canOperateBookingAsStaff(access)) throw createPublicError('Access denied.', 403);

    if (booking.status === 'completed') {
      return NextResponse.json({ booking, completed: false });
    }
    if (booking.status !== 'checked_out') {
      throw createPublicError('Complete checkout before closing the stay.', 409);
    }

    const completed = await completeBooking(prisma, booking.id);
    return NextResponse.json({ booking: completed, completed: true });
  } catch (error) {
    return handleError(error);
  }
}
