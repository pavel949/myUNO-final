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
export async function POST(
  _req: NextRequest,
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

    await acceptServiceOrder(prisma, order.id, order.provider_id);

    return NextResponse.json({ ok: true, status: 'accepted' });
  } catch (error) {
    return handleError(error);
  }
}
