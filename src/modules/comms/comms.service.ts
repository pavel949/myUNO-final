import { PrismaClient, NotificationType, NotificationChannel } from '@prisma/client';
import { sendEmail, buildNotificationEmail } from './email.seam';
import { track } from '@/modules/analytics';
import { sendMessengerMessage, MessengerChannel } from '@/modules/integrations';
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
 * For email channel: asynchronously sends via the email seam.
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

    // Fetch identity for email address
    const identity = await db.identity.findUnique({
      where: { id: identityId },
      select: { email: true, preferredLocale: true },
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
        if (!identity?.email) {
          await settle(false, 'Delivery recipient is unavailable');
          continue;
        }

        // Attempt to send via channel asynchronously (fire-and-forget)
        if (channel === 'email' && identity?.email) {
          (async () => {
            try {
              const { subject, body } = await buildNotificationEmail(db, {
                titleKey,
                bodyKey,
                params,
                locale: identity.preferredLocale,
              });

              const externalRef = await sendEmail({
                to: identity.email!,
                subject,
                body,
              });

              await settle(Boolean(externalRef), 'Email send failed or provider unavailable', externalRef ?? undefined);
            } catch (err) {
              console.error(
                `Failed to send email for delivery ${delivery.id}:`,
                err
              );
              await settle(false, err instanceof Error ? err.message : 'Unknown error').catch(() => {
                // Swallow update errors; don't fail the primary action
              });
            }
          })();
        }

        // Attempt to send via WhatsApp or Telegram (feature-flagged per doc 04 §7)
        if ((channel === 'whatsapp' || channel === 'telegram') && identity?.email) {
          const email = identity.email;
          (async () => {
            try {
              // These adapters fail closed. Provider enablement must also add
              // verified recipient bindings and actual project/unit routing;
              // an email address is not a messenger destination.
              const messengerChannel = channel === 'whatsapp' ? MessengerChannel.WHATSAPP : MessengerChannel.TELEGRAM;

              // A messenger carries the same rendered sentence the email does
              // (T-040: "template rendering from the same content keys").
              // Sending `bodyKey` raw would deliver "notify.stay_confirmed.body"
              // to the guest.
              const { body } = await buildNotificationEmail(db, {
                titleKey,
                bodyKey,
                params,
                locale: identity.preferredLocale,
              });

              const result = await sendMessengerMessage(db, messengerChannel, email, body, undefined, false);

              await settle(result.success, result.error, result.messageId);
            } catch (err) {
              console.error(
                `Failed to send ${channel} message for delivery ${delivery.id}:`,
                err
              );
              await settle(false, err instanceof Error ? err.message : 'Unknown error').catch(() => {
                // Swallow update errors; don't fail the primary action
              });
            }
          })();
        }
      } catch (err) {
        console.error(
          `Failed to create delivery for notification ${notification.id} on channel ${channel}:`,
          err
        );
      }
    }

    return notification.id;
  } catch (error) {
    console.error('Failed to create notification:', error);

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
