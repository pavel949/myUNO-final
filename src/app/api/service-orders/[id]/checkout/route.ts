import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { createCheckout } from '@/modules/finance';
import { handleError, createPublicError } from '@/app/libs/errorHandler';
import { loadOrderForUser } from '@/app/libs/serviceOrderGuards';

/**
 * POST /api/service-orders/[id]/checkout — the orderer opens a card checkout
 * for a placed order (payment seam; mock provider in loop one). Amount is
 * ALWAYS the order's server-stored total.
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

    if (order.status !== 'placed') {
      throw createPublicError('invalid request: order is not awaiting payment', 400);
    }
    if (order.payments.some((p) => p.status === 'succeeded')) {
      throw createPublicError('invalid request: order already paid', 400);
    }

    // Reuse an existing pending card session if one exists
    const pending = order.payments.find(
      (p) => p.status === 'pending' && p.method === 'card_provider'
    );
    if (pending) {
      return NextResponse.json({
        checkoutUrl: `/checkout/${pending.id}`,
        sessionId: pending.id,
        paymentId: pending.id,
      });
    }

    const checkout = await createCheckout(prisma, {
      purpose: 'service_order',
      serviceOrderId: order.id,
      payerIdentityId: user.identityId,
      amountThb: order.total_thb,
    });

    return NextResponse.json(checkout);
  } catch (error) {
    return handleError(error);
  }
}
