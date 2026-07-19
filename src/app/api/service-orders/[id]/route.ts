import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { handleError, createPublicError } from '@/app/libs/errorHandler';
import { loadOrderForUser } from '@/app/libs/serviceOrderGuards';
import { serializeOrder } from '@/app/libs/serviceOrderSerializer';

/**
 * GET /api/service-orders/[id] — one order, for its orderer, a member of the
 * fulfilling provider, staff, or admin. camelCase shape; never the take rate.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw createPublicError('unauthorized', 401);
    }

    const { order } = await loadOrderForUser(params.id, user);

    return NextResponse.json({
      order: {
        ...serializeOrder(order),
        noteToProvider: order.note_to_provider,
        cancellationReason: order.cancellation_reason,
        paid: order.payments.some((p) => p.status === 'succeeded'),
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
