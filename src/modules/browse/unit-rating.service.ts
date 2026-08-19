import { PrismaClient } from '@prisma/client';

/**
 * What guests thought of a villa.
 *
 * A stay review targets the **booking** (`Review.target_type = 'stay'`), not the
 * unit — that is what makes one guest's review of one stay, rather than a
 * running opinion of the property. So a villa's rating is assembled by going
 * back through its bookings; there is no column to read.
 *
 * Kept out of the search route because two things need it — ordering the
 * results and labelling each card — and because it is the kind of join that
 * quietly turns into an N+1 when it is written inline a second time.
 */

export interface UnitRating {
  averageRating: number | null;
  reviewCount: number;
}

/**
 * Ratings for the given units, as a map. Units with no published review are
 * absent from the map rather than present with a zero — a villa nobody has
 * reviewed is unknown, and a caller that cannot tell "unknown" from "bad" will
 * punish every villa in its first season.
 */
export async function getUnitRatings(
  db: PrismaClient,
  unitIds: readonly string[]
): Promise<Map<string, UnitRating>> {
  const ratings = new Map<string, UnitRating>();
  if (unitIds.length === 0) return ratings;

  const bookings = await db.booking.findMany({
    where: { unitId: { in: [...unitIds] } },
    select: { id: true, unitId: true },
  });
  if (bookings.length === 0) return ratings;

  const unitByBooking = new Map(bookings.map((b) => [b.id, b.unitId]));

  const reviews = await db.review.findMany({
    where: {
      target_type: 'stay',
      target_id: { in: bookings.map((b) => b.id) },
      status: 'published',
    },
    select: { target_id: true, rating: true },
  });

  const totals = new Map<string, { sum: number; count: number }>();
  for (const review of reviews) {
    const unitId = unitByBooking.get(review.target_id);
    if (!unitId) continue;
    const entry = totals.get(unitId) ?? { sum: 0, count: 0 };
    entry.sum += review.rating;
    entry.count += 1;
    totals.set(unitId, entry);
  }

  for (const [unitId, { sum, count }] of totals) {
    ratings.set(unitId, {
      averageRating: Math.round((sum / count) * 10) / 10,
      reviewCount: count,
    });
  }

  return ratings;
}

/** The rating of one unit, in the shape a card wants: never absent, only null. */
export async function getUnitRating(db: PrismaClient, unitId: string): Promise<UnitRating> {
  const ratings = await getUnitRatings(db, [unitId]);
  return ratings.get(unitId) ?? { averageRating: null, reviewCount: 0 };
}
