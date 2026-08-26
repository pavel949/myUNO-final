import { PrismaClient } from '@prisma/client';

/**
 * Guest reviewing a stay — the input-side of the rating system.
 *
 * A guest reviews the **booking**, not the unit — that is what makes one
 * guest's review of one stay, rather than a running opinion of the property.
 * So a villa's rating is assembled by going back through its bookings.
 *
 * Built on the existing polymorphic `Review` model with target_type='stay'.
 */

/** Stays that are over and reviewable. */
const REVIEWABLE_STATUSES = ['checked_out', 'completed'] as const;

export interface WriteStayReviewInput {
  bookingId: string;
  guestIdentityId: string;
  rating: number;
  comment?: string;
}

/**
 * Whether this guest may review this stay, and why not.
 *
 * A guest may review their own completed stay, once, with a rating 1–5
 * and optional comment. The stay must be checked out or completed.
 */
async function canReviewStay(
  db: PrismaClient,
  bookingId: string,
  guestIdentityId: string
): Promise<{ allowed: boolean; reason?: string }> {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      status: true,
      guestIdentityId: true,
      endDate: true,
    },
  });

  if (!booking) {
    return { allowed: false, reason: 'Booking not found' };
  }

  if (booking.guestIdentityId !== guestIdentityId) {
    return { allowed: false, reason: 'You did not take this stay' };
  }

  if (!REVIEWABLE_STATUSES.includes(booking.status as (typeof REVIEWABLE_STATUSES)[number])) {
    return { allowed: false, reason: 'The stay is not over yet' };
  }

  return { allowed: true };
}

/**
 * Whether this guest may write a stay review for this booking, and why not.
 * Includes check for existing review.
 */
export async function getStayReviewEligibility(
  db: PrismaClient,
  bookingId: string,
  guestIdentityId: string
): Promise<{ canReview: boolean; reason?: string }> {
  const check = await canReviewStay(db, bookingId, guestIdentityId);
  if (!check.allowed) {
    return { canReview: false, reason: check.reason };
  }

  const existing = await db.review.findFirst({
    where: {
      target_type: 'stay',
      target_id: bookingId,
      author_identity_id: guestIdentityId,
    },
  });

  if (existing) {
    return { canReview: false, reason: 'You have already reviewed this stay' };
  }

  return { canReview: true };
}

/**
 * Create a stay review from a guest.
 * Validates eligibility before writing.
 */
export async function writeStayReview(
  db: PrismaClient,
  input: WriteStayReviewInput
): Promise<{ id: string }> {
  if (input.rating < 1 || input.rating > 5) {
    throw new Error('Rating must be 1–5');
  }

  const eligibility = await getStayReviewEligibility(db, input.bookingId, input.guestIdentityId);
  if (!eligibility.canReview) {
    throw new Error(eligibility.reason || 'Cannot review this stay');
  }

  const review = await db.review.create({
    data: {
      target_type: 'stay',
      target_id: input.bookingId,
      author_identity_id: input.guestIdentityId,
      rating: input.rating,
      comment: input.comment || undefined,
      status: 'published',
    },
  });

  return { id: review.id };
}
