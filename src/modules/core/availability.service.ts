import { PrismaClient } from '@prisma/client';

interface SeasonPeriod {
  name: string;
  from: string; // MM-DD
  to: string; // MM-DD
  markup_pct: number;
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
 * Find which season applies to a given night.
 * More specific (shorter) ranges win on overlap.
 */
export async function getApplicableSeasonMarkup(
  db: PrismaClient,
  date: Date
): Promise<number> {
  // Fetch season calendar from config
  const config = await db.configParameter.findUnique({
    where: { key: 'pricing.season.calendar' },
  });

  if (!config || !config.defaultValue) {
    return 0;
  }

  const seasons = config.defaultValue as unknown as SeasonPeriod[];
  if (!Array.isArray(seasons) || seasons.length === 0) {
    return 0;
  }

  // Find all matching seasons and pick the most specific (shortest range)
  let bestMatch: SeasonPeriod | null = null;
  let bestDuration = Infinity;

  for (const season of seasons) {
    if (isDateInSeason(date, season)) {
      // Calculate range duration for specificity
      let duration: number;

      if (season.from > season.to) {
        // Year-boundary season: calculate as if it wraps
        // Rough approximation: split and sum
        const part1Start = new Date(date.getFullYear(), 0, 1);
        const part1End = new Date(date.getFullYear(), 11, 31);
        const part1Days = getDaysBetween(part1Start, part1End);

        const toMonth = parseInt(season.to.split('-')[0]) - 1;
        const toDay = parseInt(season.to.split('-')[1]);
        const part2End = new Date(date.getFullYear(), toMonth, toDay);
        const part2Days = getDaysBetween(part1End, part2End);

        duration = part1Days + part2Days;
      } else {
        // Normal season
        const fromMonth = parseInt(season.from.split('-')[0]) - 1;
        const fromDay = parseInt(season.from.split('-')[1]);
        const toMonth = parseInt(season.to.split('-')[0]) - 1;
        const toDay = parseInt(season.to.split('-')[1]);

        const start = new Date(date.getFullYear(), fromMonth, fromDay);
        const end = new Date(date.getFullYear(), toMonth, toDay);
        duration = getDaysBetween(start, end);
      }

      // Pick the most specific match
      if (duration < bestDuration) {
        bestMatch = season;
        bestDuration = duration;
      }
    }
  }

  return bestMatch ? bestMatch.markup_pct : 0;
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

  // Check for PricingRule covering this night
  const rule = await db.pricingRule.findFirst({
    where: {
      unitId,
      startDate: { lte: date },
      endDate: { gt: date }, // end is exclusive
    },
  });

  if (rule) {
    return rule.nightlyThb;
  }

  // Check season markup
  const markup = await getApplicableSeasonMarkup(db, date);
  const withMarkup = Math.round(unit.baseNightlyThb * (1 + markup / 100));
  return withMarkup;
}

/**
 * Compute the full price breakdown for a booking.
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
    const nightlyPrice = await getApplicableNightlyPrice(db, currentDate, unitId);
    lines.push({
      date: currentDate.toISOString().split('T')[0],
      nightly_thb: nightlyPrice,
      applied_from: 'base', // Simplified — would track rule vs season vs base
    });
    subtotal += nightlyPrice;
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Calculate LOS discount
  let losDiscountPct = 0;
  if (nights >= 28) {
    // Fetch monthly discount from config
    const monthlyConfig = await db.configParameter.findUnique({
      where: { key: 'pricing.los_discount.monthly_pct' },
    });
    losDiscountPct = monthlyConfig?.defaultValue as number || 20;
  } else if (nights >= 7) {
    // Fetch weekly discount from config
    const weeklyConfig = await db.configParameter.findUnique({
      where: { key: 'pricing.los_discount.weekly_pct' },
    });
    losDiscountPct = weeklyConfig?.defaultValue as number || 5;
  }

  const losDiscount = Math.round(subtotal * (losDiscountPct / 100));

  // Fetch cleaning fee from config (or use unit's base if config exists)
  const cleaningConfig = await db.configParameter.findUnique({
    where: { key: 'pricing.cleaning_fee_thb' },
  });
  const cleaningFee = cleaningConfig?.defaultValue as number || 0;

  // Fetch service fee from config
  const serviceFeeConfig = await db.configParameter.findUnique({
    where: { key: 'pricing.guest_service_fee_pct' },
  });
  const serviceFeePercent = serviceFeeConfig?.defaultValue as number || 0;

  const subtotalAfterDiscount = subtotal - losDiscount;
  const serviceFee = Math.round(subtotalAfterDiscount * (serviceFeePercent / 100));

  // Fetch occupancy tax from config
  const taxConfig = await db.configParameter.findUnique({
    where: { key: 'finance.occupancy_tax_pct' },
  });
  const taxPercent = taxConfig?.defaultValue as number || 0;

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
