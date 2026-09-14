import { describe, it, expect, vi } from 'vitest';
import { resolveEffectiveStayOffer } from './revenue-tariff-engine';

/**
 * The rate plans and VAT are registered config parameters (doc 04), not
 * constants, so every quote resolves them through `getConfig`. These mocks
 * stand in for the seeded `ConfigParameter` defaults — no override rows, so
 * resolution falls through to the default, which is what a fresh project sees.
 *
 * `configDefaults` is deliberately overridable per test: a quote priced with a
 * different VAT rate is the property that matters, and it cannot be asserted
 * against a hard-coded 7%.
 */
const CONFIG_DEFAULTS: Record<string, number> = {
  'finance.vat_pct': 7,
  'pricing.rate_plan.non_refundable_discount_pct': 10,
  'pricing.rate_plan.weekly_discount_pct': 15,
  'pricing.rate_plan.weekly_min_nights': 7,
};

function configMock(overrides: Record<string, number> = {}) {
  const values = { ...CONFIG_DEFAULTS, ...overrides };
  return {
    configOverride: { findUnique: vi.fn().mockResolvedValue(null) },
    configParameter: {
      findUnique: vi.fn(async ({ where }: any) =>
        where.key in values ? { key: where.key, defaultValue: values[where.key] } : null
      ),
    },
  };
}

