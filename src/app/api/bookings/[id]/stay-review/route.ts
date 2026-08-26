import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { writeStayReview, getStayReviewEligibility } from '@/modules/booking';
import { handleError, createPublicError } from '@/app/libs/errorHandler';

/**
 * POST /api/bookings/[id]/stay-review
 *
 * Submit a stay review from a guest after their booking is completed.
 *
 * Request body:
 *   {
 *     rating: number (1-5),
 *     comment?: string (optional)
 *   }
 *
 * Response: { id: string } (review ID) or error
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

    const bookingId = params.id;
    const body = await req.json();
    const { rating, comment } = body;

    if (typeof rating !== 'number' || rating < 1 || rating > 5) {
      throw createPublicError('Rating must be 1–5', 400);
    }

    // Check eligibility
    const eligibility = await getStayReviewEligibility(prisma, bookingId, user.identityId);
    if (!eligibility.canReview) {
      throw createPublicError(eligibility.reason || 'Cannot review this stay', 403);
    }

    // Write the review
    const result = await writeStayReview(prisma, {
      bookingId,
      guestIdentityId: user.identityId,
      rating,
      comment: comment?.trim() || undefined,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
