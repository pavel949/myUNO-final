import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { recordCashPayment } from '@/modules/finance';
import { notifyBookingConfirmed } from '@/app/libs/bookingConfirmed';
import { handleError, createPublicError } from '@/app/libs/errorHandler';

/**
 * POST /api/bookings/[id]/record-cash-payment
 * The loop-one primary payment rail (doc 10 §1, flow F-OPS-6): staff record
 * a cash payment against a pending booking — capturing who took the money,
 * when, and the receipt (чек) reference — which flips the booking to
 * confirmed and writes the append-only ledger revenue entry.
 *
 * Body: { receiptRef: string }
 * Amount is ALWAYS the booking's server-stored total — never client-sent.
 * Auth: staff_ops or admin only.
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

    const isStaff = user.roles.some((role) => role.role === 'staff_ops');
    if (!isStaff && !user.isAdmin) {
      throw createPublicError('Access denied.', 403);
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
        totalThb: true,
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

    if (booking.status !== 'pending_payment') {
      throw createPublicError(
        'invalid request: booking is not awaiting payment',
        400
      );
    }

    if (booking.payments.length > 0) {
      throw createPublicError('invalid request: booking already has a payment', 400);
    }

    const payment = await recordCashPayment(prisma, {
      purpose: 'stay',
      bookingId: booking.id,
      payerIdentityId: booking.guestIdentityId,
      amountThb: booking.totalThb,
      receivedByIdentityId: user.identityId,
      receiptRef,
    });

    await notifyBookingConfirmed(prisma, booking.id);

    return NextResponse.json({ payment, confirmed: true }, { status: 200 });
  } catch (error) {
    return handleError(error);
  }
}
