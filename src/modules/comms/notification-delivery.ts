import type { PrismaClient } from '@prisma/client';
import { track } from '@/modules/analytics';
import { getConfig } from '@/modules/config';
import { sendMessengerMessage, MessengerChannel } from '@/modules/integrations';
import { buildNotificationEmail, sendEmail, EmailDeliveryRetryableError } from './email.seam';

// Only rows created by the post-commit writer are eligible. Legacy pending
// deliveries may already have reached a provider and require manual reconciliation.
export const QUEUED_DELIVERY = 'queued_after_commit_v1';
const SAFE_RETRY_AGE_MS = 23 * 60 * 60 * 1000;

export async function dispatchNotificationDelivery(db: PrismaClient, id: string): Promise<'sent' | 'failed' | 'deferred' | 'skipped'> {
  try {
    return await db.$transaction(async tx => {
      const key = `notification-delivery:${id}`;
      const [lock] = await tx.$queryRaw<Array<{ acquired: boolean }>>`SELECT pg_try_advisory_xact_lock(hashtext(${key})) AS acquired`;
      if (!lock?.acquired) return 'skipped' as const;
      const delivery = await tx.notificationDelivery.findUnique({ where: { id }, include: { notification: { include: { identity: { select: { email: true, preferredLocale: true, status: true } } } } } });
      if (!delivery || delivery.status !== 'pending' || delivery.failureReason !== QUEUED_DELIVERY) return 'skipped' as const;
      const { notification, channel } = delivery;
      const identity = notification.identity;
      let sent = false;
      let failureReason = 'Delivery recipient is unavailable';
      let externalRef: string | null = null;
      if (Date.now() - delivery.createdAt.getTime() >= SAFE_RETRY_AGE_MS) {
        failureReason = 'Delivery retry window expired; manual provider reconciliation required';
      } else if (!identity || !['active', 'invited'].includes(identity.status)) {
        failureReason = 'Delivery recipient is unavailable';
      } else if (await tx.notificationPreference.findUnique({ where: { identityId_type_channel: { identityId: notification.identityId, type: notification.type, channel } } }).then(pref => pref?.muted)) {
        failureReason = 'Delivery muted by recipient';
      } else if (channel === 'email' && await getConfig(tx, 'notify.channel.email.enabled', { fresh: true }) === false) {
        failureReason = 'Email channel is disabled';
      } else if (identity?.email) {
        const { subject, body } = await buildNotificationEmail(tx as unknown as PrismaClient, { titleKey: notification.titleKey, bodyKey: notification.bodyKey, params: notification.params as Record<string, unknown>, locale: identity.preferredLocale });
        if (channel === 'email') {
          // The delivery exists in a committed transaction before any external
          // request. A crash after provider acknowledgement retries the same key.
          externalRef = await sendEmail({ to: identity.email, subject, body, idempotencyKey: `notification/${delivery.id}`, retryTransient: true });
          sent = Boolean(externalRef);
          failureReason = 'Email send failed or provider unavailable';
        } else if (channel === 'whatsapp' || channel === 'telegram') {
          const result = await sendMessengerMessage(tx as unknown as PrismaClient, channel === 'whatsapp' ? MessengerChannel.WHATSAPP : MessengerChannel.TELEGRAM, identity.email, body, undefined, false);
          sent = result.success;
          externalRef = result.messageId ?? null;
          failureReason = result.error ?? 'MESSENGER_ADAPTER_UNAVAILABLE';
        }
      }
      await tx.notificationDelivery.update({ where: { id }, data: { status: sent ? 'sent' : 'failed', sentAt: sent ? new Date() : null, externalRef: sent ? externalRef : null, failureReason: sent ? null : failureReason } });
      await track(tx as unknown as PrismaClient, sent ? 'notify_delivered' : 'notify_failed', { identityId: notification.identityId, notificationType: notification.type, channel, notificationId: notification.id });
      return sent ? 'sent' as const : 'failed' as const;
    }, { maxWait: 5000, timeout: 15000 });
  } catch (error) {
    // Pending is durable. No terminal success is recorded when the provider
    // response is ambiguous; the bounded sweep can safely retry within 23h.
    if (error instanceof EmailDeliveryRetryableError) return 'deferred';
    throw error;
  }
}

export async function flushPendingNotificationDeliveries(db: PrismaClient) {
  const rows = await db.notificationDelivery.findMany({ where: { status: 'pending', failureReason: QUEUED_DELIVERY, channel: { in: ['email', 'whatsapp', 'telegram'] } }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { id: true }, take: 20 });
  const counts = { sent: 0, failed: 0, deferred: 0, skipped: 0 };
  const started = Date.now();
  for (const row of rows) {
    if (Date.now() - started >= 20000) break;
    counts[await dispatchNotificationDelivery(db, row.id)]++;
  }
  return counts;
}
