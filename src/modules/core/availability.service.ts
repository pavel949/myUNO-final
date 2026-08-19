import { PrismaClient, Unit } from '@prisma/client';
import {
  getConfig,
  type SeasonPeriod,
  type CategoryRates,
} from '@/modules/config';

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

function dateToMonthDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${month}-${day}`;
}

function isDateInSeason(date: Date, season: SeasonPeriod): boolean {
  const monthDay = dateToMonthDay(date);
  const from = season.from;
  const to = season.to;

  // Handle year-boundary seasons (e.g., 12-15 to 01-15)
  if (from > to) {
    return monthDay >= from || monthDay <= to;
  }

  return monthDay >= from && monthDay <= to;
}

function getDaysBetween(startDate: Date, endDate: Date): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Approximate duration of a season window in days, used only to rank
 * overlapping seasons (shortest = most specific wins). The year-boundary
 * branch is a rough approximation — it orders a short carve-out (peak inside
 * high) correctly, but do not rely on it for exotic overlapping shapes.
 */
function seasonDuration(date: Date, season: SeasonPeriod): number {
  if (season.from > season.to) {
    const part1Start = new Date(date.getFullYear(), 0, 1);
    const part1End = new Date(date.getFullYear(), 11, 31);
    const part1Days = getDaysBetween(part1Start, part1End);

    const toMonth = parseInt(season.to.split('-')[0]) - 1;
    const toDay = parseInt(season.to.split('-')[1]);
    const part2End = new Date(date.getFullYear(), toMonth, toDay);
    const part2Days = getDaysBetween(part1End, part2End);

    return part1Days + part2Days;
  }

  const fromMonth = parseInt(season.from.split('-')[0]) - 1;
  const fromDay = parseInt(season.from.split('-')[1]);
  const toMonth = parseInt(season.to.split('-')[0]) - 1;
  const toDay = parseInt(season.to.split('-')[1]);

  const start = new Date(date.getFullYear(), fromMonth, fromDay);
  const end = new Date(date.getFullYear(), toMonth, toDay);
  return getDaysBetween(start, end);
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
  const unit = await db.unit.findUnique({ where: { id: unitId } });
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

  const nights = getDaysBetween(checkInDate, checkOutDate);
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
  const currentDate = new Date(checkInDate);

  while (currentDate < checkOutDate) {
    const { price, appliedFrom, monthlyRate } = await resolveNightlyPrice(
      db,
      currentDate,
      unit,
      categoryRates
    );
    lines.push({
      date: currentDate.toISOString().split('T')[0],
      nightly_thb: price,
      applied_from: appliedFrom,
    });
    nightMonthlyRates.push(monthlyRate);
    subtotal += price;
    currentDate.setDate(currentDate.getDate() + 1);
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
      getDaysBetween(bookingDate, checkInDate) >= earlyBird.min_days_before
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
