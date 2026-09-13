import type { PrismaClient } from '@prisma/client';
import { getConfig, type CategoryRates } from '@/modules/config';
import {
  addDays,
  daysBetween,
  daysUntil,
  toCalendarDay,
  DEFAULT_TIME_ZONE,
} from '@/lib/date';
import { getApplicableSeason, type PriceBreakdown } from './availability.service';

function applyRatePlanAdjustment(
  amount: number,
  adjustmentType: string | null,
  rawValue: unknown
): number {
  if (!adjustmentType || rawValue === null || rawValue === undefined) return amount;
  const value = Number(rawValue);
  if (!Number.isFinite(value)) return amount;
  switch (adjustmentType) {
    case 'percent':
    case 'percentage':
    case 'percentage_markup':
      return Math.max(0, Math.round(amount * (1 + value / 100)));
    case 'percentage_discount':
      return Math.max(0, Math.round(amount * (1 - value / 100)));
    case 'fixed':
    case 'fixed_markup':
      return Math.max(0, Math.round(amount + value));
    case 'fixed_discount':
      return Math.max(0, Math.round(amount - value));
    default:
      return amount;
  }
}

async function resolveBarPlan(
  db: PrismaClient,
  unitId: string,
  categoryId: string | null,
  projectId: string
) {
  const unitPlan = await db.ratePlan.findFirst({
    where: { unitId, code: 'BAR', status: 'active' },
  });
  if (unitPlan) return unitPlan;

  if (categoryId) {
    const categoryPlan = await db.ratePlan.findFirst({
      where: { categoryId, code: 'BAR', status: 'active' },
    });
    if (categoryPlan) return categoryPlan;
  }

  return db.ratePlan.findFirst({
    where: {
      projectId,
      unitId: null,
      categoryId: null,
      code: 'BAR',
      status: 'active',
    },
  });
}

/**
 * Drop-in replacement for the legacy Unit-priced booking calculator.
 *
 * Commercial source of truth is InventoryCategory + RatePlan. Unit-level
 * PricingRule remains the explicit date override. Legacy unit commercial fields
 * are used only for a draft/not-yet-migrated unit so old test fixtures do not
 * become unpriceable while production live inventory is strictly canonical.
 */
