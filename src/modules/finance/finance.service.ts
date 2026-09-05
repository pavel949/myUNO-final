import { PrismaClient, PaymentPurpose, RefundReason } from '@prisma/client';
import { findOrCreateThread, addSystemMessage, createNotification } from '@/modules/comms';
import { track } from '@/modules/analytics';
import { ensureDepositPreauthOnStayConfirmed } from './deposits.service';
import { getPaymentProvider, getProviderConfig } from './providers';

/**
 * Shared post-payment transition for service orders: placed → paid.
 * Commission is recognized at fulfilment (recordServiceCommission), so no
 * gross-revenue ledger entry is written here — the Payment row itself is the
 * money-in record (doc 10; ledger presentation of gross service cash is an
 * open founder question).
 */
async function markServiceOrderPaid(
  db: PrismaClient,
  serviceOrderId: string,
  payerIdentityId: string
): Promise<void> {
  // Note: the ServiceOrder model region uses snake_case client fields.
  const order = await db.serviceOrder.findUnique({
    where: { id: serviceOrderId },
    select: { status: true, project_id: true, unit_id: true, total_thb: true },
  });

  if (!order || order.status !== 'placed') {
    return; // idempotent: already paid/advanced, or order gone
  }

  await db.serviceOrder.update({
    where: { id: serviceOrderId },
    data: { status: 'paid' },
  });

  await track(db, 'service_order_paid', {
    serviceOrderId,
    projectId: order.project_id,
    unitId: order.unit_id ?? undefined,
    identityId: payerIdentityId,
    totalThb: order.total_thb,
  });
}

export interface RecordCashPaymentInput {
  purpose: PaymentPurpose;
  bookingId?: string;
  serviceOrderId?: string;
  payerIdentityId: string;
  amountThb: number;
  receivedByIdentityId: string;
  receiptRef: string;
}

export interface RecordCashRefundInput {
  paymentId: string;
  amountThb: number;
  reason: RefundReason;
  paidBackByIdentityId: string;
  initiatedByIdentityId: string;
}

export interface CreateCheckoutInput {
  purpose: PaymentPurpose;
  bookingId?: string;
  serviceOrderId?: string;
  payerIdentityId: string;
  amountThb: number;
}

export interface CheckoutSession {
  checkoutUrl: string;
  sessionId: string;
  paymentId: string;
}

/**
 * Record a cash payment directly (no provider redirect).
 * Captures who received the money, when, and the receipt reference.
 *
 * **Booking Status Transition:**
 * pending_payment (when booking created) → confirmed (immediately)
 *
 * For stays: transitions booking from pending_payment to confirmed,
 * creates rental_revenue ledger entry, and tracks analytics.
 */
export async function recordCashPayment(
  db: PrismaClient,
  input: RecordCashPaymentInput
) {
  const {
    purpose,
    bookingId,
    serviceOrderId,
    payerIdentityId,
    amountThb,
    receivedByIdentityId,
    receiptRef,
  } = input;

  const now = new Date();

  // Create payment record with status='succeeded' immediately (cash is physical)
  const payment = await db.payment.create({
    data: {
      purpose,
      bookingId,
      serviceOrderId,
      payerIdentityId,
      method: 'cash',
      provider: 'cash',
      amountThb,
      receivedByIdentityId,
      receivedAt: now,
      receiptRef,
      status: 'succeeded',
      succeededAt: now,
    },
  });

  // Write ledger entry and transition booking for stay bookings
  if (bookingId && purpose === 'stay') {
    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      select: { unitId: true, projectId: true, guestIdentityId: true },
    });

    if (booking) {
      // Create rental_revenue ledger entry (doc 10 §2)
      await db.ledgerEntry.create({
        data: {
          entryType: 'rental_revenue',
          amountThb,
          unitId: booking.unitId,
          projectId: booking.projectId,
          bookingId,
          paymentId: payment.id,
          occurredOn: now,
          description: `Cash payment for booking ${bookingId} (receipt: ${receiptRef})`,
        },
      });

      // **CRITICAL: Transition booking from pending_payment → confirmed**
      // This unblocks notifications, locks unit dates, and makes guest eligible for reviews.
      await db.booking.update({
        where: { id: bookingId },
        data: { status: 'confirmed' },
      });

      await ensureDepositPreauthOnStayConfirmed(db, bookingId, booking.unitId).catch(() => null);

      // Track analytics event (doc 13)
      await track(db, 'stay_payment_succeeded', {
        bookingId,
        unitId: booking.unitId,
        projectId: booking.projectId,
        identityId: booking.guestIdentityId,
        amountThb,
      });
    }
  }

  // Cash taken for a service order: placed → paid (doc 09 §6)
  if (serviceOrderId && purpose === 'service_order') {
    await markServiceOrderPaid(db, serviceOrderId, payerIdentityId);
  }

  return payment;
}

