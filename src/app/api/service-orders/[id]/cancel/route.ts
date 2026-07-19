import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { cancelServiceOrder } from '@/modules/services';
import { handleError, createPublicError } from '@/app/libs/errorHandler';
import { loadOrderForUser } from '@/app/libs/serviceOrderGuards';

/**
 * POST /api/service-orders/[id]/cancel — the orderer (or staff/admin) cancels
 * an order (F-SVC-3). Refund eligibility is decided in the module against
 * config `service.cancel_window_hours`: full refund outside the window, none
 * inside it. Body: { reason?: string }.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw createPublicError('unauthorized', 401);
    }

    const { order, isOrderer, isStaff, isAdmin } = await loadOrderForUser(params.id, user);
    if (!isOrderer && !isStaff && !isAdmin) {
      throw createPublicError('Access denied.', 403);
    }

    if (
      order.status === 'fulfilled' ||
      order.status === 'declined' ||
      order.status === 'cancelled' ||
      order.status === 'closed'
    ) {
      throw createPublicError(
        `invalid request: cannot cancel an order in ${order.status} status`,
        400
      );
    }

    const body = await req.json().catch(() => ({}));
    const reason = typeof body.reason === 'string' ? body.reason.slice(0, 500) : undefined;

    await cancelServiceOrder(prisma, order.id, user.identityId, reason);

    return NextResponse.json({ ok: true, status: 'cancelled' });
  } catch (error) {
    return handleError(error);
  }
}
