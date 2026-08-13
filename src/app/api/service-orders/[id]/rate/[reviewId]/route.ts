import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { replyToReview } from '@/modules/services';
import { handleError, createPublicError } from '@/app/libs/errorHandler';
import { track } from '@/modules/analytics';

/**
 * POST /api/service-orders/[id]/rate/[reviewId] — provider/operator replies to a review.
 * Body: { reply: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; reviewId: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw createPublicError('unauthorized', 401);
    }

    const body = await req.json();
    const { reply } = body;

    if (!reply || reply.trim().length === 0) {
      throw createPublicError('Reply cannot be empty', 400);
    }

    const result = await replyToReview(
      prisma,
      params.reviewId,
      user.identityId,
      reply
    );

    // Track review reply
    await track(prisma, 'review_replied', {
      identityId: user.identityId,
      serviceOrderId: params.id,
    }).catch(() => null);

    return NextResponse.json({ ok: true, reviewId: result.id });
  } catch (error) {
    return handleError(error);
  }
}