export async function computeCanonicalPriceBreakdown(
  db: PrismaClient,
  unitId: string,
  checkInDate: Date,
  checkOutDate: Date,
  guestCount: number,
  bookingDate: Date = new Date(),
  pets: number = 0
): Promise<PriceBreakdown> {
  const unit = await db.unit.findUnique({
    where: { id: unitId },
    include: {
      project: { select: { id: true, status: true, timezone: true } },
      inventoryCategory: true,
    },
  });
  if (!unit) throw new Error(`Unit ${unitId} not found`);
  if (unit.status === 'live' && !unit.inventoryCategory) {
    throw new Error(`Live unit ${unitId} has no canonical InventoryCategory`);
  }
  if (unit.project.status !== 'live' && unit.status === 'live') {
    throw new Error('Unit project is not live');
  }
  if (guestCount > unit.maxGuests) {
    throw new Error(`Party size ${guestCount} exceeds unit max of ${unit.maxGuests}`);
  }
  if (pets > 0) {
    if (unit.petsAllowed !== true) throw new Error('This unit does not accept pets');
    if (unit.maxPets !== null && unit.maxPets !== undefined && pets > unit.maxPets) {
      throw new Error(`This unit accepts up to ${unit.maxPets} pet(s), not ${pets}`);
    }
  }

  const scope = { unitId: unit.id, projectId: unit.projectId };
  const nights = daysBetween(checkInDate, checkOutDate);
  if (nights < 1) throw new Error('Stay must contain at least one night');

  const ratePlan = await resolveBarPlan(
    db,
    unit.id,
    unit.inventoryCategoryId,
    unit.projectId
  );

  const arrivalRule = await db.pricingRule.findFirst({
    where: {
      unitId: unit.id,
      startDate: { lte: checkInDate },
      endDate: { gt: checkInDate },
    },
    select: { minNightsOverride: true },
  });

  const canonicalMinNights =
    ratePlan?.minNights ?? unit.inventoryCategory?.minNights ?? unit.minNights;
  const minNights = arrivalRule?.minNightsOverride ?? canonicalMinNights;
  if (nights < minNights) {
    throw new Error(`Stay length ${nights} nights is below minimum of ${minNights}`);
  }

  const categoryKey = unit.inventoryCategory?.categoryKey ?? unit.categoryKey;
  const categoryRates = categoryKey
    ? ((await getConfig(db, 'pricing.category_rates', scope)) as CategoryRates | undefined)
    : undefined;
  const canonicalBase = unit.inventoryCategory?.baseNightlyThb ?? unit.baseNightlyThb;

  const lines: PriceBreakdown['lines'] = [];
  const nightMonthlyRates: (number | null)[] = [];
  let subtotal = 0;
  let currentDate = new Date(checkInDate);

  while (currentDate < checkOutDate) {
    const rule = await db.pricingRule.findFirst({
      where: {
        unitId: unit.id,
        startDate: { lte: currentDate },
        endDate: { gt: currentDate },
      },
    });
    const season = await getApplicableSeason(db, currentDate, scope);
    const categoryEntry = categoryKey && categoryRates ? categoryRates[categoryKey] : undefined;
    const monthlyRate = (season && categoryEntry?.monthly?.[season.name]) ?? null;

    let nightly = canonicalBase;
    let appliedFrom: PriceBreakdown['lines'][number]['applied_from'] = 'base';

    if (rule) {
      nightly = rule.nightlyThb;
      appliedFrom = 'rule';
    } else {
      const categorySeasonal = season && categoryEntry?.nightly?.[season.name];
      if (typeof categorySeasonal === 'number') {
        nightly = categorySeasonal;
        appliedFrom = 'category_season';
      } else if (season && season.markup_pct !== 0) {
        nightly = Math.round(canonicalBase * (1 + season.markup_pct / 100));
        appliedFrom = 'season';
      }
    }

    nightly = applyRatePlanAdjustment(
      nightly,
      ratePlan?.adjustmentType ?? null,
      ratePlan?.adjustmentValue ?? null
    );

    lines.push({
      date: toCalendarDay(currentDate),
      nightly_thb: nightly,
      applied_from: appliedFrom,
    });
    nightMonthlyRates.push(monthlyRate);
    subtotal += nightly;
    currentDate = addDays(currentDate, 1);
  }

  let monthlyApplied = false;
  if (nights >= 28 && nightMonthlyRates.every((m) => typeof m === 'number')) {
    monthlyApplied = true;
    subtotal = 0;
    for (let i = 0; i < lines.length; i++) {
      const nightly = Math.round((nightMonthlyRates[i] as number) / 30);
      lines[i] = { ...lines[i], nightly_thb: nightly, applied_from: 'category_monthly' };
      subtotal += nightly;
    }
  }

  let losDiscountPct = 0;
  if (!monthlyApplied) {
    if (nights >= 28) {
      losDiscountPct = (await getConfig(db, 'pricing.los_discount.monthly_pct', scope)) ?? 20;
    } else if (nights >= 7) {
      losDiscountPct = (await getConfig(db, 'pricing.los_discount.weekly_pct', scope)) ?? 5;
    }
  }
  const losDiscount = Math.round(subtotal * (losDiscountPct / 100));

  let earlyBirdDiscount = 0;
  if (!monthlyApplied) {
    const earlyBird = await getConfig(db, 'pricing.early_bird', scope);
    if (
      earlyBird &&
      earlyBird.min_days_before !== null &&
      earlyBird.pct > 0 &&
      daysUntil(
        bookingDate,
        checkInDate,
        unit.project.timezone ?? DEFAULT_TIME_ZONE
      ) >= earlyBird.min_days_before
    ) {
      earlyBirdDiscount = Math.round(
        (subtotal - losDiscount) * (earlyBird.pct / 100)
      );
    }
  }

  const cleaningFee = (await getConfig(db, 'pricing.cleaning_fee_thb', scope)) ?? 0;
  const serviceFeePercent =
    (await getConfig(db, 'pricing.guest_service_fee_pct', scope)) ?? 0;
  const subtotalAfterDiscount = subtotal - losDiscount - earlyBirdDiscount;
  const serviceFee = Math.round(subtotalAfterDiscount * (serviceFeePercent / 100));
  const taxPercent = (await getConfig(db, 'finance.occupancy_tax_pct', scope)) ?? 0;
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
