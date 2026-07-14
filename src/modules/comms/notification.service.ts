import { PrismaClient } from '@prisma/client';

export interface CreateNotificationInput {
  identityId: string;
  type: string;
  titleKey: string;
  bodyKey: string;
  params?: Record<string, string | number>;
  channels?: ('in_app' | 'email')[];
}

/**
 * Create a notification for an identity.
 * This is a best-effort operation — failures don't block the primary action.
 */
export async function createNotification(
  db: PrismaClient,
  input: CreateNotificationInput
): Promise<void> {
  const { identityId, type, titleKey, bodyKey, params = {} } = input;

  try {
    await db.notification.create({
      data: {
        identityId,
        type: type as any,
        titleKey,
        bodyKey,
        params,
      },
    });
  } catch (err) {
    // Log but don't throw — notifications are best-effort
    console.error(`Failed to create notification for ${identityId}`, err);
  }
}
