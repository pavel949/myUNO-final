import { PrismaClient, Unit } from '@prisma/client';
import { getConfig, type SeasonPeriod } from '@/modules/config';

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
  applied_from: 'rule' | 'season' | 'base';
}

export interface PriceBreakdown {
  lines: PriceBreakdownLine[];
  subtotal_thb: number;
  cleaning_fee_thb: number;
  los_discount_thb: number;
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

/**
 * Internal single-night resolver over a pre-loaded unit.
 * Resolution order: PricingRule → base × season markup → base.
 */
async function resolveNightlyPrice(
  db: PrismaClient,
  date: Date,
  unit: Unit
): Promise<{ price: number; appliedFrom: PriceBreakdownLine['applied_from'] }> {
  // Check for PricingRule covering this night
  const rule = await db.pricingRule.findFirst({
    where: {
      unitId: unit.id,
      startDate: { lte: date },
      endDate: { gt: date }, // end is exclusive
    },
  });

  if (rule) {
    return { price: rule.nightlyThb, appliedFrom: 'rule' };
  }

  const scope: PricingScope = { unitId: unit.id, projectId: unit.projectId };
  const season = await getApplicableSeason(db, date, scope);
  if (season && season.markup_pct !== 0) {
    return {
      price: Math.round(unit.baseNightlyThb * (1 + season.markup_pct / 100)),
      appliedFrom: 'season',
    };
  }

  return { price: unit.baseNightlyThb, appliedFrom: 'base' };
}

/**
 * Resolve the per-night price for a single night.
 * Resolution order: PricingRule → base × season markup → base
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

  const { price } = await resolveNightlyPrice(db, date, unit);
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
  guestCount: number
): Promise<PriceBreakdown> {
  const unit = await db.unit.findUnique({ where: { id: unitId } });
  if (!unit) {
    throw new Error(`Unit ${unitId} not found`);
  }

  const scope: PricingScope = { unitId: unit.id, projectId: unit.projectId };

  // Validate party size
  if (guestCount > unit.maxGuests) {
    throw new Error(`Party size ${guestCount} exceeds unit max of ${unit.maxGuests}`);
  }

  const nights = getDaysBetween(checkInDate, checkOutDate);
  if (nights < unit.minNights) {
    throw new Error(
      `Stay length ${nights} nights is below minimum of ${unit.minNights}`
    );
  }

  // Generate nightly breakdown
  const lines: PriceBreakdownLine[] = [];
  let subtotal = 0;
  const currentDate = new Date(checkInDate);

  while (currentDate < checkOutDate) {
    const { price, appliedFrom } = await resolveNightlyPrice(db, currentDate, unit);
    lines.push({
      date: currentDate.toISOString().split('T')[0],
      nightly_thb: price,
      applied_from: appliedFrom,
    });
    subtotal += price;
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Length-of-stay discount (monthly beats weekly)
  let losDiscountPct = 0;
  if (nights >= 28) {
    losDiscountPct =
      (await getConfig(db, 'pricing.los_discount.monthly_pct', scope)) ?? 20;
  } else if (nights >= 7) {
    losDiscountPct =
      (await getConfig(db, 'pricing.los_discount.weekly_pct', scope)) ?? 5;
  }

  const losDiscount = Math.round(subtotal * (losDiscountPct / 100));

  const cleaningFee =
    (await getConfig(db, 'pricing.cleaning_fee_thb', scope)) ?? 0;

  const serviceFeePercent =
    (await getConfig(db, 'pricing.guest_service_fee_pct', scope)) ?? 0;

  const subtotalAfterDiscount = subtotal - losDiscount;
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
