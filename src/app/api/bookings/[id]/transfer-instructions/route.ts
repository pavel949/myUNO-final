import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { getTransferInstructions } from '@/modules/finance';
import { outstandingStayBalanceSatang } from '@/modules/booking/outstanding-balance';
import { canViewTransferInstructions, resolveBookingAccess } from '@/app/libs/bookingAccess';

/**
 * Where to send the money for this booking.
 *
 * Scoped to the payer and to staff. Company bank details are not a secret, but
 * they are not something to serve to anyone who guesses a booking id either —
 * an account number and a matching amount is most of what an invoice-fraud
 * email needs.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const booking = await prisma.booking.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      unitId: true,
      projectId: true,
      guestIdentityId: true,
      totalThb: true,
      receivableStatus: true, balanceDueThb: true,
      status: true,
      holdExpiresAt: true,
    },
  });
  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

  const access = await resolveBookingAccess(user, {
    guestIdentityId: booking.guestIdentityId,
    projectId: booking.projectId,
    unitId: booking.unitId,
  });
  if (!canViewTransferInstructions(access)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (booking.receivableStatus !== 'collectible') {
    return NextResponse.json({ code: 'BOOKING_RECEIVABLE_RECONCILIATION_REQUIRED',
      error: 'The source payment and guest balance need reconciliation before collecting money.' }, { status: 409 });
  }

  // A request has not been accepted, and terminal/expired reservations must
  // never invite a guest to send money. Confirmed unpaid balances remain
  // collectable in exactly the states supported by canonical receipt writers.
  const liveInitialHold = booking.status === 'pending_payment' &&
    (!booking.holdExpiresAt || booking.holdExpiresAt > new Date());
  const collectableBalance = ['confirmed', 'checked_in', 'checked_out'].includes(booking.status) &&
    booking.balanceDueThb > 0;
  if (!liveInitialHold && !collectableBalance) {
    return NextResponse.json({ error: 'This booking is not awaiting payment' }, { status: 409 });
  }

  // Initial payment is all-or-nothing. An unexpected captured payment on a
  // still-pending stay needs reconciliation, never a second payment invitation.
  if (booking.status === 'pending_payment' && await prisma.payment.count({
    where: { bookingId: booking.id, status: 'succeeded' },
  })) {
    return NextResponse.json({
      code: 'PAYMENT_RECONCILIATION_REQUIRED',
      error: 'A payment is already recorded and needs review. Contact the property before sending another transfer.',
    }, { status: 409 });
  }
  // The canonical total already includes date changes/extensions. Confirmed
  // stay_balance receipts settle balanceDueThb directly; adding it again to
  // totalThb would double-count the debt (including a confirmed unpaid stay).
  const outstanding = outstandingStayBalanceSatang(booking);

  if (outstanding <= 0) {
    return NextResponse.json({ error: 'Nothing is outstanding on this booking' }, { status: 409 });
  }

  try {
    const instructions = await getTransferInstructions(prisma, {
      bookingId: booking.id,
      amountThb: outstanding,
      projectId: booking.projectId,
    });

    // The dates are only held until holdExpiresAt, so the transfer deadline
    // shown to the guest can never run past it.
    const deadline = booking.status === 'pending_payment' && booking.holdExpiresAt && booking.holdExpiresAt < instructions.expiresAt
      ? booking.holdExpiresAt
      : instructions.expiresAt;
    return NextResponse.json({
      ...instructions,
      expiresAt: deadline.toISOString(),
    });
  } catch (error) {
    const code = (error as { code?: string }).code;
    return NextResponse.json(
      { error: (error as Error).message },
      { status: code === 'TRANSFER_DISABLED' ? 409 : code === 'MERCHANT_NOT_CONFIGURED' ? 503 : 400 }
    );
  }
}


