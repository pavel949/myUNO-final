import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import * as financeService from '@/modules/finance';
import { markPaymentFailed } from '@/modules/finance';
import { commitRescheduleForPayment } from '@/modules/booking';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { handleError, createPublicError } from '@/app/libs/errorHandler';
import { notifyBookingConfirmed } from '@/app/libs/bookingConfirmed';
import { track } from '@/modules/analytics';
import { canAccessPaymentSession } from '@/app/libs/bookingAccess';

/**
 * POST /api/checkout/confirm
 *
 * Confirms a pending payment. For an initial stay payment this transitions the
 * booking to confirmed. For an AT09 reschedule balance it commits the already
 * held replacement interval only after the payment is confirmed.
 */
export async function POST(req: NextRequest) {
  let sessionId: string | null = null;

  try {
    const user = await getCurrentUser();
    if (!user) {
      throw createPublicError('unauthorized', 401);
    }

    const body = await req.json();
    sessionId = body.sessionId;

    if (!sessionId || typeof sessionId !== 'string') {
      throw createPublicError('sessionId is required', 400);
    }

    if (body.simulateDecline === true) {
      await markPaymentFailed(prisma, sessionId, 'card_declined');
      throw createPublicError(
        'Your card was declined. Nothing was charged — complete payment from My trips before your hold expires.',
        400
      );
    }

    const payment = await prisma.payment.findUnique({
      where: { id: sessionId },
      select: { payerIdentityId: true, bookingId: true, amountThb: true, method: true, provider: true },
    });

    if (!payment) {
      throw createPublicError('not found', 404);
    }

    if (!canAccessPaymentSession(user, payment.payerIdentityId)) {
      throw createPublicError('Access denied.', 403);
    }

    const result = await financeService.verifyAndConfirm(prisma, sessionId);

    // AT09: the payment record is the durable link between a funded date-change
    // request and the provider confirmation. This seam is idempotent: if there
    // is no open reschedule, or it has already committed, it is a no-op.
    const committedReschedule = await commitRescheduleForPayment(prisma, sessionId);

    if (result.confirmed && result.payment?.bookingId && !committedReschedule) {
      await notifyBookingConfirmed(prisma, result.payment.bookingId);
    }

    return NextResponse.json({ ...result, reschedule: committedReschedule }, { status: 200 });
  } catch (error) {
    if (error instanceof Error && typeof sessionId === 'string') {
      try {
        const paymentData = await prisma.payment.findUnique({
          where: { id: sessionId },
          select: {
            bookingId: true,
            amountThb: true,
            method: true,
            provider: true,
          },
        });

        if (paymentData?.bookingId) {
          const booking = await prisma.booking.findUnique({
            where: { id: paymentData.bookingId },
            select: {
              id: true,
              unitId: true,
              projectId: true,
              guestIdentityId: true,
            },
          });

          if (booking) {
            await track(prisma, 'stay_payment_failed', {
              bookingId: booking.id,
              unitId: booking.unitId,
              projectId: booking.projectId,
              identityId: booking.guestIdentityId,
              amountThb: paymentData.amountThb,
              method: paymentData.method,
              provider: paymentData.provider,
              failureReason: error.message,
            }).catch(() => null);
          }
        }
      } catch {
        // Payment failure tracking is best-effort and must not mask the caller's error.
      }
    }

    return handleError(error);
  }
}
