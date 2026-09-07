import { describe, it, expect, vi } from 'vitest';
import { resolveEffectiveStayOffer } from './revenue-tariff-engine';

describe('Revenue, Tariff, Stay Rules & Quotation Engine E2E Unit Tests (Scenarios A - M)', () => {
  it('Scenario A & B: Individual Condo & Standalone Villa Nightly Quote & VAT 7%', async () => {
    const mockDb: any = {
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
});
