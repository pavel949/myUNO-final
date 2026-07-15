import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { handleError, createPublicError } from '@/app/libs/errorHandler';
import { t } from '@/modules/content';

/** GET /api/notifications — the caller's recent notifications + unread count. */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw createPublicError('unauthorized', 401);
    }

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { identityId: user.identityId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.notification.count({
        where: { identityId: user.identityId, readAt: null },
      }),
    ]);

    const resolved = await Promise.all(
      notifications.map(async (n) => {
        const params = (n.params || {}) as Record<string, string | number>;
        let title = n.titleKey;
        let body = n.bodyKey;
        try {
          title = await t(prisma, n.titleKey, params);
          body = await t(prisma, n.bodyKey, params);
        } catch {
          // fall back to keys
        }
        return {
          id: n.id,
          type: n.type,
          title,
          body,
          readAt: n.readAt,
          createdAt: n.createdAt,
        };
      })
    );

    return NextResponse.json({ notifications: resolved, unreadCount });
  } catch (error) {
    return handleError(error);
  }
}

/** POST /api/notifications — mark read: {id} for one, {} for all. */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw createPublicError('unauthorized', 401);
    }

    const body = await req.json().catch(() => ({}));
    await prisma.notification.updateMany({
      where: {
        identityId: user.identityId,
        readAt: null,
        ...(body.id ? { id: String(body.id) } : {}),
      },
      data: { readAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleError(error);
  }
}
