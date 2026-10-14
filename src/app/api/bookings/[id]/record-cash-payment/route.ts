import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { recordCashPayment } from '@/modules/finance';
import { notifyBookingConfirmed } from '@/app/libs/bookingConfirmed';
import { handleError, createPublicError } from '@/app/libs/errorHandler';
import { canRecordBookingReceipt } from '@/app/libs/bookingOperatorAccess';

/**
 * POST /api/bookings/[id]/record-cash-payment
 *
 * **Purpose:** Record an actual cash receipt. Initial payment confirms a live
 * pending_payment hold; a confirmed/in-stay balance receipt settles only the
 * server-stored remaining balance and does not change the reservation status.
 * The loop-one primary payment rail (doc 10 §1, flow F-OPS-6): staff record
 * a cash payment against a pending booking — capturing who took the money,
 * when, and the receipt (чек) reference — which flips the booking to
 * confirmed and writes the append-only ledger revenue entry.
 *
 * **Flow:**
 * 1. Staff calls this endpoint with receiptRef (e.g., check number)
 * 2. This endpoint:
 *    a. Verifies the booking is pending_payment
 *    b. Calls financeService.recordCashPayment() which:
 *       - Creates a Payment record with status='succeeded'
 *       - Updates booking.status = 'pending_payment' → 'confirmed'
 *       - Creates rental_revenue ledger entry (doc 10 §2)
 *    c. Calls notifyBookingConfirmed() which:
 *       - Sends in-app notifications to guest and owner
 *       - Sends confirmation email to guest
 *
 * Body: { receiptRef: string }
 * Amount is ALWAYS the server-stored initial total or remaining balance — never client-sent.
 * Auth: scoped staff/admin or the scoped management company member.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw createPublicError('unauthorized', 401);
    }

    const body = await req.json().catch(() => ({}));
    const receiptRef = typeof body.receiptRef === 'string' ? body.receiptRef.trim() : '';
    if (!receiptRef) {
      throw createPublicError('invalid request: receiptRef is required', 400);
    }

    const booking = await prisma.booking.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        status: true,
        projectId: true,
        unitId: true,
        totalThb: true,
        balanceDueThb: true,
        guestIdentityId: true,
        payments: {
          where: { status: 'succeeded', purpose: 'stay' },
          select: { id: true },
        },
      },
    });

    if (!booking) {
      throw createPublicError('not found', 404);
    }

    if (!(await canRecordBookingReceipt(prisma, user.identityId, booking))) {
      throw createPublicError('Access denied.', 403);
    }

    const isInitial = booking.status === 'pending_payment';
    const isBalance = ['confirmed', 'checked_in', 'checked_out'].includes(booking.status) && booking.balanceDueThb > 0;
    if (!isInitial && !isBalance) {
      throw createPublicError(
        'invalid request: booking is not awaiting payment',
        400
      );
    }

    if (isInitial && booking.payments.length > 0) {
      throw createPublicError('invalid request: booking already has a payment', 400);
    }

    const payment = await recordCashPayment(prisma, {
      purpose: isInitial ? 'stay' : 'stay_balance',
      bookingId: booking.id,
      payerIdentityId: booking.guestIdentityId,
      amountThb: isInitial ? booking.totalThb : booking.balanceDueThb,
      receivedByIdentityId: user.identityId,
      receiptRef,
      authorizeBooking: (db, scope) => canRecordBookingReceipt(db, user.identityId, scope),
    });

    if (isInitial) await notifyBookingConfirmed(prisma, booking.id).catch((error) => {
      console.error('Cash payment committed but notification failed:', error);
    });

    const currentBooking = await prisma.booking.findUniqueOrThrow({
      where: { id: booking.id }, select: { status: true },
    });
    return NextResponse.json({ payment, receiptRecorded: true,
      bookingStatus: currentBooking.status, confirmed: currentBooking.status === 'confirmed',
    }, { status: 200 });
  } catch (error) {
    if ((error as { code?: string })?.code === 'BOOKING_FORBIDDEN') return handleError(createPublicError('Access denied.', 403));
    return handleError(error);
  }
}