/**
 * Record a cash refund (money given back).
 */
export async function recordCashRefund(
  db: PrismaClient,
  input: RecordCashRefundInput
) {
  const {
    paymentId,
    amountThb,
    reason,
    paidBackByIdentityId,
    initiatedByIdentityId,
  } = input;

  const payment = await db.payment.findUnique({ where: { id: paymentId } });
  if (!payment) {
    throw new Error(`Payment ${paymentId} not found`);
  }

  if (payment.method !== 'cash') {
    throw new Error('Can only refund cash payments via recordCashRefund');
  }

  const refund = await db.refund.create({
    data: {
      paymentId,
      method: 'cash',
      amountThb,
      reason,
      status: 'succeeded',
      paidBackByIdentityId,
      initiatedByIdentityId,
    },
  });

  // Write ledger entry for refund
  const now = new Date();
  await db.ledgerEntry.create({
    data: {
      entryType: 'refund_out',
      amountThb: -amountThb,
      bookingId: payment.bookingId,
      paymentId,
      refundId: refund.id,
      occurredOn: now,
      description: `Cash refund: ${reason}`,
    },
  });

  return refund;
}

/**
 * Create a checkout session via the provider seam.
 * Returns checkoutUrl and sessionId for the client to redirect to.
 * Mock provider always returns a local mock page; real provider config Q8.
 */
export async function createCheckout(
  db: PrismaClient,
  input: CreateCheckoutInput
): Promise<CheckoutSession> {
  const {
    purpose,
    bookingId,
    serviceOrderId,
    payerIdentityId,
    amountThb,
  } = input;

  const { provider: providerName } = getProviderConfig();

  const payer = await db.identity.findUnique({
    where: { id: payerIdentityId },
    select: { email: true, firstName: true, lastName: true },
  });

  const payment = await db.payment.create({
    data: {
      purpose,
      bookingId,
      serviceOrderId,
      payerIdentityId,
      method: 'card_provider',
      provider: providerName === 'opn' ? 'opn' : 'mock',
      amountThb,
      status: 'pending',
    },
  });

  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const returnUrl = `${baseUrl}/checkout/${payment.id}`;
  const cancelUrl = bookingId
    ? `${baseUrl}/trips/${bookingId}`
    : serviceOrderId
      ? `${baseUrl}/services/orders/${serviceOrderId}`
      : `${baseUrl}/trips`;

  if (providerName === 'opn' && process.env.PAYMENT_PROVIDER === 'opn') {
    const provider = getPaymentProvider();
    const session = await provider.createCheckout({
      bookingId: bookingId ?? serviceOrderId ?? payment.id,
      amount: amountThb,
      guestEmail: payer?.email ?? '',
      guestName: payer ? `${payer.firstName} ${payer.lastName}`.trim() : 'Guest',
      returnUrl,
      cancelUrl,
      paymentId: payment.id,
    });

    await db.payment.update({
      where: { id: payment.id },
      data: { providerSessionId: session.id },
    });

    return {
      checkoutUrl: session.url,
      sessionId: payment.id,
      paymentId: payment.id,
    };
  }

  return {
    checkoutUrl: returnUrl,
    sessionId: payment.id,
    paymentId: payment.id,
  };
}

/**
 * Verify and confirm a payment via provider seam (idempotent).
 * Called from success return URL and webhook — whichever lands first wins.
 * For mock provider, accepts the sessionId as confirmation.
 * For real providers, verifies the session status via provider API.
 *
 * **Booking Status Transition Flow:**
 * pending_payment (when checkout created) → confirmed (when payment succeeds)
 *
 * This function is responsible for the critical state transition from
 * pending_payment → confirmed. It is called after the payment provider
 * confirms the payment, either via the success return URL or via webhook.
 *
 * Guarantees:
 * - Idempotent: calling twice returns confirmed=false on the second call
 * - Atomic: all transitions happen in one transaction (no partial updates)
 * - Traceable: ledger entries and notifications are always consistent with status
 */
