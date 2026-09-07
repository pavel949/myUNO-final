import { PrismaClient } from '@prisma/client';
import { getConfig } from '@/modules/config';
import { formatBaht } from '@/lib/money';
import { toCalendarDay } from '@/lib/date';

export interface StayOfferQuery {
  projectId?: string;
  categoryId?: string;
  unitId?: string;
  ratePlanCode?: string;
  startDate: Date;
  endDate: Date;
  guests: number;
}

export interface PricingTraceNight {
  date: string; // YYYY-MM-DD
  baseRateThb: number;
  effectiveRateThb: number;
  sourceTrace: string[];
}

export interface EffectiveStayOffer {
  projectId: string;
  categoryId?: string;
  unitId?: string;
  ratePlanCode: string;
  nightsCount: number;
  nightlyBreakdown: PricingTraceNight[];
  subtotalThb: number;
  vatTaxThb: number; // Thailand VAT at the configured finance.vat_pct
  totalThb: number;
  minNights: number;
  cancellationPolicyKey: string;
  availableCapacity: number;
  isAvailable: boolean;
}

/**
 * Flexible Multi-Inventory Revenue, Tariff, Stay Rules, Tax & Quotation Engine
 *
 * Resolves Effective Stay Offers across single condo units, standalone villas,
 * category-booked hotel/resort rooms, or mixed property inventory.
 */
