import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { acceptServiceOrder } from '@/modules/services';
import { handleError, createPublicError } from '@/app/libs/errorHandler';
import { loadOrderForUser } from '@/app/libs/serviceOrderGuards';

/**
 * POST /api/service-orders/[id]/accept — the fulfilling provider confirms the
 * job (F-PROV-3). Provider-member (of this order's provider) or admin.
 */
export async function POST(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw createPublicError('unauthorized', 401);
    }

    const { order, isProviderMember, isAdmin } = await loadOrderForUser(params.id, user);
    if (!isProviderMember && !isAdmin) {
      throw createPublicError('Access denied.', 403);
    }

    try {
      await acceptServiceOrder(prisma, order.id, order.provider_id);
    } catch (error) {
      // A wrong-state order (unpaid, already answered) is the caller's conflict, not a server fault.
      if (error instanceof Error && error.message.startsWith('Cannot ')) {
        throw createPublicError(error.message, 409);
      }
      throw error;
    }

    return NextResponse.json({ ok: true, status: 'accepted' });
  } catch (error) {
    return handleError(error);
  }
}
