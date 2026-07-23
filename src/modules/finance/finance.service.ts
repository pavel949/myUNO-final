import { PrismaClient, PaymentPurpose, RefundReason } from '@prisma/client';
import { findOrCreateThread, addSystemMessage } from '@/modules/comms';
import { track } from '@/modules/analytics';

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

  // Write ledger entry for cash payment
  if (bookingId && purpose === 'stay') {
    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      select: { unitId: true, projectId: true, guestIdentityId: true },
    });

    if (booking) {
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

      // Flip booking to confirmed if it was pending_payment
      await db.booking.update({
        where: { id: bookingId },
        data: { status: 'confirmed' },
      });

      // Track analytics event
      await track(db, 'stay_payment_succeeded', {
        bookingId,
        unitId: booking.unitId,
        projectId: booking.projectId,
        identityId: booking.guestIdentityId,
        amountThb,
      });
    }
  }

  // Cash taken for a service order: placed → paid
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

  // For loop-one, use mock provider by default
  const provider = 'mock';

  const payment = await db.payment.create({
    data: {
      purpose,
      bookingId,
      serviceOrderId,
      payerIdentityId,
      method: 'card_provider',
      provider,
      amountThb,
      status: 'pending',
    },
  });

  // Generate a sessionId for tracking
  const sessionId = payment.id;

  // Mock provider returns a local checkout page
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const checkoutUrl = `${baseUrl}/checkout/${sessionId}`;

  return {
    checkoutUrl,
    sessionId,
    paymentId: payment.id,
  };
}

/**
 * Verify and confirm a payment via provider seam (idempotent).
 * Called from success return URL and webhook — whichever lands first wins.
 * For mock provider, accepts the sessionId as confirmation.
 * For real providers, verifies the session status via provider API.
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
    // Idempotent: already confirmed
    return { payment, confirmed: false };
  }

  if (payment.status !== 'pending') {
    throw new Error(
      `Cannot confirm payment with status ${payment.status}`
    );
  }

  // Update payment to succeeded
  const now = new Date();
  const confirmed = await db.payment.update({
    where: { id: sessionId },
    data: {
      status: 'succeeded',
      succeededAt: now,
    },
  });

  // Write ledger entry and flip booking status
  if (confirmed.bookingId) {
    const booking = await db.booking.findUnique({
      where: { id: confirmed.bookingId },
      select: { unitId: true, projectId: true, status: true },
    });

    if (booking && booking.status === 'pending_payment') {
      // Write rental_revenue ledger entry
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

      // Flip booking to confirmed
      await db.booking.update({
        where: { id: confirmed.bookingId },
        data: { status: 'confirmed' },
      });

      // Create thread for booking communication (best-effort)
      try {
        const fullBooking = await db.booking.findUnique({
          where: { id: confirmed.bookingId },
          select: { guestIdentityId: true },
        });

        if (fullBooking) {
          await findOrCreateThread(db, {
            contextType: 'booking',
            contextId: confirmed.bookingId,
            projectId: booking.projectId,
            participantIdentityIds: [fullBooking.guestIdentityId],
          });

          // Post system message for booking confirmation
          await addSystemMessage(
            db,
            confirmed.bookingId,
            `Booking confirmed. Payment received.`
          );
        }
      } catch (err) {
        console.error('Failed to create booking thread:', err);
      }
    }
  }

  // Card payment confirmed for a service order: placed → paid
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

  return refund;
}