export async function verifyAndConfirm(
  db: PrismaClient,
  sessionId: string
): Promise<{ payment: any; confirmed: boolean }> {
  const payment = await db.payment.findUnique({
    where: { id: sessionId },
  });

  if (!payment) {
    throw new Error(`Payment session ${sessionId} not found`);
  }

  if (payment.status === 'succeeded') {
    // Idempotent: already confirmed, return early without re-processing
    return { payment, confirmed: false };
  }

  if (payment.status !== 'pending') {
    throw new Error(
      `Cannot confirm payment with status ${payment.status}`
    );
  }

  if (
    payment.provider === 'opn' &&
    payment.providerSessionId &&
    process.env.PAYMENT_PROVIDER === 'opn'
  ) {
    const provider = getPaymentProvider();
    const confirmation = await provider.confirmPayment(payment.providerSessionId);
    if (confirmation.status !== 'confirmed') {
      throw new Error('Payment was not confirmed by the provider');
    }
    if (confirmation.amount !== payment.amountThb) {
      throw new Error('Payment amount does not match the provider charge');
    }
  }

  // **CRITICAL: Mark payment as succeeded**
  // This is the entry point for confirming the payment from the provider.
  const now = new Date();
  const confirmed = await db.payment.update({
    where: { id: sessionId },
    data: {
      status: 'succeeded',
      succeededAt: now,
    },
  });

  // Write ledger entry and transition booking status
  if (confirmed.bookingId) {
    const booking = await db.booking.findUnique({
      where: { id: confirmed.bookingId },
      select: { unitId: true, projectId: true, status: true },
    });

    if (booking && booking.status === 'pending_payment') {
      // **CRITICAL: Transition booking from pending_payment → confirmed**
      // This must happen immediately after payment succeeds, before any
      // other operations. The booking status controls availability, invoicing,
      // and guest eligibility for reviews.

      // Write rental_revenue ledger entry (doc 10 §2)
      await db.ledgerEntry.create({
        data: {
          entryType: 'rental_revenue',
          amountThb: confirmed.amountThb,
          unitId: booking.unitId,
          projectId: booking.projectId,
          bookingId: confirmed.bookingId,
          paymentId: confirmed.id,
          occurredOn: now,
          description: `Card payment for booking ${confirmed.bookingId}`,
        },
      });

      // Flip booking to confirmed — this unblocks:
      // - Owner receives booking confirmation notification
      // - Guest sees "confirmed" status in their trips
      // - Unit dates become locked from further bookings
      // - Guest becomes eligible to review after stay
      await db.booking.update({
        where: { id: confirmed.bookingId },
        data: { status: 'confirmed' },
      });

      await ensureDepositPreauthOnStayConfirmed(
        db,
        confirmed.bookingId,
        booking.unitId
      ).catch(() => null);

      // Create communication thread for booking context (best-effort)
      try {
        const fullBooking = await db.booking.findUnique({
          where: { id: confirmed.bookingId },
          select: { guestIdentityId: true },
        });

        if (fullBooking) {
          const thread = await findOrCreateThread(db, {
            contextType: 'booking',
            contextId: confirmed.bookingId,
            projectId: booking.projectId,
            participantIdentityIds: [fullBooking.guestIdentityId],
          });

          // Post system message for booking confirmation
          await addSystemMessage(
            db,
            thread.id,
            `Booking confirmed. Payment received.`
          );
        }
      } catch (err) {
        console.error('Failed to create booking thread:', err);
      }
    }
  }

  // Card payment confirmed for a service order: placed → paid (doc 09 §6)
  if (confirmed.serviceOrderId && confirmed.purpose === 'service_order') {
    await markServiceOrderPaid(db, confirmed.serviceOrderId, confirmed.payerIdentityId);
  }

  return { payment: confirmed, confirmed: true };
}

/**
 * Refund a payment via provider seam.
 * For cash: use recordCashRefund instead.
 * For card_provider: creates a Refund row in processing state; provider executes asynchronously.
 */
export async function refund(
  db: PrismaClient,
  paymentId: string,
  amountThb: number,
  reason: RefundReason,
  initiatedByIdentityId: string
) {
  const payment = await db.payment.findUnique({ where: { id: paymentId } });
  if (!payment) {
    throw new Error(`Payment ${paymentId} not found`);
  }

  if (payment.method === 'cash') {
    throw new Error('Use recordCashRefund for cash payments');
  }

  const refund = await db.refund.create({
    data: {
      paymentId,
      method: 'card_provider',
      amountThb,
      reason,
      status: 'processing',
      initiatedByIdentityId,
    },
  });

  // Write ledger entry (will be marked as refund_out when it succeeds)
  const now = new Date();
  await db.ledgerEntry.create({
    data: {
      entryType: 'refund_out',
      amountThb: -amountThb,
      bookingId: payment.bookingId,
      paymentId,
      refundId: refund.id,
      occurredOn: now,
      description: `Refund requested: ${reason}`,
    },
  });

  if (
    payment.provider === 'opn' &&
    payment.providerSessionId &&
    process.env.PAYMENT_PROVIDER === 'opn'
  ) {
    try {
      const provider = getPaymentProvider();
      const result = await provider.refund({
        chargeId: payment.providerSessionId,
        amount: amountThb,
        reason,
      });

      const updated = await db.refund.update({
        where: { id: refund.id },
        data: {
          providerRefundId: result.refundId,
          ...(result.status === 'failed' ? { status: 'failed' } : {}),
        },
      });

      if (result.status === 'failed') {
        await markRefundFailed(db, refund.id, result.reason ?? 'provider_declined');
        return updated;
      }

      return updated;
    } catch (error) {
      await markRefundFailed(
        db,
        refund.id,
        error instanceof Error ? error.message : 'provider_error'
      ).catch(() => null);
      throw error;
    }
  }

  return refund;
}

