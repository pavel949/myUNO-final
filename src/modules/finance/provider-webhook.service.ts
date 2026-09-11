import type { PrismaClient } from '@prisma/client';
import { verifyAndConfirm, markRefundFailed } from './finance.service';
import { commitRescheduleForPayment } from '@/modules/booking';

export interface OpnWebhookEvent {
  id: string;
  object: 'event';
  key: string;
  data: Record<string, unknown>;
}

interface OpnChargePayload {
  id?: string;
  paid?: boolean;
  metadata?: Record<string, unknown>;
}

interface OpnRefundPayload {
  id?: string;
  voided?: boolean;
}

async function findPaymentForCharge(db: PrismaClient, charge: OpnChargePayload) {
  if (!charge.id) return null;

  const bySession = await db.payment.findFirst({
    where: { providerSessionId: charge.id },
  });
  if (bySession) return bySession;

  const paymentId = charge.metadata?.paymentId;
  if (typeof paymentId === 'string') {
    return db.payment.findUnique({ where: { id: paymentId } });
  }

  return null;
}

/**
 * Handle a verified Opn/Omise webhook event.
 * The caller must re-fetch the event from the provider before invoking this.
 */
export async function processOpnEvent(
  db: PrismaClient,
  event: OpnWebhookEvent
): Promise<{ handled: boolean; action: string }> {
  if (event.key === 'charge.complete' || event.key === 'charge.update') {
    const charge = event.data as OpnChargePayload;
    if (!charge.id || !charge.paid) {
      return { handled: false, action: 'charge_not_paid' };
    }

    const payment = await findPaymentForCharge(db, charge);
    if (!payment) {
      return { handled: false, action: 'payment_not_found' };
    }

    if (payment.status === 'succeeded') {
      // Recovery is still attempted: a previous process may have committed the
      // provider payment and crashed before committing the linked reschedule.
      const recovered = await commitRescheduleForPayment(db, payment.id);
      return {
        handled: true,
        action: recovered ? 'already_confirmed_reschedule_committed' : 'already_confirmed',
      };
    }

    await verifyAndConfirm(db, payment.id);
    const reschedule = await commitRescheduleForPayment(db, payment.id);
    return {
      handled: true,
      action: reschedule ? 'payment_confirmed_reschedule_committed' : 'payment_confirmed',
    };
  }

  if (event.key === 'refund.create' || event.key === 'refund.update') {
    const opnRefund = event.data as OpnRefundPayload;
    if (!opnRefund.id) {
      return { handled: false, action: 'refund_missing_id' };
    }

    const refund = await db.refund.findFirst({
      where: { providerRefundId: opnRefund.id },
    });
    if (!refund) {
      return { handled: false, action: 'refund_not_found' };
    }

    if (opnRefund.voided && refund.status !== 'failed') {
      await markRefundFailed(db, refund.id, 'provider_voided');
      return { handled: true, action: 'refund_failed' };
    }

    return { handled: true, action: 'refund_acknowledged' };
  }

  return { handled: false, action: 'ignored' };
}
