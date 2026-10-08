import { PrismaClient, BlockedDate, PricingRule, BlockedDateReason } from '@prisma/client';
import type { SourceBookingTerms } from './commercial-booking-terms';
import { getConfig, type SeasonPeriod } from '@/modules/config';
import { daysBetween, toCalendarDay } from '@/lib/date';
import { blockingBookingConditions, isActiveBookingHold } from './booking-occupancy';

/**
 * Scope for pricing config resolution. Every pricing read goes through
 * config.get() so per-project / per-unit overrides apply (doc 04) — a second
 * project with its own season calendar or fees must never see another
 * project's numbers.
 */
export interface PricingScope {
  projectId?: string;
  unitId?: string;
}

export interface PriceBreakdownLine {
  date: string; // ISO date
  nightly_thb: number;
  applied_from: 'rule' | 'category_season' | 'category_monthly' | 'season' | 'base';
}

export interface PriceBreakdown {
  lines: PriceBreakdownLine[];
  subtotal_thb: number;
  cleaning_fee_thb: number;
  los_discount_thb: number;
  early_bird_discount_thb: number;
  service_fee_thb: number;
  occupancy_tax_thb: number;
  total_thb: number;
  commercialTerms?: SourceBookingTerms;
}

function isDateInSeason(date: Date, season: SeasonPeriod): boolean {
  // A stored night is a `@db.Date` at UTC midnight, so its month-day is read
  // in UTC. Reading it with `getMonth()`/`getDate()` (server-local) happened
  // to agree only because Vercel runs UTC — one TZ change would have shifted
  // every season boundary with nothing failing.
  const monthDay = toCalendarDay(date).slice(5);
  const from = season.from;
  const to = season.to;

  // Handle year-boundary seasons (e.g., 12-15 to 01-15)
  if (from > to) {
    return monthDay >= from || monthDay <= to;
  }

  return monthDay >= from && monthDay <= to;
}

/**
 * Approximate duration of a season window in days, used only to rank
 * overlapping seasons (shortest = most specific wins). The year-boundary
 * branch is a rough approximation — it orders a short carve-out (peak inside
 * high) correctly, but do not rely on it for exotic overlapping shapes.
 */
function seasonDuration(date: Date, season: SeasonPeriod): number {
  // Built in UTC to match how the night itself is stored; the local-time
  // `new Date(y, m, d)` constructor used before made the ranking depend on
  // the server's zone.
  const year = date.getUTCFullYear();
  if (season.from > season.to) {
    const part1Start = new Date(Date.UTC(year, 0, 1));
    const part1End = new Date(Date.UTC(year, 11, 31));
    const part1Days = daysBetween(part1Start, part1End);

    const toMonth = parseInt(season.to.split('-')[0]) - 1;
    const toDay = parseInt(season.to.split('-')[1]);
    const part2End = new Date(Date.UTC(year, toMonth, toDay));
    const part2Days = daysBetween(part1End, part2End);

    return part1Days + part2Days;
  }

  const fromMonth = parseInt(season.from.split('-')[0]) - 1;
  const fromDay = parseInt(season.from.split('-')[1]);
  const toMonth = parseInt(season.to.split('-')[0]) - 1;
  const toDay = parseInt(season.to.split('-')[1]);

  const start = new Date(Date.UTC(year, fromMonth, fromDay));
  const end = new Date(Date.UTC(year, toMonth, toDay));
  return daysBetween(start, end);
}

/**
 * Find which season applies to a given night, resolving the calendar through
 * config.get() so project/unit overrides win over the global default.
 * More specific (shorter) ranges win on overlap.
 */
function selectApplicableSeason(
  seasons: SeasonPeriod[] | null | undefined,
  date: Date
): SeasonPeriod | null {
  if (!Array.isArray(seasons) || seasons.length === 0) return null;

  let bestMatch: SeasonPeriod | null = null;
  let bestDuration = Infinity;
  for (const season of seasons) {
    if (!isDateInSeason(date, season)) continue;
    const duration = seasonDuration(date, season);
    if (duration < bestDuration) {
      bestMatch = season;
      bestDuration = duration;
    }
  }
  return bestMatch;
}

export async function getApplicableSeason(
  db: PrismaClient,
  date: Date,
  scope?: PricingScope
): Promise<SeasonPeriod | null> {
  const seasons = await getConfig(db, 'pricing.season.calendar', scope);
  return selectApplicableSeason(Array.isArray(seasons) ? seasons : [], date);
}

/**
 * Check if a pending payment hold is still active.
 */
export function isActiveHold(holdExpiresAt: Date | null, now: Date = new Date()): boolean {
  return isActiveBookingHold(holdExpiresAt, now);
}

/**
 * Check if a date range overlaps with any blocked date or conflicting booking.
 * Overlap rule: start <= requestEnd && end >= requestStart
 */
