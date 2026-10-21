import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { cancelBookingAttempt } from '@/modules/booking';
import { parseCancellationQuote } from '@/modules/booking/cancellation-quote';
import { processRequestedCardRefund } from '@/modules/finance';
import { notifyBookingCancelled } from '@/app/libs/bookingCancelled';

/**
 * POST /api/bookings/[id]/cancel
 * Cancel a booking and calculate refund based on policy.
 * Requires authentication (guest or unit owner).
 *
 * Request body:
 * - reason?: string
 * - cancellationQuote: the exact quote displayed by GET /api/bookings/[id]
 */
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
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

    // Fetch the booking (guestIdentityId lives on the row; never pull the raw identity)
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { unit: true },
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

    const cancellationQuote = parseCancellationQuote(body.cancellationQuote);
    if (!cancellationQuote) {
      return NextResponse.json({ code: 'BOOKING_CHANGED',
        error: 'Refresh the booking and confirm the displayed refund before cancelling.' }, { status: 409 });
    }

    // Bind consent to the displayed snapshot, not a fresh server read in this
    // POST. The canonical writer rechecks the version and amount under locks.
    const result = await cancelBookingAttempt(prisma, {
      bookingId,
      cancelledByIdentityId: user.identityId,
      reason,
      refundAmountThb: cancellationQuote.refundAmountSatang,
      cancellationQuote,
    });
    const cancelled = result.booking;
    const refundAmountThb = cancelled.refundAccruedThb;
    const refunds = await prisma.refund.findMany({ where: {
      payment: { bookingId }, reason: 'cancellation',
    }, select: { id: true, method: true, status: true, amountThb: true } }).catch(() => []);
    // Failure after commit must not report cancellation as failed. Requested
    // card work is durable and recoverable by the refund dispatcher.
    for (const refund of refunds) {
      if (refund.method === 'card_provider' && refund.status === 'requested') {
        await processRequestedCardRefund(prisma, refund.id).catch(() => null);
      }
    }
    const issuedRefundThb = refunds.filter(refund => (result.replayed || result.refundIds.includes(refund.id)) && ['requested', 'processing', 'succeeded'].includes(refund.status))
      .reduce((sum, refund) => sum + refund.amountThb, 0);
    const refundsCreated = result.refundIds.length;
    if (!result.replayed) await notifyBookingCancelled(prisma, bookingId, refundAmountThb).catch(() => null);

    return NextResponse.json(
      {
        booking: cancelled,
        refund: {
          amountThb: refundAmountThb,
          issuedThb: issuedRefundThb,
          pendingThb: Math.max(0, refundAmountThb - issuedRefundThb),
          recordsCreated: refundsCreated,
          reason,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    if ((error as { code?: string })?.code === 'BOOKING_CHANGED') {
      return NextResponse.json({ code: 'BOOKING_CHANGED',
        error: 'Booking changed. Review the updated payment and refund before cancelling again.' }, { status: 409 });
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Booking cancellation error:', message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
