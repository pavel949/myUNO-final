import { PrismaClient, Unit, BlockedDate, PricingRule, BlockedDateReason } from '@prisma/client';
import {
  getConfig,
  type SeasonPeriod,
  type CategoryRates,
} from '@/modules/config';
import {
  addDays,
  daysBetween,
  daysUntil,
  toCalendarDay,
  DEFAULT_TIME_ZONE,
} from '@/lib/date';

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
export async function getApplicableSeason(
  db: PrismaClient,
  date: Date,
  scope?: PricingScope
): Promise<SeasonPeriod | null> {
  const seasons = await getConfig(db, 'pricing.season.calendar', scope);

  if (!Array.isArray(seasons) || seasons.length === 0) {
    return null;
  }

  let bestMatch: SeasonPeriod | null = null;
  let bestDuration = Infinity;

  for (const season of seasons) {
    if (isDateInSeason(date, season)) {
      const duration = seasonDuration(date, season);
      if (duration < bestDuration) {
        bestMatch = season;
        bestDuration = duration;
      }
    }
  }

  return bestMatch;
}

/**
 * Season markup percentage for a given night (0 when no season matches).
 */
export async function getApplicableSeasonMarkup(
  db: PrismaClient,
  date: Date,
  scope?: PricingScope
): Promise<number> {
  const season = await getApplicableSeason(db, date, scope);
  return season ? season.markup_pct : 0;
}

interface NightResolution {
  price: number;
  appliedFrom: PriceBreakdownLine['applied_from'];
  /** Flat month price (satang) for this night's season, when the unit's
   *  category defines one — the long-stay path (≥ 28 nights) uses it. */
  monthlyRate: number | null;
}

/**
 * Internal single-night resolver over a pre-loaded unit.
 * Resolution order: PricingRule → category seasonal rate → base × season
 * markup → base (doc 04 §4). Category rates are absolute satang amounts
 * keyed by the season *name* from the same project's calendar.
 */
async function resolveNightlyPrice(
  db: PrismaClient,
  date: Date,
  unit: Unit,
  categoryRates: CategoryRates | undefined
): Promise<NightResolution> {
  // Check for PricingRule covering this night
  const rule = await db.pricingRule.findFirst({
    where: {
      unitId: unit.id,
      startDate: { lte: date },
      endDate: { gt: date }, // end is exclusive
    },
  });

  const scope: PricingScope = { unitId: unit.id, projectId: unit.projectId };
  const season = await getApplicableSeason(db, date, scope);

  const categoryEntry =
    unit.categoryKey && categoryRates ? categoryRates[unit.categoryKey] : undefined;
  const monthlyRate =
    (season && categoryEntry?.monthly?.[season.name]) ?? null;

  if (rule) {
    return { price: rule.nightlyThb, appliedFrom: 'rule', monthlyRate };
  }

  const categoryNightly = season && categoryEntry?.nightly?.[season.name];
  if (typeof categoryNightly === 'number') {
    return { price: categoryNightly, appliedFrom: 'category_season', monthlyRate };
  }

  if (season && season.markup_pct !== 0) {
    return {
      price: Math.round(unit.baseNightlyThb * (1 + season.markup_pct / 100)),
      appliedFrom: 'season',
      monthlyRate,
    };
  }

  return { price: unit.baseNightlyThb, appliedFrom: 'base', monthlyRate };
}

async function getCategoryRatesForUnit(
  db: PrismaClient,
  unit: Unit
): Promise<CategoryRates | undefined> {
  if (!unit.categoryKey) return undefined;
  return await getConfig(db, 'pricing.category_rates', {
    unitId: unit.id,
    projectId: unit.projectId,
  });
}

/**
 * Resolve the per-night price for a single night.
 * Resolution order: PricingRule → category seasonal rate → base × season
 * markup → base
 */
export async function getApplicableNightlyPrice(
  db: PrismaClient,
  date: Date,
  unitId: string
): Promise<number> {
  const unit = await db.unit.findUnique({ where: { id: unitId } });
  if (!unit) {
    throw new Error(`Unit ${unitId} not found`);
  }

  const categoryRates = await getCategoryRatesForUnit(db, unit);
  const { price } = await resolveNightlyPrice(db, date, unit, categoryRates);
  return price;
}

/**
 * Compute the full price breakdown for a booking.
 * Every rate/fee/discount is read through config.get() with the unit's scope,
 * so per-project and per-unit overrides apply (doc 04).
 */
