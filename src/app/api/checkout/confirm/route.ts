import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import * as financeService from '@/modules/finance';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { handleError, createPublicError } from '@/app/libs/errorHandler';
import { notifyBookingConfirmed } from '@/app/libs/bookingConfirmed';
import { track } from '@/modules/analytics';

/**
 * POST /api/checkout/confirm
 * Confirm a pending payment and flip booking to confirmed.
 * Mock provider always confirms; a real provider webhook (signature-verified)
 * replaces this at live-payments go-live.
 *
 * Auth: the caller must be the payer of the session (or an admin) — an
 * unauthenticated confirm would let anyone mark a booking paid.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw createPublicError('unauthorized', 401);
    }

    const { sessionId } = await req.json();

    if (!sessionId || typeof sessionId !== 'string') {
      throw createPublicError('sessionId is required', 400);
    }

    const payment = await prisma.payment.findUnique({
      where: { id: sessionId },
      select: { payerIdentityId: true, bookingId: true, amountThb: true, method: true, provider: true },
    });

    if (!payment) {
      throw createPublicError('not found', 404);
    }

    if (payment.payerIdentityId !== user.identityId && !user.isAdmin) {
      throw createPublicError('Access denied.', 403);
    }

    const result = await financeService.verifyAndConfirm(prisma, sessionId);

    // First confirmation of a stay payment → notify guest + owner, email guest
    if (result.confirmed && result.payment?.bookingId) {
      await notifyBookingConfirmed(prisma, result.payment.bookingId);
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    // Track payment failure for bookings
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
        // If tracking fails, continue with error handling
      }
    }

    return handleError(error);
  }
}
