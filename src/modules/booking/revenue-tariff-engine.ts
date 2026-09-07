import { PrismaClient } from '@prisma/client';

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
  vatTaxThb: number; // Configured Thailand VAT 7%
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

  const nightlyBreakdown: PricingTraceNight[] = [];
  let subtotalThb = 0;

  for (let i = 0; i < nightsCount; i++) {
    const curDate = new Date(start);
    curDate.setDate(curDate.getDate() + i);
    const dateStr = curDate.toISOString().slice(0, 10);

    const sourceTrace: string[] = [];
    let nightRate = baseNightlyRate;

    if (targetCategory) {
      sourceTrace.push(`Category (${targetCategory.name}) base: ฿${baseNightlyRate.toLocaleString()}`);
    } else if (targetUnit) {
      sourceTrace.push(`Unit (${targetUnit.name}) base: ฿${baseNightlyRate.toLocaleString()}`);
    }

    // Check specific unit pricing rule overrides if unit exists
    if (targetUnit?.pricingRules) {
      const overrideRule = targetUnit.pricingRules.find(
        (r: any) => new Date(r.startDate) <= curDate && new Date(r.endDate) >= curDate
      );
      if (overrideRule) {
        nightRate = overrideRule.nightlyThb;
        sourceTrace.push(`Specific Unit override (${overrideRule.label || 'seasonal'}): ฿${overrideRule.nightlyThb.toLocaleString()}`);
      }
    }

    // Apply Rate Plan Derivation (e.g., Non-refundable -10%)
    if (ratePlanCode === 'NON_REFUNDABLE') {
      nightRate = Math.round(nightRate * 0.9);
      sourceTrace.push('Rate Plan NON_REFUNDABLE (-10%)');
    } else if (ratePlanCode === 'WEEKLY' && nightsCount >= 7) {
      nightRate = Math.round(nightRate * 0.85);
      sourceTrace.push('Rate Plan WEEKLY (-15%)');
    }

    subtotalThb += nightRate;
    nightlyBreakdown.push({
      date: dateStr,
      baseRateThb: baseNightlyRate,
      effectiveRateThb: nightRate,
      sourceTrace,
    });
  }

  // Thailand VAT Tax 7%
  const vatTaxThb = Math.round(subtotalThb * 0.07);
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