describe('Revenue, Tariff, Stay Rules & Quotation Engine E2E Unit Tests (Scenarios A - M)', () => {
  it('Scenario A & B: Individual Condo & Standalone Villa Nightly Quote & VAT 7%', async () => {
    const mockDb: any = {
      ...configMock(),
      unit: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'unit-f706',
          name: 'Condo F706',
          baseNightlyThb: 5000,
          minNights: 2,
          cancellationPolicyKey: 'flexible',
          status: 'live',
          project: { id: 'proj-legendary', name: 'The Title Legendary' },
          pricingRules: [],
          blockedDates: [],
        }),
      },
    };

    const offer = await resolveEffectiveStayOffer(mockDb, {
      unitId: 'unit-f706',
      startDate: new Date('2026-11-01'),
      endDate: new Date('2026-11-03'),
      guests: 2,
    });

    expect(offer.nightsCount).toBe(2);
    expect(offer.subtotalThb).toBe(10000);
    expect(offer.vatTaxThb).toBe(700); // 7% of 10000
    expect(offer.totalThb).toBe(10700);
    expect(offer.isAvailable).toBe(true);
    expect(offer.nightlyBreakdown[0].sourceTrace[0]).toContain('Condo F706');
  });

  it('Scenario C & E: Resort & Hotel Room Category Capacity', async () => {
    const mockDb: any = {
      ...configMock(),
      inventoryCategory: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'cat-deluxe',
          categoryKey: 'deluxe_king',
          name: 'Deluxe King Room',
          baseNightlyThb: 3000,
          minNights: 1,
          project: { id: 'proj-hotel', name: 'Grand Hotel' },
          units: [
            { id: 'room-101', status: 'live' },
            { id: 'room-102', status: 'live' },
            { id: 'room-103', status: 'live' },
          ],
        }),
      },
    };

    const offer = await resolveEffectiveStayOffer(mockDb, {
      categoryId: 'cat-deluxe',
      startDate: new Date('2026-12-01'),
      endDate: new Date('2026-12-02'),
      guests: 2,
    });

    expect(offer.nightsCount).toBe(1);
    expect(offer.subtotalThb).toBe(3000);
    expect(offer.availableCapacity).toBe(3);
    expect(offer.isAvailable).toBe(true);
  });

  it('Scenario F: Out-of-Service Maintenance Reduces Category Capacity', async () => {
    const mockDb: any = {
      ...configMock(),
      inventoryCategory: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'cat-deluxe',
          categoryKey: 'deluxe_king',
          name: 'Deluxe King Room',
          baseNightlyThb: 3000,
          project: { id: 'proj-hotel' },
          units: [
            { id: 'room-101', status: 'live' },
            { id: 'room-102', status: 'paused', assetStatus: 'suspended' }, // Out of service
            { id: 'room-103', status: 'live' },
          ],
        }),
      },
    };

    const offer = await resolveEffectiveStayOffer(mockDb, {
      categoryId: 'cat-deluxe',
      startDate: new Date('2026-12-01'),
      endDate: new Date('2026-12-02'),
      guests: 2,
    });

    expect(offer.availableCapacity).toBe(2); // Reduced from 3 to 2
  });

  it('Scenario D & H: Specific Unit Tariff Override (Villa Premium)', async () => {
    const mockDb: any = {
      ...configMock(),
      unit: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'villa-9',
          name: 'Villa 9 Premium',
          baseNightlyThb: 30000,
          status: 'live',
          project: { id: 'proj-resort' },
          pricingRules: [
            {
              startDate: new Date('2026-12-20'),
              endDate: new Date('2027-01-05'),
              nightlyThb: 42000,
              label: 'Festive Season Premium',
            },
          ],
          blockedDates: [],
        }),
      },
    };

    const offer = await resolveEffectiveStayOffer(mockDb, {
      unitId: 'villa-9',
      startDate: new Date('2026-12-24'),
      endDate: new Date('2026-12-25'),
      guests: 8,
    });

    expect(offer.subtotalThb).toBe(42000);
    expect(offer.nightlyBreakdown[0].sourceTrace.some((s) => s.includes('Festive Season Premium'))).toBe(true);
  });

  it('Scenario K: Rate Plan Derivations (Non-Refundable & Weekly)', async () => {
    const mockDb: any = {
      ...configMock(),
      unit: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'unit-1',
          baseNightlyThb: 10000,
          status: 'live',
          project: { id: 'p1' },
          pricingRules: [],
          blockedDates: [],
        }),
      },
    };

    const nonRefOffer = await resolveEffectiveStayOffer(mockDb, {
      unitId: 'unit-1',
      ratePlanCode: 'NON_REFUNDABLE',
      startDate: new Date('2026-11-01'),
      endDate: new Date('2026-11-02'),
      guests: 2,
    });

    expect(nonRefOffer.subtotalThb).toBe(9000); // 10000 - 10%
    expect(nonRefOffer.nightlyBreakdown[0].sourceTrace.some((s) => s.includes('NON_REFUNDABLE'))).toBe(true);

    const weeklyOffer = await resolveEffectiveStayOffer(mockDb, {
      unitId: 'unit-1',
      ratePlanCode: 'WEEKLY',
      startDate: new Date('2026-11-01'),
      endDate: new Date('2026-11-08'), // 7 nights
      guests: 2,
    });

    expect(weeklyOffer.nightsCount).toBe(7);
    expect(weeklyOffer.subtotalThb).toBe(59500); // 7 * 8500 (85% of 10000)
  });

  it('Scenario I, J, L, M: Mixed Property Quoting & Multi-Night Breakdown Traceability', async () => {
    const mockDb: any = {
      ...configMock(),
      unit: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'penthouse-1',
          name: 'The Penthouse',
          baseNightlyThb: 50000,
          status: 'live',
          project: { id: 'mixed-proj' },
          pricingRules: [],
          blockedDates: [],
        }),
      },
    };

    const offer = await resolveEffectiveStayOffer(mockDb, {
      unitId: 'penthouse-1',
      startDate: new Date('2026-12-01'),
      endDate: new Date('2026-12-04'),
      guests: 4,
    });

    expect(offer.nightsCount).toBe(3);
    expect(offer.subtotalThb).toBe(150000);
    expect(offer.nightlyBreakdown.length).toBe(3);
    expect(offer.nightlyBreakdown[0].sourceTrace.length).toBeGreaterThan(0);
  });

  /**
   * The reason the rates moved into config at all.
   *
   * VAT was written as `subtotalThb * 0.07` and the rate-plan discounts as
   * `* 0.9` / `* 0.85`. Thailand's VAT is a statutory rate that has been
   * temporarily reduced before, a project may sit outside the VAT net, and a
   * discount is a commercial lever an operator should be able to move without
   * a deploy. CLAUDE.md's configuration rule admits no exception.
   *
   * A test that asserts 7% against a hard-coded 7% proves nothing. This one
   * changes the parameter and requires the quote to follow.
   */
  it('prices a stay at whatever VAT rate is configured, not a compiled-in 7%', async () => {
    const unit = {
      id: 'unit-f706',
      name: 'Condo F706',
      baseNightlyThb: 5000,
      minNights: 2,
      cancellationPolicyKey: 'flexible',
      status: 'live',
      project: { id: 'proj-legendary', name: 'The Title Legendary' },
      pricingRules: [],
      blockedDates: [],
    };
    const query = {
      unitId: 'unit-f706',
      startDate: new Date('2026-11-01'),
      endDate: new Date('2026-11-03'),
      guests: 2,
    };

    const zeroRated = await resolveEffectiveStayOffer(
      { ...configMock({ 'finance.vat_pct': 0 }), unit: { findUnique: vi.fn().mockResolvedValue(unit) } } as any,
      query
    );
    expect(zeroRated.vatTaxThb).toBe(0);
    expect(zeroRated.totalThb).toBe(10000);

    const raised = await resolveEffectiveStayOffer(
      { ...configMock({ 'finance.vat_pct': 10 }), unit: { findUnique: vi.fn().mockResolvedValue(unit) } } as any,
      query
    );
    expect(raised.vatTaxThb).toBe(1000);
    expect(raised.totalThb).toBe(11000);
  });

  it('applies the configured rate-plan discount, and names the real number in the trace', async () => {
    const unit = {
      id: 'unit-f706',
      name: 'Condo F706',
      baseNightlyThb: 10000,
      minNights: 1,
      cancellationPolicyKey: 'flexible',
      status: 'live',
      project: { id: 'proj-legendary', name: 'The Title Legendary' },
      pricingRules: [],
      blockedDates: [],
    };

    const offer = await resolveEffectiveStayOffer(
      {
        ...configMock({ 'pricing.rate_plan.non_refundable_discount_pct': 25, 'finance.vat_pct': 0 }),
        unit: { findUnique: vi.fn().mockResolvedValue(unit) },
      } as any,
      {
        unitId: 'unit-f706',
        ratePlanCode: 'NON_REFUNDABLE',
        startDate: new Date('2026-11-01'),
        endDate: new Date('2026-11-02'),
        guests: 2,
      }
    );

    expect(offer.subtotalThb).toBe(7500);
    // The trace is what an operator reads when a guest disputes a price, so it
    // must quote the rate actually applied — not a number frozen in a string.
    expect(offer.nightlyBreakdown[0].sourceTrace).toContain('Rate Plan NON_REFUNDABLE (-25%)');
  });
});
