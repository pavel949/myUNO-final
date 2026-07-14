import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { cancelBooking, computeRefundAmount, type CancellationPolicy } from '@/modules/booking';

/**
 * POST /api/bookings/[id]/cancel
 * Cancel a booking and calculate refund based on policy.
 * Requires authentication (guest or unit owner).
 *
 * Request body (optional):
 * - reason?: string
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const bookingId = params.id;
    const body = await req.json().catch(() => ({}));
    const { reason = 'guest_cancelled' } = body;

    // Fetch the booking
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { unit: true, guestIdentity: true },
    });

    if (!booking) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      );
    }

    // Authorization: guest can cancel own booking, unit owner can cancel any
    const isGuest = booking.guestIdentityId === user.identityId;
    const isUnitOwner = booking.unit?.ownerIdentityId === user.identityId;

    if (!isGuest && !isUnitOwner) {
      return NextResponse.json(
        { error: 'Not authorized to cancel this booking' },
        { status: 403 }
      );
    }

    // Check if booking is in a cancellable state
    const cancellableStatuses = ['pending_payment', 'confirmed', 'checked_in'];
    if (!cancellableStatuses.includes(booking.status)) {
      return NextResponse.json(
        { error: `Cannot cancel booking with status ${booking.status}` },
        { status: 400 }
      );
    }

    // Calculate refund amount based on policy snapshot
    let refundAmountThb = 0;
    if (booking.cancellationPolicySnapshot) {
      const policy = booking.cancellationPolicySnapshot as any as CancellationPolicy;
      const now = new Date();
      refundAmountThb = computeRefundAmount(
        booking.totalThb,
        policy.steps || [],
        booking.startDate,
        now
      );
    }

    // Cancel the booking
    const cancelled = await cancelBooking(prisma, {
      bookingId,
      cancelledByIdentityId: user.identityId,
      reason,
      refundAmountThb,
    });

    return NextResponse.json(
      {
        booking: cancelled,
        refund: {
          amountThb: refundAmountThb,
          reason,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Booking cancellation error:', message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
