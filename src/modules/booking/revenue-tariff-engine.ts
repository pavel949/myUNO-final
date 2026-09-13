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
  date: string;
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
  vatTaxThb: number;
  totalThb: number;
  minNights: number;
  cancellationPolicyKey: string;
  availableCapacity: number;
  isAvailable: boolean;
}

async function resolveCanonicalRatePlan(
  db: PrismaClient,
  input: { projectId?: string; categoryId?: string; unitId?: string; code: string }
) {
  if (input.unitId) {
    const unitPlan = await db.ratePlan.findFirst({
      where: { unitId: input.unitId, code: input.code, status: 'active' },
    });
    if (unitPlan) return unitPlan;
  }

  if (input.categoryId) {
    const categoryPlan = await db.ratePlan.findFirst({
      where: { categoryId: input.categoryId, code: input.code, status: 'active' },
    });
    if (categoryPlan) return categoryPlan;
  }

  if (input.projectId) {
    return db.ratePlan.findFirst({
      where: {
        projectId: input.projectId,
        unitId: null,
        categoryId: null,
        code: input.code,
        status: 'active',
      },
    });
  }

  return null;
}

function applyCanonicalRatePlanAdjustment(
  baseRate: number,
  adjustmentType: string | null,
  adjustmentValue: number | null
): number | null {
  if (!adjustmentType || adjustmentValue === null || Number.isNaN(adjustmentValue)) return null;

  switch (adjustmentType) {
    // Signed percentage: -10 = 10% discount, +15 = 15% markup.
    case 'percent':
    case 'percentage':
      return Math.max(0, Math.round(baseRate * (1 + adjustmentValue / 100)));
    case 'percentage_discount':
      return Math.max(0, Math.round(baseRate * (1 - adjustmentValue / 100)));
    case 'percentage_markup':
      return Math.max(0, Math.round(baseRate * (1 + adjustmentValue / 100)));
    // Fixed values are stored in the money domain unit (satang), like the rest
    // of the pricing engine. Signed fixed values therefore work as overrides too.
    case 'fixed':
      return Math.max(0, Math.round(baseRate + adjustmentValue));
    case 'fixed_discount':
      return Math.max(0, Math.round(baseRate - adjustmentValue));
    case 'fixed_markup':
      return Math.max(0, Math.round(baseRate + adjustmentValue));
    default:
      return null;
  }
}

/**
 * Flexible Multi-Inventory Revenue, Tariff, Stay Rules, Tax & Quotation Engine.
 *
 * Canonical precedence:
 * Project → InventoryCategory → Unit → RatePlan → date-specific PricingRule.
 * Legacy config-backed rate-plan discounts remain as a compatibility fallback
 * when no RatePlan record exists yet.
 */
export async function resolveEffectiveStayOffer(
  db: PrismaClient,
  query: StayOfferQuery
): Promise<EffectiveStayOffer> {
  const { projectId, categoryId, unitId, ratePlanCode = 'BAR', startDate, endDate, guests } = query;

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
    if (targetCategory) targetProject = targetCategory.project;
  } else if (projectId) {
    targetProject = await db.project.findUnique({ where: { id: projectId } });
  }

  const resolvedProjectId = targetProject?.id || projectId || 'unknown-project';

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

  const canonicalRatePlan = await resolveCanonicalRatePlan(db, {
    projectId: resolvedProjectId !== 'unknown-project' ? resolvedProjectId : undefined,
    categoryId: targetCategory?.id,
    unitId: targetUnit?.id,
    code: ratePlanCode,
  });

  if (canonicalRatePlan?.minNights) defaultMinNights = canonicalRatePlan.minNights;
  if (canonicalRatePlan?.cancellationPolicyKey) {
    defaultCancellationKey = canonicalRatePlan.cancellationPolicyKey;
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  const nightsCount = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24)));

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
    const dateStr = toCalendarDay(curDate);

    const sourceTrace: string[] = [];
    let nightRate = baseNightlyRate;

    if (targetCategory) {
      sourceTrace.push(`Category (${targetCategory.name}) base: ${formatBaht(baseNightlyRate)}`);
    } else if (targetUnit) {
      sourceTrace.push(`Unit (${targetUnit.name}) base: ${formatBaht(baseNightlyRate)}`);
    }

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

    if (canonicalRatePlan) {
      const adjustmentValue = canonicalRatePlan.adjustmentValue === null
        ? null
        : Number(canonicalRatePlan.adjustmentValue);
      const adjusted = applyCanonicalRatePlanAdjustment(
        nightRate,
        canonicalRatePlan.adjustmentType,
        adjustmentValue
      );
      if (adjusted !== null) {
        nightRate = adjusted;
        sourceTrace.push(
          `RatePlan ${canonicalRatePlan.code} (${canonicalRatePlan.adjustmentType} ${adjustmentValue})`
        );
      } else {
        sourceTrace.push(`RatePlan ${canonicalRatePlan.code}`);
      }
    } else if (ratePlanCode === 'NON_REFUNDABLE') {
      nightRate = Math.round(nightRate * (1 - nonRefundableDiscountPct / 100));
      sourceTrace.push(`Legacy config NON_REFUNDABLE (-${nonRefundableDiscountPct}%)`);
    } else if (ratePlanCode === 'WEEKLY' && nightsCount >= weeklyMinNights) {
      nightRate = Math.round(nightRate * (1 - weeklyDiscountPct / 100));
      sourceTrace.push(`Legacy config WEEKLY (-${weeklyDiscountPct}%)`);
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
    categoryId: targetCategory?.id || categoryId,
    unitId: targetUnit?.id || unitId,
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
