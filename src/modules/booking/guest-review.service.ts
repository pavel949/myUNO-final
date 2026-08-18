import { PrismaClient } from '@prisma/client';

/**
 * Reviewing the guest, after their stay (the other direction).
 *
 * Reviews ran one way: guests reviewed stays and service orders, and nobody
 * reviewed the guest. For a business letting private villas to a repeat
 * clientele that leaves the owner's first question unanswerable — "who stayed in
 * my villa, and were they any good" — and gives an operator no basis for
 * declining a returning guest who was a problem.
 *
 * Built on the existing polymorphic `Review` rather than a new table: it already
 * carries rating, comment, reply, status and a one-per-author constraint. The
 * target is the **booking**, so a guest who returns is reviewed each stay and
 * their reputation is the set of those reviews.
 */

/** Stays that are over. A guest cannot be reviewed mid-stay. */
const REVIEWABLE_STATUSES = ['checked_out', 'completed'] as const;

export interface WriteGuestReviewInput {
  bookingId: string;
  authorIdentityId: string;
  rating: number;
  comment?: string;
}

/**
 * Who may review the guest on this booking.
 *
 * The unit's owner, because it is their villa; staff and admin, because myUNO
 * operates the stay and in a managed engagement the owner may never meet the
 * guest. Nobody else — a review of a named person is not something a stranger
 * gets to write.
 */
async function canReviewGuest(
  db: PrismaClient,
  bookingId: string,
  authorIdentityId: string
): Promise<{ allowed: boolean; reason?: string; guestIdentityId?: string }> {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      status: true,
      guestIdentityId: true,
      unitId: true,
      projectId: true,
      unit: { select: { ownerIdentityId: true } },
    },
  });

  if (!booking) return { allowed: false, reason: 'Booking not found' };

  if (!REVIEWABLE_STATUSES.includes(booking.status as (typeof REVIEWABLE_STATUSES)[number])) {
    return { allowed: false, reason: 'The stay is not over yet' };
  }

  if (booking.guestIdentityId === authorIdentityId) {
    return { allowed: false, reason: 'A guest cannot review themselves' };
  }

  if (booking.unit?.ownerIdentityId === authorIdentityId) {
    return { allowed: true, guestIdentityId: booking.guestIdentityId };
  }

  const author = await db.identity.findUnique({
    where: { id: authorIdentityId },
    select: { isAdmin: true },
  });
  if (author?.isAdmin) {
    return { allowed: true, guestIdentityId: booking.guestIdentityId };
  }

  const staffRole = await db.roleAssignment.findFirst({
    where: {
      identityId: authorIdentityId,
      role: { in: ['staff_ops', 'onsite_host'] },
      status: 'active',
      OR: [{ projectId: booking.projectId }, { unitId: booking.unitId }],
    },
    select: { id: true },
  });
  if (staffRole) {
    return { allowed: true, guestIdentityId: booking.guestIdentityId };
  }

  return { allowed: false, reason: 'Only the unit owner or operating staff may review a guest' };
}

/** Whether this author may write a guest review for this booking, and why not. */
export async function getGuestReviewEligibility(
  db: PrismaClient,
  bookingId: string,
  authorIdentityId: string
): Promise<{ canReview: boolean; reason?: string }> {
  const check = await canReviewGuest(db, bookingId, authorIdentityId);
  if (!check.allowed) return { canReview: false, reason: check.reason };

  const existing = await db.review.findFirst({
    where: {
      target_type: 'guest',
      target_id: bookingId,
      author_identity_id: authorIdentityId,
    },
    select: { id: true },
  });

  return existing
    ? { canReview: false, reason: 'You have already reviewed this guest for this stay' }
    : { canReview: true };
}

export async function writeGuestReview(db: PrismaClient, input: WriteGuestReviewInput) {
  const { bookingId, authorIdentityId, rating, comment } = input;

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error('Rating must be a whole number from 1 to 5');
  }

  const eligibility = await getGuestReviewEligibility(db, bookingId, authorIdentityId);
  if (!eligibility.canReview) {
    const err = new Error(eligibility.reason ?? 'You cannot review this guest');
    (err as any).code = 'REVIEW_NOT_ALLOWED';
    throw err;
  }

  return db.review.create({
    data: {
      target_type: 'guest',
      target_id: bookingId,
      author_identity_id: authorIdentityId,
      rating,
      comment,
    },
  });
}

export interface GuestReputation {
  identityId: string;
  reviewCount: number;
  /** Null when nobody has reviewed them yet — not zero, which reads as bad. */
  averageRating: number | null;
  reviews: Array<{ id: string; rating: number; comment: string | null; createdAt: Date }>;
}

/**
 * A guest's reputation across every stay.
 *
 * Reviews target bookings, so this joins through them. An unreviewed guest gets
 * `null`, never `0` — a new guest is unknown, not bad, and a screen that cannot
 * tell those apart will quietly punish first-time visitors.
 */
export async function getGuestReputation(
  db: PrismaClient,
  guestIdentityId: string
): Promise<GuestReputation> {
  const bookings = await db.booking.findMany({
    where: { guestIdentityId },
    select: { id: true },
  });

  if (bookings.length === 0) {
    return { identityId: guestIdentityId, reviewCount: 0, averageRating: null, reviews: [] };
  }

  const reviews = await db.review.findMany({
    where: {
      target_type: 'guest',
      target_id: { in: bookings.map((b) => b.id) },
      status: 'published',
    },
    select: { id: true, rating: true, comment: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });

  const averageRating =
    reviews.length > 0
      ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) * 10) / 10
      : null;

  return {
    identityId: guestIdentityId,
    reviewCount: reviews.length,
    averageRating,
    reviews,
  };
}
