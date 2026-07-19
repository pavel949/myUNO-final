import { PrismaClient } from '@prisma/client';
import { createNotification } from '@/modules/comms';

/**
 * Fan a notification out to every active member of a provider.
 * Notifications address identities; a Provider is an organization, so
 * provider-facing events (new order, cancellation) must resolve to the
 * provider's member identities. (An earlier version passed the Provider id
 * where an Identity id was required — those notifications silently failed
 * their FK and no provider ever heard about new orders.)
 *
 * Internal to the services module — not part of the index.ts interface.
 */
export async function notifyProviderMembers(
  db: PrismaClient,
  providerId: string,
  notification: {
    type: Parameters<typeof createNotification>[1]['type'];
    titleKey: string;
    bodyKey: string;
    params?: Record<string, string | number>;
  }
): Promise<void> {
  const members = await db.roleAssignment.findMany({
    where: {
      role: 'provider_member',
      providerId,
      status: 'active',
    },
    select: { identityId: true },
  });

  for (const member of members) {
    try {
      await createNotification(db, {
        identityId: member.identityId,
        type: notification.type,
        titleKey: notification.titleKey,
        bodyKey: notification.bodyKey,
        params: notification.params,
      });
    } catch (err) {
      console.error(
        `Failed to notify provider member ${member.identityId} for provider ${providerId}`,
        err
      );
    }
  }
}
