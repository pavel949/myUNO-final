import type { PrismaClient } from '@prisma/client';

/**
 * Give every live unit without a stay offering an active one.
 *
 * CommercialOffering decides whether a unit is bookable (canonical contract
 * invariant 3), and the quote engine refuses a live unit without an active
 * stay offering. Seeds create live units directly, so they call this once at
 * the end — the same rule as migration 20261005120000_backfill_stay_offerings.
 * A unit that already has a stay offering in any status is left untouched, so
 * a source-owned draft is never activated here, and neither is a unit linked
 * to an external source system (its calendar is source-owned until cutover).
 */
export async function ensureStayOfferingsForLiveUnits(db: PrismaClient): Promise<number> {
  const units = await db.unit.findMany({
    where: {
      status: 'live',
      commercialOfferings: { none: { offeringType: { in: ['short_stay', 'short_term_stay'] } } },
    },
    select: { id: true },
  });
  const linked = new Set((await db.externalMapping.findMany({
    where: { entity_type: 'unit', internal_id: { in: units.map(unit => unit.id) } },
    select: { internal_id: true },
  })).map(link => link.internal_id));
  const eligible = units.filter(unit => !linked.has(unit.id));
  if (eligible.length === 0) return 0;
  const created = await db.commercialOffering.createMany({
    data: eligible.map(unit => ({ unitId: unit.id, offeringType: 'short_term_stay', status: 'active' })),
    skipDuplicates: true,
  });
  return created.count;
}
