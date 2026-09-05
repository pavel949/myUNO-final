import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { reportProviderNoShow } from '@/modules/services';
import { handleError, createPublicError } from '@/app/libs/errorHandler';
import { loadOrderForUser } from '@/app/libs/serviceOrderGuards';

/**
 * POST /api/service-orders/[id]/no-show
 * Orderer reports provider no-show (doc 07 F-PROV-3).
 * Body: { note?: string }
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

    const { order, isOrderer } = await loadOrderForUser(params.id, user);
    if (!isOrderer) {
      throw createPublicError('Access denied.', 403);
    }

    const body = await req.json().catch(() => ({}));
    const note = typeof body.note === 'string' ? body.note.slice(0, 2000) : undefined;

    const result = await reportProviderNoShow(prisma, order.id, user.identityId, note);

    return NextResponse.json({
      ok: true,
      status: 'failed',
      ticketId: result.ticketId,
      refundThb: result.refundThb,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return handleError(createPublicError('not found', 404));
      }
      if (
        error.message.includes('Only the orderer') ||
        error.message.includes('Cannot report') ||
        error.message.includes('not started')
      ) {
        return handleError(createPublicError(`invalid request: ${error.message}`, 400));
      }
    }
    return handleError(error);
  }
}
