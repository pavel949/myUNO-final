import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { declineServiceOrder } from '@/modules/services';
import { handleError, createPublicError } from '@/app/libs/errorHandler';
import { loadOrderForUser } from '@/app/libs/serviceOrderGuards';

/**
 * POST /api/service-orders/[id]/decline — the fulfilling provider declines the
 * job (F-PROV-3). Auto-refunds a paid order in full (module logic). Body:
 * { reason?: string }. Provider-member (of this order's provider) or admin.
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

    const { order, isProviderMember, isAdmin } = await loadOrderForUser(params.id, user);
    if (!isProviderMember && !isAdmin) {
      throw createPublicError('Access denied.', 403);
    }

    const body = await req.json().catch(() => ({}));
    const reason = typeof body.reason === 'string' ? body.reason.slice(0, 500) : undefined;

    await declineServiceOrder(prisma, order.id, order.provider_id, reason);

    return NextResponse.json({ ok: true, status: 'declined' });
  } catch (error) {
    return handleError(error);
  }
}
