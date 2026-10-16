import { PrismaClient, NotificationType, NotificationChannel } from '@prisma/client';
import { dispatchNotificationDelivery, QUEUED_DELIVERY } from './notification-delivery';
import { track } from '@/modules/analytics';
import { getConfig } from '@/modules/config';

export interface CreateNotificationInput {
  identityId: string;
  type: NotificationType;
  titleKey: string;
  bodyKey: string;
  params?: Record<string, any>;
  channels?: NotificationChannel[];
}

/**
 * Create a notification and fan out delivery per enabled channel.
 * Best-effort: failures don't block the primary action.
 * External channels are persisted before dispatch and never sent through a
 * TransactionClient. The frequent sweep recovers committed pending deliveries.
 * For in_app channel: creates delivery row for SSE pickup.
 */
export async function createNotification(
  db: PrismaClient,
  input: CreateNotificationInput
): Promise<string | null> {
  try {
    const { identityId, type, titleKey, bodyKey, params = {}, channels = ['in_app', 'email'] } = input;

    const notification = await db.notification.create({
      data: {
        identityId,
        type,
        titleKey,
        bodyKey,
        params: params as any,
      },
    });

    // Fan out deliveries per channel (best-effort)
    for (const channel of channels) {
      try {
        // Skip messenger channels if disabled
        if (channel === 'whatsapp' || channel === 'telegram') {
          const enabledKey = channel === 'whatsapp' ? 'notify.channel.whatsapp.enabled' : 'notify.channel.telegram.enabled';
          const isEnabled = await getConfig(db, enabledKey);
          if (!isEnabled) {
            continue; // Skip creating delivery if channel disabled
          }
        }

        const delivery = await db.notificationDelivery.create({
          data: {
            notificationId: notification.id,
            channel,
            status: 'pending',
            failureReason: channel === 'in_app' ? null : QUEUED_DELIVERY,
          },
        });

        const settle = async (sent: boolean, failureReason?: string, externalRef?: string) => {
          await db.notificationDelivery.update({
            where: { id: delivery.id },
            data: {
              status: sent ? 'sent' : 'failed',
              sentAt: sent ? new Date() : null,
              failureReason: sent ? null : failureReason || 'Delivery unavailable',
              externalRef: sent ? externalRef ?? null : null,
            },
          });
          await track(db, sent ? 'notify_delivered' : 'notify_failed', {
            identityId, notificationType: type, channel, notificationId: notification.id,
          }).catch(() => null);
        };

        if (channel === 'in_app') {
          // The persisted notification is now available to the inbox/SSE.
          await settle(true);
          continue;
        }
        // TransactionClient intentionally omits $transaction. Never let an
        // external send escape before its parent transaction has committed.
        // Root-client calls may dispatch now; transaction writes are picked up
        // by the frequent durable outbox sweep after commit.
        if (typeof db.$transaction === 'function') await dispatchNotificationDelivery(db, delivery.id);

      } catch {
        console.error(
          `Notification delivery could not be completed on channel ${channel}; durable pending rows will be retried.`
        );
      }
    }

    return notification.id;
  } catch {
    console.error('Notification could not be persisted; inspect database health.');

    // Track notification failure
    await track(db, 'notify_failed', {
      identityId: input.identityId,
      notificationType: input.type,
    }).catch(() => null);

    return null;
  }
}

/**
 * Mark a notification as read.
 */
export async function markNotificationRead(
  db: PrismaClient,
  notificationId: string
) {
  return db.notification.update({
    where: { id: notificationId },
    data: { readAt: new Date() },
  });
}

/**
 * Get unread notifications for an identity.
 */
export async function getUnreadNotifications(
  db: PrismaClient,
  identityId: string,
  limit: number = 20
) {
  return db.notification.findMany({
    where: {
      identityId,
      readAt: null,
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { deliveries: true },
  });
}

/**
 * Get recent notifications (read and unread).
 */
export async function getRecentNotifications(
  db: PrismaClient,
  identityId: string,
  limit: number = 50
) {
  return db.notification.findMany({
    where: { identityId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { deliveries: true },
  });
}

/**
 * Check if a type is muted for an identity on a given channel.
 */
export async function isNotificationMuted(
  db: PrismaClient,
  identityId: string,
  type: NotificationType,
  channel: NotificationChannel
): Promise<boolean> {
  const pref = await db.notificationPreference.findUnique({
    where: {
      identityId_type_channel: {
        identityId,
        type,
        channel,
      },
    },
  });
  return pref?.muted ?? false;
}

/**
 * Set mute preference for a type on a channel.
 */
export async function setNotificationMute(
  db: PrismaClient,
  identityId: string,
  type: NotificationType,
  channel: NotificationChannel,
  muted: boolean
) {
  return db.notificationPreference.upsert({
    where: {
      identityId_type_channel: {
        identityId,
        type,
        channel,
      },
    },
    update: { muted },
    create: { identityId, type, channel, muted },
  });
}
