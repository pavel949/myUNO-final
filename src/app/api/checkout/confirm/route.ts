import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import * as financeService from '@/modules/finance';
import { markPaymentFailed } from '@/modules/finance';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { handleError, createPublicError } from '@/app/libs/errorHandler';
import { notifyBookingConfirmed } from '@/app/libs/bookingConfirmed';
import { track } from '@/modules/analytics';
import { canAccessPaymentSession } from '@/app/libs/bookingAccess';

/**
 * POST /api/checkout/confirm
 *
 * **Purpose:** Confirm a pending payment and transition booking from pending_payment → confirmed.
 *
 * **Flow:**
 * 1. Guest completes payment in checkout (mock or real provider)
 * 2. Client calls this endpoint with sessionId
 * 3. This endpoint:
 *    a. Verifies the payer (guest or admin only)
 *    b. Calls financeService.verifyAndConfirm() which:
 *       - Updates payment.status = 'succeeded'
 *       - Updates booking.status = 'pending_payment' → 'confirmed'
 *       - Creates rental_revenue ledger entry (doc 10 §2)
 *       - Creates booking communication thread
 *    c. Calls notifyBookingConfirmed() which:
 *       - Sends in-app notifications to guest and owner
 *       - Sends confirmation email to guest
 *
 * **Auth:** The caller must be the payer of the session (or an admin).
 * Unauthenticated confirm would allow anyone to mark a booking paid.
 *
 * **Idempotency:** Safe to call multiple times; second call returns confirmed=false.
 * Mock provider always confirms; a real provider webhook (signature-verified)
 * replaces this at live-payments go-live (Q8).
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

    // Mock-provider unhappy path (doc 07 F-GUEST-3): card declined, booking
    // stays pending_payment and the guest retries from My trips.
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

    // **CRITICAL: Verify payment and transition booking to confirmed**
    const result = await financeService.verifyAndConfirm(prisma, sessionId);

    // **Notify stakeholders only on first confirmation**
    // Idempotent: if already confirmed, result.confirmed = false and notification is skipped
    if (result.confirmed && result.payment?.bookingId) {
      // Send in-app notifications to guest and owner, plus confirmation email to guest
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