export async function resolveEffectiveStayOffer(
  db: PrismaClient,
  query: StayOfferQuery
): Promise<EffectiveStayOffer> {
  const { projectId, categoryId, unitId, ratePlanCode = 'BAR', startDate, endDate, guests } = query;

  // Resolve Physical / Category Inventory
  let targetUnit: any = null;
  let targetCategory: any = null;
  let targetProject: any = null;

  if (unitId) {
    targetUnit = await db.unit.findUnique({
      where: { id: unitId },
      include: {
        project: true,
        inventoryCategory: true,
        pricingRules: true,
        blockedDates: true,
      },
    });
    if (targetUnit) {
      targetProject = targetUnit.project;
      targetCategory = targetUnit.inventoryCategory;
    }
  } else if (categoryId) {
    targetCategory = await db.inventoryCategory.findUnique({
      where: { id: categoryId },
      include: {
        project: true,
        units: {
          include: {
            blockedDates: true,
            pricingRules: true,
          },
        },
      },
    });
    if (targetCategory) {
      targetProject = targetCategory.project;
    }
  } else if (projectId) {
    targetProject = await db.project.findUnique({
      where: { id: projectId },
    });
  }

  const resolvedProjectId = targetProject?.id || projectId || 'unknown-project';

  // Base Nightly Rate resolution
  let baseNightlyRate = 0;
  let defaultMinNights = 1;
  let defaultCancellationKey = 'flexible';

  if (targetUnit) {
    baseNightlyRate = targetUnit.baseNightlyThb || 0;
    defaultMinNights = targetUnit.minNights || 1;
    defaultCancellationKey = targetUnit.cancellationPolicyKey || 'flexible';
  } else if (targetCategory) {
    baseNightlyRate = targetCategory.baseNightlyThb || 0;
    defaultMinNights = targetCategory.minNights || 1;
    defaultCancellationKey = targetCategory.cancellationPolicyKey || 'flexible';
  }

  // Calculate dates & night count
  const start = new Date(startDate);
  const end = new Date(endDate);
  const nightsCount = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24)));

  // Every rate below is a registered parameter (doc 04), resolved at the
  // project scope for this quote. CLAUDE.md admits no exception: a commission,
  // fee, rate or cap that is compiled in cannot be changed without a deploy,
  // and VAT in particular is a statutory number that has moved before.
  const configScope = targetProject ? { projectId: targetProject.id } : undefined;
  const vatPct = (await getConfig(db, 'finance.vat_pct', configScope)) ?? 0;
  const nonRefundableDiscountPct =
    (await getConfig(db, 'pricing.rate_plan.non_refundable_discount_pct', configScope)) ?? 0;
  const weeklyDiscountPct =
    (await getConfig(db, 'pricing.rate_plan.weekly_discount_pct', configScope)) ?? 0;
  const weeklyMinNights =
    (await getConfig(db, 'pricing.rate_plan.weekly_min_nights', configScope)) ?? 7;

  const nightlyBreakdown: PricingTraceNight[] = [];
  let subtotalThb = 0;

  for (let i = 0; i < nightsCount; i++) {
    const curDate = new Date(start);
    curDate.setDate(curDate.getDate() + i);
    // Through the canonical date module rather than a fourth hand-rolled
    // `toISOString().slice(0, 10)` (T-052). These are booking calendar days —
    // the `@db.Date` semantics `toCalendarDay` is built for — so the UTC read
    // is the correct one here, and is what the rest of the booking code does.
    const dateStr = toCalendarDay(curDate);

    const sourceTrace: string[] = [];
    let nightRate = baseNightlyRate;

    if (targetCategory) {
      sourceTrace.push(`Category (${targetCategory.name}) base: ${formatBaht(baseNightlyRate)}`);
    } else if (targetUnit) {
      sourceTrace.push(`Unit (${targetUnit.name}) base: ${formatBaht(baseNightlyRate)}`);
    }

    // Check specific unit pricing rule overrides if unit exists
    if (targetUnit?.pricingRules) {
      const overrideRule = targetUnit.pricingRules.find(
        (r: any) => new Date(r.startDate) <= curDate && new Date(r.endDate) >= curDate
      );
      if (overrideRule) {
        nightRate = overrideRule.nightlyThb;
        sourceTrace.push(
          `Specific Unit override (${overrideRule.label || 'seasonal'}): ${formatBaht(overrideRule.nightlyThb)}`
        );
      }
    }

    // Apply Rate Plan Derivation (e.g., Non-refundable -10%)
    if (ratePlanCode === 'NON_REFUNDABLE') {
      nightRate = Math.round(nightRate * (1 - nonRefundableDiscountPct / 100));
      sourceTrace.push(`Rate Plan NON_REFUNDABLE (-${nonRefundableDiscountPct}%)`);
    } else if (ratePlanCode === 'WEEKLY' && nightsCount >= weeklyMinNights) {
      nightRate = Math.round(nightRate * (1 - weeklyDiscountPct / 100));
      sourceTrace.push(`Rate Plan WEEKLY (-${weeklyDiscountPct}%)`);
    }

    subtotalThb += nightRate;
    nightlyBreakdown.push({
      date: dateStr,
      baseRateThb: baseNightlyRate,
      effectiveRateThb: nightRate,
      sourceTrace,
    });
  }

  const vatTaxThb = Math.round(subtotalThb * (vatPct / 100));
  const totalThb = subtotalThb + vatTaxThb;

  // Capacity calculation
  let availableCapacity = 1;
  let isAvailable = true;

  if (targetCategory) {
    const totalPhysicalUnits = targetCategory.units ? targetCategory.units.length : 0;
    const outOfServiceUnits = targetCategory.units
      ? targetCategory.units.filter((u: any) => u.status === 'paused' || u.assetStatus === 'suspended').length
      : 0;
    availableCapacity = Math.max(0, totalPhysicalUnits - outOfServiceUnits);
    const exceedsCapacity = targetCategory.maxGuests !== undefined && guests > targetCategory.maxGuests;
    isAvailable = availableCapacity > 0 && !exceedsCapacity;
  } else if (targetUnit) {
    const isUnitBlocked = targetUnit.blockedDates
      ? targetUnit.blockedDates.some(
          (b: any) => new Date(b.startDate) < end && new Date(b.endDate) > start
        )
      : false;
    const exceedsCapacity = targetUnit.maxGuests !== undefined && guests > targetUnit.maxGuests;
    isAvailable = !isUnitBlocked && targetUnit.status === 'live' && !exceedsCapacity;
    availableCapacity = isAvailable ? 1 : 0;
  }

  return {
    projectId: resolvedProjectId,
    categoryId,
    unitId,
    ratePlanCode,
    nightsCount,
    nightlyBreakdown,
    subtotalThb,
    vatTaxThb,
    totalThb,
    minNights: defaultMinNights,
    cancellationPolicyKey: defaultCancellationKey,
    availableCapacity,
    isAvailable,
  };
}
