import { Prisma, PrismaClient } from '@prisma/client';
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
  const ratePlan = (db as any).ratePlan;
  if (!ratePlan?.findFirst) return null;

  if (input.unitId) {
    const unitPlan = await ratePlan.findFirst({
      where: { unitId: input.unitId, code: input.code, status: 'active' },
    });
    if (unitPlan) return unitPlan;
  }

  if (input.categoryId) {
    const categoryPlan = await ratePlan.findFirst({
      where: { categoryId: input.categoryId, code: input.code, status: 'active' },
    });
    if (categoryPlan) return categoryPlan;
  }

  if (input.projectId) {
    return ratePlan.findFirst({
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
    case 'percent':
    case 'percentage':
      return Math.max(0, Math.round(baseRate * (1 + adjustmentValue / 100)));
    case 'percentage_discount':
      return Math.max(0, Math.round(baseRate * (1 - adjustmentValue / 100)));
    case 'percentage_markup':
      return Math.max(0, Math.round(baseRate * (1 + adjustmentValue / 100)));
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
 * Canonical stay quotation engine.
 *
 * Source of truth:
 * Project -> InventoryCategory -> Unit -> RatePlan -> date-specific PricingRule.
 *
 * Once a unit is linked to InventoryCategory, category commercial facts are
 * authoritative. Unit.baseNightlyThb/minNights/cancellationPolicyKey are only a
 * compatibility fallback for not-yet-migrated draft inventory.
 */
export async function resolveEffectiveStayOffer(
  db: PrismaClient,
  query: StayOfferQuery
): Promise<EffectiveStayOffer> {
  const { projectId, categoryId, unitId, ratePlanCode = 'BAR', startDate, endDate, guests } = query;
  const start = new Date(startDate);
  const end = new Date(endDate);
  const now = new Date();

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
    throw new Error('startDate must be before endDate');
  }

  const blockingBookingWhere: Prisma.BookingWhereInput = {
    startDate: { lt: end },
    endDate: { gt: start },
    OR: [
      { status: { in: ['confirmed', 'checked_in'] } },
      { status: 'pending_payment', holdExpiresAt: { gt: now } },
    ],
  };

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
        bookings: { where: blockingBookingWhere, select: { id: true } },
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
            bookings: { where: blockingBookingWhere, select: { id: true } },
          },
        },
      },
    });
    if (targetCategory) targetProject = targetCategory.project;
  } else if (projectId) {
    targetProject = await db.project.findUnique({ where: { id: projectId } });
  }

  if (!targetProject) throw new Error('Project not found');
  if (unitId && !targetUnit) throw new Error('Unit not found');
  if (categoryId && !targetCategory) throw new Error('Inventory category not found');

  if (projectId && targetProject.id !== projectId) {
    throw new Error('Inventory does not belong to the requested project');
  }

  const resolvedProjectId = targetProject.id;

  let baseNightlyRate = 0;
  let defaultMinNights = 1;
  let defaultCancellationKey = 'flexible';

  if (targetCategory) {
    baseNightlyRate = targetCategory.baseNightlyThb || 0;
    defaultMinNights = targetCategory.minNights || 1;
    defaultCancellationKey = targetCategory.cancellationPolicyKey || 'flexible';
  } else if (targetUnit) {
    baseNightlyRate = targetUnit.baseNightlyThb || 0;
    defaultMinNights = targetUnit.minNights || 1;
    defaultCancellationKey = targetUnit.cancellationPolicyKey || 'flexible';
  }

  const canonicalRatePlan = await resolveCanonicalRatePlan(db, {
    projectId: resolvedProjectId,
    categoryId: targetCategory?.id,
    unitId: targetUnit?.id,
    code: ratePlanCode,
  });

  if (canonicalRatePlan?.minNights) defaultMinNights = canonicalRatePlan.minNights;
  if (canonicalRatePlan?.cancellationPolicyKey) {
    defaultCancellationKey = canonicalRatePlan.cancellationPolicyKey;
  }

  const nightsCount = Math.max(
    1,
    Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24))
  );

  const configScope = { projectId: targetProject.id };
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
      sourceTrace.push(`InventoryCategory (${targetCategory.name}) base: ${formatBaht(baseNightlyRate)}`);
    } else if (targetUnit) {
      sourceTrace.push(`Legacy Unit (${targetUnit.name}) base: ${formatBaht(baseNightlyRate)}`);
    }

    if (targetUnit?.pricingRules) {
      const overrideRule = targetUnit.pricingRules.find(
        (r: any) => new Date(r.startDate) <= curDate && new Date(r.endDate) >= curDate
      );
      if (overrideRule) {
        nightRate = overrideRule.nightlyThb;
        sourceTrace.push(
          `Unit date override (${overrideRule.label || 'seasonal'}): ${formatBaht(overrideRule.nightlyThb)}`
        );
      }
    }

    if (canonicalRatePlan) {
      const adjustmentValue =
        canonicalRatePlan.adjustmentValue === null
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
      sourceTrace.push(`Compatibility rate NON_REFUNDABLE (-${nonRefundableDiscountPct}%)`);
    } else if (ratePlanCode === 'WEEKLY' && nightsCount >= weeklyMinNights) {
      nightRate = Math.round(nightRate * (1 - weeklyDiscountPct / 100));
      sourceTrace.push(`Compatibility rate WEEKLY (-${weeklyDiscountPct}%)`);
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

  const rangeBlocked = (blockedDates: any[]) =>
    blockedDates.some(
      (b: any) => new Date(b.startDate) < end && new Date(b.endDate) > start
    );

  let availableCapacity = 0;
  let isAvailable = false;

  if (targetCategory) {
    const eligibleUnits = (targetCategory.units || []).filter((u: any) => {
      const operational = u.status === 'live' && u.assetStatus !== 'suspended';
      const blocked = rangeBlocked(u.blockedDates || []);
      const booked = (u.bookings || []).length > 0;
      return operational && !blocked && !booked;
    });
    availableCapacity = eligibleUnits.length;
    const exceedsCapacity = guests > targetCategory.maxGuests;
    isAvailable =
      targetProject.status === 'live' &&
      targetCategory.status === 'live' &&
      availableCapacity > 0 &&
      !exceedsCapacity &&
      nightsCount >= defaultMinNights;
  } else if (targetUnit) {
    const blocked = rangeBlocked(targetUnit.blockedDates || []);
    const booked = (targetUnit.bookings || []).length > 0;
    const exceedsCapacity = guests > targetUnit.maxGuests;
    isAvailable =
      targetProject.status === 'live' &&
      targetUnit.status === 'live' &&
      targetUnit.assetStatus !== 'suspended' &&
      !blocked &&
      !booked &&
      !exceedsCapacity &&
      nightsCount >= defaultMinNights;
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