export async function computePriceBreakdown(
  db: PrismaClient,
  unitId: string,
  checkInDate: Date,
  checkOutDate: Date,
  guestCount: number,
  bookingDate: Date = new Date(),
  pets: number = 0
): Promise<PriceBreakdown> {
  // The project's timezone rides along on the lookup that was already
  // happening: `bookingDate` is an instant, and turning it into "today" needs
  // a zone (see the early-bird comparison below).
  const unit = await db.unit.findUnique({
    where: { id: unitId },
    include: { project: { select: { timezone: true } } },
  });
  if (!unit) {
    throw new Error(`Unit ${unitId} not found`);
  }

  const scope: PricingScope = { unitId: unit.id, projectId: unit.projectId };

  // Validate party size. Occupancy is adults + children — the convention every
  // OTA uses — so infants are excluded here and checked against the unit's pet
  // and cot policy instead. Counting an infant against the bed count turns a
  // family of four into a party the villa refuses.
  if (guestCount > unit.maxGuests) {
    throw new Error(`Party size ${guestCount} exceeds unit max of ${unit.maxGuests}`);
  }

  // Pets are a house rule, not a headcount. A unit that has not answered the
  // question is not the same as one that said no, so an unanswered policy
  // refuses rather than assumes — the operator sets it during mobilization.
  if (pets > 0) {
    if (unit.petsAllowed !== true) {
      throw new Error('This unit does not accept pets');
    }
    if (unit.maxPets !== null && unit.maxPets !== undefined && pets > unit.maxPets) {
      throw new Error(`This unit accepts up to ${unit.maxPets} pet(s), not ${pets}`);
    }
  }

  const nights = daysBetween(checkInDate, checkOutDate);
  if (nights < unit.minNights) {
    throw new Error(
      `Stay length ${nights} nights is below minimum of ${unit.minNights}`
    );
  }

  // Generate nightly breakdown
  const categoryRates = await getCategoryRatesForUnit(db, unit);
  const lines: PriceBreakdownLine[] = [];
  const nightMonthlyRates: (number | null)[] = [];
  let subtotal = 0;
  let currentDate = new Date(checkInDate);

  while (currentDate < checkOutDate) {
    const { price, appliedFrom, monthlyRate } = await resolveNightlyPrice(
      db,
      currentDate,
      unit,
      categoryRates
    );
    lines.push({
      date: toCalendarDay(currentDate),
      nightly_thb: price,
      applied_from: appliedFrom,
    });
    nightMonthlyRates.push(monthlyRate);
    subtotal += price;
    currentDate = addDays(currentDate, 1);
  }

  // Long-stay monthly path: for ≥ 28 nights, when the unit's category
  // defines a flat month price for EVERY covered season, each night becomes
  // round(monthly/30) and REPLACES the LOS discount (no stacking — provisional
  // rule, open_questions). Any season without a monthly rate falls the whole
  // stay back to the nightly + LOS-discount path.
  let monthlyApplied = false;
  if (nights >= 28 && nightMonthlyRates.every((m) => typeof m === 'number')) {
    monthlyApplied = true;
    subtotal = 0;
    for (let i = 0; i < lines.length; i++) {
      const nightly = Math.round((nightMonthlyRates[i] as number) / 30);
      lines[i] = {
        ...lines[i],
        nightly_thb: nightly,
        applied_from: 'category_monthly',
      };
      subtotal += nightly;
    }
  }

  // Length-of-stay discount (monthly beats weekly); replaced by the
  // category monthly rate when that path applied.
  let losDiscountPct = 0;
  if (!monthlyApplied) {
    if (nights >= 28) {
      losDiscountPct =
        (await getConfig(db, 'pricing.los_discount.monthly_pct', scope)) ?? 20;
    } else if (nights >= 7) {
      losDiscountPct =
        (await getConfig(db, 'pricing.los_discount.weekly_pct', scope)) ?? 5;
    }
  }

  const losDiscount = Math.round(subtotal * (losDiscountPct / 100));

  // Early-bird discount: pct off the nightly subtotal (after LOS) when the
  // booking is made far enough ahead. Never stacks with the monthly path
  // (provisional rule, open_questions).
  let earlyBirdDiscount = 0;
  if (!monthlyApplied) {
    const earlyBird = await getConfig(db, 'pricing.early_bird', scope);
    if (
      earlyBird &&
      earlyBird.min_days_before !== null &&
      earlyBird.pct > 0 &&
      // `bookingDate` is an instant; `checkInDate` is a stored calendar day.
      // Normalising the instant in UTC (what the old local-midnight helper did
      // on a UTC server) put "today" a day early for the seven hours between
      // 00:00 and 07:00 ICT — long enough to hand out, or refuse, an
      // early-bird discount the guest had not earned. `daysUntil` resolves the
      // instant to a day in the project's own zone first.
      daysUntil(bookingDate, checkInDate, unit.project?.timezone ?? DEFAULT_TIME_ZONE) >=
        earlyBird.min_days_before
    ) {
      earlyBirdDiscount = Math.round(
        (subtotal - losDiscount) * (earlyBird.pct / 100)
      );
    }
  }

  const cleaningFee =
    (await getConfig(db, 'pricing.cleaning_fee_thb', scope)) ?? 0;

  const serviceFeePercent =
    (await getConfig(db, 'pricing.guest_service_fee_pct', scope)) ?? 0;

  const subtotalAfterDiscount = subtotal - losDiscount - earlyBirdDiscount;
  const serviceFee = Math.round(subtotalAfterDiscount * (serviceFeePercent / 100));

  const taxPercent =
    (await getConfig(db, 'finance.occupancy_tax_pct', scope)) ?? 0;

  const occupancyTax = Math.round(
    (subtotalAfterDiscount + cleaningFee + serviceFee) * (taxPercent / 100)
  );

  const total = subtotalAfterDiscount + cleaningFee + serviceFee + occupancyTax;

  return {
    lines,
    subtotal_thb: subtotal,
    cleaning_fee_thb: cleaningFee,
    los_discount_thb: losDiscount,
    early_bird_discount_thb: earlyBirdDiscount,
    service_fee_thb: serviceFee,
    occupancy_tax_thb: occupancyTax,
    total_thb: total,
  };
}

/**
 * Check if a pending payment hold is still active.
 */
export function isActiveHold(holdExpiresAt: Date | null, now: Date = new Date()): boolean {
  if (!holdExpiresAt) {
    return false;
  }
  return now < holdExpiresAt;
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
  // Check for blocked dates
  const blockedDate = await db.blockedDate.findFirst({
    where: {
      unitId,
      startDate: { lt: endDate },
      endDate: { gt: startDate },
    },
  });

  if (blockedDate) {
    return false;
  }

  return true;
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
        OR: [
          { status: { in: ['confirmed', 'checked_in'] } },
          { status: 'pending_payment', holdExpiresAt: { gt: now } },
        ],
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

  const unit = await db.unit.findUnique({ where: { id: unitId }, select: { id: true } });
  if (!unit) {
    throw new Error(`Unit ${unitId} not found`);
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
