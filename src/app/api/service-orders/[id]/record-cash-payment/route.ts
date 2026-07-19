import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { recordCashPayment } from '@/modules/finance';
import { handleError, createPublicError } from '@/app/libs/errorHandler';
import { loadOrderForUser } from '@/app/libs/serviceOrderGuards';

/**
 * POST /api/service-orders/[id]/record-cash-payment — staff record cash for a
 * placed service order (doc 10 §1 cash-first): who took the money, when, and
 * the receipt (чек) reference. Flips the order placed → paid.
 *
 * Body: { receiptRef: string }
 * Amount is ALWAYS the order's server-stored total — never client-sent.
 * Auth: staff_ops or admin only.
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

    const { order, isStaff, isAdmin } = await loadOrderForUser(params.id, user);
    if (!isStaff && !isAdmin) {
      throw createPublicError('Access denied.', 403);
    }

    const body = await req.json().catch(() => ({}));
    const receiptRef = typeof body.receiptRef === 'string' ? body.receiptRef.trim() : '';
    if (!receiptRef) {
      throw createPublicError('invalid request: receiptRef is required', 400);
    }

    if (order.status !== 'placed') {
      throw createPublicError('invalid request: order is not awaiting payment', 400);
    }
    if (order.payments.some((p) => p.status === 'succeeded')) {
      throw createPublicError('invalid request: order already has a payment', 400);
    }

    const payment = await recordCashPayment(prisma, {
      purpose: 'service_order',
      serviceOrderId: order.id,
      payerIdentityId: order.orderer_identity_id,
      amountThb: order.total_thb,
      receivedByIdentityId: user.identityId,
      receiptRef,
    });

    return NextResponse.json({ payment: { id: payment.id, status: payment.status } });
  } catch (error) {
    return handleError(error);
  }
}