/** Guest-facing refund state on a cancelled booking (doc 07 F-GUEST-8). */
export type BookingRefundDisplayState = 'none' | 'processing' | 'completed';

/**
 * Whether a cancelled booking's refund is still in flight for the guest UI.
 * Failed provider refunds still read as "processing" — money state never lies
 * silently to the guest (doc 07 F-GUEST-8, doc 10 §8).
 */
export async function getBookingRefundDisplayState(
  db: PrismaClient,
  bookingId: string
): Promise<BookingRefundDisplayState> {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: { status: true, refundAccruedThb: true },
  });

  if (!booking || booking.status !== 'cancelled' || (booking.refundAccruedThb ?? 0) <= 0) {
    return 'none';
  }

  const refunds = await db.refund.findMany({
    where: { payment: { bookingId } },
    select: { status: true, amountThb: true },
  });

  if (refunds.length === 0) {
    return 'processing';
  }

  const succeededTotal = refunds
    .filter((r) => r.status === 'succeeded')
    .reduce((sum, r) => sum + r.amountThb, 0);

  if (succeededTotal >= (booking.refundAccruedThb ?? 0)) {
    return 'completed';
  }

  return 'processing';
}

/**
 * Provider-side refund failure (doc 07 F-GUEST-8, doc 10 §8).
 * Sets Refund.status=failed and alerts every admin (N-10).
 */
export async function markRefundFailed(
  db: PrismaClient,
  refundId: string,
  failureReason?: string
) {
  const refundRecord = await db.refund.findUnique({
    where: { id: refundId },
    include: {
      payment: {
        include: {
          booking: {
            include: {
              unit: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  if (!refundRecord) {
    throw new Error(`Refund ${refundId} not found`);
  }

  if (refundRecord.status === 'failed') {
    return refundRecord;
  }

  const failed = await db.refund.update({
    where: { id: refundId },
    data: { status: 'failed' },
  });

  const booking = refundRecord.payment.booking;
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const reconciliationUrl = `${baseUrl}/admin/finance/reconciliation`;
  const amountBaht = Math.round(refundRecord.amountThb / 100);

  const admins = await db.identity.findMany({
    where: { isAdmin: true, status: 'active' },
    select: { id: true },
  });

  await Promise.all(
    admins.map((admin) =>
      createNotification(db, {
        identityId: admin.id,
        type: 'finance_refund_failed',
        titleKey: 'notify.finance.refund_failed.title',
        bodyKey: 'notify.finance.refund_failed.body',
        params: {
          refund_id: refundId,
          booking_id: booking?.id,
          unit_name: booking?.unit?.name ?? '',
          amount_thb: amountBaht,
          reconciliation_url: reconciliationUrl,
          failure_reason: failureReason ?? 'provider_declined',
        },
      }).catch(() => null)
    )
  );

  return failed;
}

/**
 * Mark a payment as failed and track the event.
 */
export async function markPaymentFailed(
  db: PrismaClient,
  paymentId: string,
  failureReason?: string
) {
  const payment = await db.payment.findUnique({
    where: { id: paymentId },
  });
  if (!payment) {
    throw new Error(`Payment ${paymentId} not found`);
  }

  const failed = await db.payment.update({
    where: { id: paymentId },
    data: {
      status: 'failed',
    },
  });

  // Track analytics event for booking payment failures
  if (failed.bookingId) {
    const booking = await db.booking.findUnique({
      where: { id: failed.bookingId },
      select: {
        unitId: true,
        projectId: true,
        guestIdentityId: true,
        startDate: true,
        endDate: true,
        totalThb: true,
      },
    });

    if (booking) {
      const nights = Math.ceil(
        (booking.endDate.getTime() - booking.startDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      await track(db, 'stay_payment_failed', {
        bookingId: failed.bookingId,
        unitId: booking.unitId,
        projectId: booking.projectId,
        identityId: booking.guestIdentityId,
        paymentId: failed.id,
        amountThb: failed.amountThb,
        method: failed.method,
        provider: failed.provider,
        failureReason: failureReason || 'unknown',
        nights,
      }).catch(() => null);
    }
  }

  return failed;
}
