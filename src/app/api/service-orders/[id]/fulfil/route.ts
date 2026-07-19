import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { fulfillServiceOrder } from '@/modules/services';
import { handleError, createPublicError } from '@/app/libs/errorHandler';
import { loadOrderForUser } from '@/app/libs/serviceOrderGuards';

/**
 * POST /api/service-orders/[id]/fulfil — the fulfilling provider marks the job
 * done (accepted → fulfilled; prompts the orderer to review, N-27).
 * Provider-member (of this order's provider) or admin.
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

    await fulfillServiceOrder(prisma, order.id, order.provider_id);

    return NextResponse.json({ ok: true, status: 'fulfilled' });
  } catch (error) {
    return handleError(error);
  }
}
