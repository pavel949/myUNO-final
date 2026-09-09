import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { confirmServiceOrderFulfilment } from '@/modules/services';
import { handleError, createPublicError } from '@/app/libs/errorHandler';
import { loadOrderForUser } from '@/app/libs/serviceOrderGuards';

/**
 * POST /api/service-orders/[id]/confirm
 *
 * The orderer confirms the work was done, closing the order ahead of its
 * confirm/dispute window (doc 07 F-PROV-3). Only the orderer may call it:
 * confirming waives the rest of their own window, which is not a waiver
 * staff can make on their behalf.
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

    const { order, isOrderer } = await loadOrderForUser(params.id, user);
    if (!isOrderer) {
      throw createPublicError('Access denied.', 403);
    }

    await confirmServiceOrderFulfilment(prisma, order.id, user.identityId);

    return NextResponse.json({ ok: true, status: 'closed' });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return handleError(createPublicError('not found', 404));
      }
      if (
        error.message.includes('Only the orderer') ||
        error.message.includes('Cannot confirm')
      ) {
        return handleError(createPublicError(`invalid request: ${error.message}`, 400));
      }
    }
    return handleError(error);
  }
}