export async function checkAvailability(
  db: PrismaClient,
  unitId: string,
  startDate: Date,
  endDate: Date
): Promise<boolean> {
  const now = new Date();
  const overlaps = { startDate: { lt: endDate }, endDate: { gt: startDate } };

  // Two things make a unit unavailable, and this used to ask about only one.
  //
  // It checked `blocked_date` and nothing else, so it answered "available" for
  // a range with a confirmed booking sitting in it. Nothing was broken in
  // practice, because no production path called it — the booking flow enforces
  // this itself inside a transaction (`findBlockingConflict`, an advisory lock,
  // and the `booking_no_overlap` exclusion constraint as the backstop). But a
  // function named `checkAvailability`, exported from the module's public
  // interface, has one obvious meaning, and the next caller to reach for it
  // would have been quietly wrong.
  //
  // The booking rules are mirrored exactly rather than approximated: a lapsed
  // `pending_payment` hold does not block, a live one does. A stricter reading
  // here would refuse guests the booking path would have accepted.
  const [blockedDate, conflictingBooking] = await Promise.all([
    db.blockedDate.findFirst({
      where: { unitId, ...overlaps },
      select: { id: true },
    }),
    db.booking.findFirst({
      where: {
        unitId,
        ...overlaps,
        OR: blockingBookingConditions(now),
      },
      select: { id: true },
    }),
  ]);

  return blockedDate === null && conflictingBooking === null;
}

// ---------------------------------------------------------------------------
// Manual availability & pricing overrides (doc 07 F-OPS-4, Q53)
//
// `BlockedDate` was, until now, written only by the automatic iCal-import job
// (`src/modules/integrations/ical-import.ts`, reason `ota_import`) and
// `PricingRule` had no writer anywhere. Staff had no way to take a unit
// offline for maintenance/an owner stay, or to set a one-off rate for a
// specific booking window — the flow doc 07 F-OPS-4 describes.
//
// Both writers land in the exact rows `resolveNightlyPrice` and
// `checkAvailability` above already read, and the ones `booking.service.ts`'s
// `claimDates` transaction already refuses bookings against — so a manual
// override takes effect on the very next availability check or booking
// attempt, through the one resolution path every caller shares. No second
// code path, no "guest can still book a maintenance week" gap.
// ---------------------------------------------------------------------------

/** Reasons a human can select. `ota_import` is written only by the iCal job. */
export type ManualBlockReason = Exclude<BlockedDateReason, 'ota_import'>;

export interface CreateManualBlockInput {
  unitId: string;
  startDate: Date;
  endDate: Date;
  reason: ManualBlockReason;
  note?: string;
  createdByIdentityId: string;
}

/**
 * List a unit's blocked date ranges (manual and OTA-imported alike),
 * most recent first.
 */
export async function getUnitBlockedDates(
  db: PrismaClient,
  unitId: string
): Promise<BlockedDate[]> {
  return db.blockedDate.findMany({
    where: { unitId },
    orderBy: { startDate: 'desc' },
  });
}

/**
 * Manually block a unit's availability for a date range (maintenance, an
 * owner stay, or another operational reason — doc 07 F-OPS-4).
 *
 * Takes the same per-unit advisory lock `claimDates` (booking.service.ts) and
 * `importICalEvents` (ical-import.ts) take, and checks for the same active
 * bookings `findBlockingConflict` does: a block never silently overrides a
 * guest who is already confirmed or mid-checkout on those dates — the
 * platform calendar is the single record, so the conflict is surfaced to the
 * caller (`BOOKING_CONFLICT`) rather than the guest's stay quietly vanishing
 * under a maintenance block.
 */
