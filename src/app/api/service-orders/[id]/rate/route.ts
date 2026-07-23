import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { rateServiceOrder } from '@/modules/services';
import { handleError, createPublicError } from '@/app/libs/errorHandler';

/**
 * POST /api/service-orders/[id]/rate — guest/orderer rates a fulfilled service order.
 * Body: { rating: 1-5, comment?: string }
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

    const body = await req.json();
    const { rating, comment } = body;

    if (!rating || rating < 1 || rating > 5) {
      throw createPublicError('Rating must be 1-5', 400);
    }

    const review = await rateServiceOrder(
      prisma,
      params.id,
      user.identityId,
      rating,
      comment
    );

    return NextResponse.json({ ok: true, reviewId: review.id });
  } catch (error) {
    return handleError(error);
  }
}
