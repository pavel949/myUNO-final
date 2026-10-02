import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/modules/config', () => ({
  getConfig: vi.fn(async (_db: unknown, key: string) => {
    if (key === 'pricing.season.calendar') return [];
    if (key === 'pricing.category_rates') return undefined;
    if (key === 'pricing.early_bird') return { min_days_before: null, pct: 0 };
    if (key === 'pricing.cleaning_fee_thb') return 0;
    if (key === 'pricing.guest_service_fee_pct') return 0;
    if (key === 'finance.occupancy_tax_pct') return 0;
    if (key === 'pricing.los_discount.weekly_pct') return 0;
    if (key === 'pricing.los_discount.monthly_pct') return 0;
    return 0;
  }),
}));

import {
  computeCanonicalCalendarRates,
  computeCanonicalPriceBreakdown,
} from './canonical-pricing.service';

describe('canonical calendar rate parity', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses the exact booking quote lines for identical dates and conditions', async () => {
    const unit = {
      id: 'unit-a',
      projectId: 'project-a',
      inventoryCategoryId: 'category-a',
      status: 'live',
      maxGuests: 4,
      petsAllowed: false,
      maxPets: null,
      minNights: 1,
      baseNightlyThb: 650000,
      categoryKey: null,
      project: {
        id: 'project-a',
        status: 'live',
        timezone: 'Asia/Bangkok',
        projectType: null,
      },
      inventoryCategory: {
        id: 'category-a',
        status: 'live',
        minNights: 1,
        baseNightlyThb: 650000,
        categoryKey: null,
      },
    };
    const db: any = {
      unit: { findUnique: vi.fn().mockResolvedValue(unit) },
      commercialOffering: { findMany: vi.fn().mockResolvedValue([]) },
      ratePlan: { findFirst: vi.fn().mockResolvedValue(null) },
      pricingRule: { findMany: vi.fn().mockResolvedValue([]) },
    };

    const start = new Date('2026-11-01T00:00:00.000Z');
    const end = new Date('2026-11-04T00:00:00.000Z');

    const quote = await computeCanonicalPriceBreakdown(db, 'unit-a', start, end, 1);
    const calendar = await computeCanonicalCalendarRates(db, 'unit-a', start, end, 1);

    expect(calendar.error).toBeNull();
    expect(calendar.lines).toEqual(
      quote.lines.map((line) => ({
        date: line.date,
        nightlyThb: line.nightly_thb,
        source: line.applied_from,
      }))
    );
  });
  it('does not turn a 30-day calendar viewport into a monthly booking quote', async () => {
    const unit = {
      id: 'unit-a',
      projectId: 'project-a',
      inventoryCategoryId: 'category-a',
      status: 'live',
      maxGuests: 4,
      petsAllowed: false,
      maxPets: null,
      minNights: 1,
      baseNightlyThb: 300000,
      categoryKey: 'two_br',
      project: {
        id: 'project-a',
        status: 'live',
        timezone: 'Asia/Bangkok',
        projectType: null,
      },
      inventoryCategory: {
        id: 'category-a',
        status: 'live',
        minNights: 1,
        baseNightlyThb: 300000,
        categoryKey: 'two_br',
      },
    };
    const db: any = {
      unit: { findUnique: vi.fn().mockResolvedValue(unit) },
      commercialOffering: { findMany: vi.fn().mockResolvedValue([]) },
      ratePlan: { findFirst: vi.fn().mockResolvedValue(null) },
      pricingRule: { findMany: vi.fn().mockResolvedValue([]) },
    };

    const start = new Date('2026-11-01T00:00:00.000Z');
    const end = new Date('2026-12-01T00:00:00.000Z');
    const calendar = await computeCanonicalCalendarRates(db, 'unit-a', start, end, 1);

    expect(calendar.error).toBeNull();
    expect(calendar.lines).toHaveLength(30);
    expect(calendar.lines.every((line) => line.source !== 'category_monthly')).toBe(true);
  });

});
