import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { confirmServiceOrder, ServiceOrderClosureError } from '@/modules/services/service-order-closure';
import { handleError, createPublicError } from '@/app/libs/errorHandler';
import { loadOrderForUser } from '@/app/libs/serviceOrderGuards';

export async function POST(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const user = await getCurrentUser();
    if (!user) throw createPublicError('unauthorized', 401);
    const { isOrderer } = await loadOrderForUser(params.id, user);
    if (!isOrderer) throw createPublicError('Access denied.', 403);
    return NextResponse.json(await confirmServiceOrder(prisma, params.id, user.identityId));
  } catch (error) {
    if (error instanceof ServiceOrderClosureError) {
      const status = error.code === 'not_found' ? 404 : error.code === 'forbidden' ? 403 : 409;
      return handleError(createPublicError('This order cannot be confirmed. Refresh the order or contact support.', status));
    }
    return handleError(error);
  }
}