export async function createManualBlock(
  db: PrismaClient,
  input: CreateManualBlockInput
): Promise<BlockedDate> {
  const { unitId, startDate, endDate, reason, note, createdByIdentityId } = input;

  if (!(startDate < endDate)) {
    throw new Error('endDate must be after startDate');
  }

  const unit = await db.unit.findUnique({ where: { id: unitId }, select: { id: true } });
  if (!unit) {
    throw new Error(`Unit ${unitId} not found`);
  }

  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${unitId}))`;

    const now = new Date();
    const conflicting = await tx.booking.findFirst({
      where: {
        unitId,
        startDate: { lt: endDate },
        endDate: { gt: startDate },
        OR: blockingBookingConditions(now),
      },
      select: { id: true },
    });
    if (conflicting) {
      const err = new Error(
        'Cannot block these dates — an active booking overlaps them. Cancel or move the booking first.'
      );
      (err as Error & { code?: string; bookingId?: string }).code = 'BOOKING_CONFLICT';
      (err as Error & { code?: string; bookingId?: string }).bookingId = conflicting.id;
      throw err;
    }

    return tx.blockedDate.create({
      data: {
        unitId,
        startDate,
        endDate,
        reason,
        note: note || null,
        createdByIdentityId,
      },
    });
  });
}

/**
 * Remove a blocked date range (frees the dates immediately — the next
 * availability check reads through to no block, per `checkAvailability`).
 */
export async function removeBlockedDate(
  db: PrismaClient,
  blockedDateId: string
): Promise<BlockedDate> {
  const block = await db.blockedDate.findUnique({ where: { id: blockedDateId } });
  if (!block) {
    throw new Error(`BlockedDate ${blockedDateId} not found`);
  }
  if (block.propertyDealId) {
    throw new Error('SIGNED_LEASE_BLOCK: a signed agreement cannot be unblocked through the manual calendar');
  }
  await db.blockedDate.delete({ where: { id: blockedDateId } });
  return block;
}

export interface CreatePricingRuleInput {
  unitId: string;
  startDate: Date;
  endDate: Date;
  /** Satang (THB × 100) — every amount in the platform is (CLAUDE.md money rules). */
  nightlyThb: number;
  label?: string;
  minNightsOverride?: number;
}

/** List a unit's per-night price overrides, most recent first. */
export async function getUnitPricingRules(
  db: PrismaClient,
  unitId: string
): Promise<PricingRule[]> {
  return db.pricingRule.findMany({
    where: { unitId },
    orderBy: { startDate: 'desc' },
  });
}

/**
 * Set a one-off nightly rate for a unit over a date range (doc 07 F-OPS-4) —
 * the manual, per-unit override `resolveNightlyPrice` above checks *first*,
 * ahead of the season/category configuration path (doc 04 §4).
 *
 * Refuses a range that overlaps an existing rule for the same unit:
 * `resolveNightlyPrice`'s `pricingRule.findFirst` has no `orderBy`, so two
 * overlapping rules would resolve to whichever Postgres happens to return
 * first — an ambiguity worth refusing at write time rather than leaving as a
 * silent race for guests to hit.
 */
/** An override beyond this ratio of the base rate is treated as a units error. */
const OVERRIDE_RATIO_LIMIT = 10;

export async function createPricingRule(
  db: PrismaClient,
  input: CreatePricingRuleInput
): Promise<PricingRule> {
  const { unitId, startDate, endDate, nightlyThb, label, minNightsOverride } = input;

  if (!(startDate < endDate)) {
    throw new Error('endDate must be after startDate');
  }
  if (!Number.isInteger(nightlyThb) || nightlyThb <= 0) {
    throw new Error('nightlyThb must be a positive integer number of satang');
  }
  if (minNightsOverride !== undefined && (!Number.isInteger(minNightsOverride) || minNightsOverride <= 0)) {
    throw new Error('minNightsOverride must be a positive integer');
  }

  const unit = await db.unit.findUnique({
    where: { id: unitId },
    select: { id: true, baseNightlyThb: true, inventoryCategory: { select: { baseNightlyThb: true } } },
  });
  if (!unit) {
    throw new Error(`Unit ${unitId} not found`);
  }

  // Units-error guard, not a commercial rule: an override outside 1/10 .. 10x
  // of the canonical base is almost certainly baht typed as satang (100x too
  // low) or the reverse. The audit reproduced ฿120/night accepted on a
  // ฿13,006 villa. A genuine 10x promotion or surge is still possible by
  // changing the base rate itself, which is reviewed and audit-logged.
  const base = unit.inventoryCategory?.baseNightlyThb ?? unit.baseNightlyThb;
  if (base > 0 && (nightlyThb * OVERRIDE_RATIO_LIMIT < base || nightlyThb > base * OVERRIDE_RATIO_LIMIT)) {
    throw new Error(
      `nightlyThb ${nightlyThb} satang is outside 1/${OVERRIDE_RATIO_LIMIT}..${OVERRIDE_RATIO_LIMIT}x of the base rate ` +
        `(${base} satang) — check the amount is in satang (THB × 100)`
    );
  }

  const overlapping = await db.pricingRule.findFirst({
    where: {
      unitId,
      startDate: { lt: endDate },
      endDate: { gt: startDate },
    },
    select: { id: true },
  });
  if (overlapping) {
    throw new Error('A pricing rule already covers part of this date range for this unit');
  }

  return db.pricingRule.create({
    data: {
      unitId,
      startDate,
      endDate,
      nightlyThb,
      label: label || null,
      minNightsOverride: minNightsOverride ?? null,
    },
  });
}

/** Remove a price override (the night falls back through the doc 04 §4 chain). */
export async function removePricingRule(
  db: PrismaClient,
  pricingRuleId: string
): Promise<PricingRule> {
  const rule = await db.pricingRule.findUnique({ where: { id: pricingRuleId } });
  if (!rule) {
    throw new Error(`PricingRule ${pricingRuleId} not found`);
  }
  await db.pricingRule.delete({ where: { id: pricingRuleId } });
  return rule;
}
