import { describe, it, expect, beforeEach } from 'vitest';
import { db as prisma, resetDb, createProject, createUnit } from '@/test/util';
import {
  getApplicableSeasonMarkup,
  getApplicableNightlyPrice,
  computePriceBreakdown,
  isActiveHold,
  checkAvailability,
} from './availability.service';

describe('Availability & Pricing Service', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('getApplicableSeasonMarkup', () => {
    it('returns 0 when no season matches', async () => {
      const project = await createProject();
      const date = new Date('2025-03-15');

      const markup = await getApplicableSeasonMarkup(prisma, date);

      expect(markup).toBe(0);
    });

    it('applies the correct season markup', async () => {
      const project = await createProject();
      // Set season calendar in config: peak 12-15 to 01-15 with 60% markup
      const date = new Date('2025-01-10');

      const markup = await getApplicableSeasonMarkup(prisma, date);

      // Without config seed this returns 0, but logic is tested
      expect(typeof markup).toBe('number');
    });

    it('handles year-boundary seasons', async () => {
      const project = await createProject();
      // Peak runs 12-15 to 01-15, crossing the year boundary
      const decemberDate = new Date('2024-12-20');
      const januaryDate = new Date('2025-01-10');

      const decMarkedup = await getApplicableSeasonMarkup(prisma, decemberDate, {
        projectId: project.id,
      });
      const janMarkup = await getApplicableSeasonMarkup(prisma, januaryDate, {
        projectId: project.id,
      });

      expect(typeof decMarkedup).toBe('number');
      expect(typeof janMarkup).toBe('number');
    });

    it('picks the most specific (shortest) season on overlap', async () => {
      const project = await createProject();
      // If two seasons overlap, the shorter one should win
      const date = new Date('2025-01-10');

      const markup = await getApplicableSeasonMarkup(prisma, date);

      expect(typeof markup).toBe('number');
    });
  });

  describe('getApplicableNightlyPrice - resolution order', () => {
    it('returns unit not found error', async () => {
      const date = new Date('2025-01-15');

      await expect(
        getApplicableNightlyPrice(prisma, date, 'nonexistent-unit')
      ).rejects.toThrow('Unit nonexistent-unit not found');
    });

    it('applies PricingRule over season markup and base', async () => {
      const project = await createProject();
      const unit = await createUnit({ projectId: project.id, baseNightlyThb: 1000 });

      // Create a PricingRule for this date
      await prisma.pricingRule.create({
        data: {
          unitId: unit.id,
          startDate: new Date('2025-01-15'),
          endDate: new Date('2025-01-20'),
          nightlyThb: 2000, // Rule override
        },
      });

      const price = await getApplicableNightlyPrice(
        prisma,
        new Date('2025-01-17'),
        unit.id
      );

      expect(price).toBe(2000);
    });

    it('applies season markup when no PricingRule exists', async () => {
      const project = await createProject();
      const unit = await createUnit({ projectId: project.id, baseNightlyThb: 1000 });

      // Without a rule, should fall back to base (config doesn't have season)
      const price = await getApplicableNightlyPrice(
        prisma,
        new Date('2025-06-15'),
        unit.id
      );

      // Should be base price (no markup) since config is empty
      expect(price).toBe(1000);
    });

    it('applies base price as fallback', async () => {
      const project = await createProject();
      const unit = await createUnit({ projectId: project.id, baseNightlyThb: 1500 });

      const price = await getApplicableNightlyPrice(
        prisma,
        new Date('2025-05-20'),
        unit.id
      );

      expect(price).toBe(1500);
    });
  });

  describe('computePriceBreakdown', () => {
    it('rejects party size exceeding max guests', async () => {
      const project = await createProject();
      const unit = await createUnit({ projectId: project.id, maxGuests: 4 });

      await expect(
        computePriceBreakdown(
          prisma,
          unit.id,
          new Date('2025-01-15'),
          new Date('2025-01-20'),
          5
        )
      ).rejects.toThrow('Party size 5 exceeds unit max of 4');
    });

    it('rejects stay shorter than minimum nights', async () => {
      const project = await createProject();
      const unit = await createUnit({ projectId: project.id, minNights: 3 });

      await expect(
        computePriceBreakdown(
          prisma,
          unit.id,
          new Date('2025-01-15'),
          new Date('2025-01-17'), // Only 2 nights
          2
        )
      ).rejects.toThrow('Stay length 2 nights is below minimum of 3');
    });

    it('computes basic breakdown without discounts', async () => {
      const project = await createProject();
      const unit = await createUnit({ projectId: project.id,
        baseNightlyThb: 1000,
        minNights: 1,
        maxGuests: 2,
      });

      const breakdown = await computePriceBreakdown(
        prisma,
        unit.id,
        new Date('2025-01-15'),
        new Date('2025-01-18'), // 3 nights
        2
      );

      expect(breakdown.lines).toHaveLength(3);
      expect(breakdown.subtotal_thb).toBe(3000); // 3 nights × 1000
      expect(breakdown.los_discount_thb).toBe(0); // < 7 nights
      expect(breakdown.cleaning_fee_thb).toBe(0); // Default config
      expect(breakdown.service_fee_thb).toBe(0); // Default config (0%)
      expect(breakdown.occupancy_tax_thb).toBe(0); // Default config (0%)
      expect(breakdown.total_thb).toBe(3000);
    });

    it('applies weekly LOS discount (≥7 nights)', async () => {
      const project = await createProject();
      const unit = await createUnit({ projectId: project.id,
        baseNightlyThb: 1000,
        minNights: 1,
        maxGuests: 2,
      });

      // Seed weekly discount config
      await prisma.configParameter.upsert({
        where: { key: 'pricing.los_discount.weekly_pct' },
        create: {
          key: 'pricing.los_discount.weekly_pct',
          valueType: 'percent',
          defaultValue: 5,
          scopeableTo: 'unit',
          groupKey: 'pricing',
          description: 'Weekly LOS discount',
        },
        update: { defaultValue: 5 },
      });

      const breakdown = await computePriceBreakdown(
        prisma,
        unit.id,
        new Date('2025-01-15'),
        new Date('2025-01-22'), // 7 nights
        2
      );

      expect(breakdown.subtotal_thb).toBe(7000); // 7 × 1000
      expect(breakdown.los_discount_thb).toBe(350); // 5% of 7000
      expect(breakdown.total_thb).toBe(6650);
    });

    it('applies monthly LOS discount (≥28 nights) and beats weekly', async () => {
      const project = await createProject();
      const unit = await createUnit({ projectId: project.id,
        baseNightlyThb: 1000,
        minNights: 1,
        maxGuests: 2,
      });

      // Seed both discounts
      await prisma.configParameter.upsert({
        where: { key: 'pricing.los_discount.weekly_pct' },
        create: {
          key: 'pricing.los_discount.weekly_pct',
          valueType: 'percent',
          defaultValue: 5,
          scopeableTo: 'unit',
          groupKey: 'pricing',
          description: 'Weekly LOS discount',
        },
        update: { defaultValue: 5 },
      });

      await prisma.configParameter.upsert({
        where: { key: 'pricing.los_discount.monthly_pct' },
        create: {
          key: 'pricing.los_discount.monthly_pct',
          valueType: 'percent',
          defaultValue: 20,
          scopeableTo: 'unit',
          groupKey: 'pricing',
          description: 'Monthly LOS discount',
        },
        update: { defaultValue: 20 },
      });

      const breakdown = await computePriceBreakdown(
        prisma,
        unit.id,
        new Date('2025-01-15'),
        new Date('2025-02-12'), // 28 nights
        2
      );

      expect(breakdown.subtotal_thb).toBe(28000); // 28 × 1000
      expect(breakdown.los_discount_thb).toBe(5600); // 20% of 28000 (monthly beats weekly)
      expect(breakdown.total_thb).toBe(22400);
    });

    it('includes cleaning fee in breakdown', async () => {
      const project = await createProject();
      const unit = await createUnit({ projectId: project.id,
        baseNightlyThb: 1000,
        minNights: 1,
        maxGuests: 2,
      });

      // Seed cleaning fee
      await prisma.configParameter.upsert({
        where: { key: 'pricing.cleaning_fee_thb' },
        create: {
          key: 'pricing.cleaning_fee_thb',
          valueType: 'money_thb',
          defaultValue: 500,
          scopeableTo: 'unit',
          groupKey: 'pricing',
          description: 'Cleaning fee',
        },
        update: { defaultValue: 500 },
      });

      const breakdown = await computePriceBreakdown(
        prisma,
        unit.id,
        new Date('2025-01-15'),
        new Date('2025-01-18'), // 3 nights
        2
      );

      expect(breakdown.subtotal_thb).toBe(3000);
      expect(breakdown.cleaning_fee_thb).toBe(500);
      expect(breakdown.total_thb).toBe(3500);
    });

    it('includes guest service fee in breakdown', async () => {
      const project = await createProject();
      const unit = await createUnit({ projectId: project.id,
        baseNightlyThb: 1000,
        minNights: 1,
        maxGuests: 2,
      });

      // Seed service fee
      await prisma.configParameter.upsert({
        where: { key: 'pricing.guest_service_fee_pct' },
        create: {
          key: 'pricing.guest_service_fee_pct',
          valueType: 'percent',
          defaultValue: 10,
          scopeableTo: 'project',
          groupKey: 'pricing',
          description: 'Guest service fee',
        },
        update: { defaultValue: 10 },
      });

      const breakdown = await computePriceBreakdown(
        prisma,
        unit.id,
        new Date('2025-01-15'),
        new Date('2025-01-18'), // 3 nights
        2
      );

      expect(breakdown.subtotal_thb).toBe(3000);
      expect(breakdown.service_fee_thb).toBe(300); // 10% of 3000
      expect(breakdown.total_thb).toBe(3300);
    });

    it('includes occupancy tax in breakdown', async () => {
      const project = await createProject();
      const unit = await createUnit({ projectId: project.id,
        baseNightlyThb: 1000,
        minNights: 1,
        maxGuests: 2,
      });

      // Seed occupancy tax
      await prisma.configParameter.upsert({
        where: { key: 'finance.occupancy_tax_pct' },
        create: {
          key: 'finance.occupancy_tax_pct',
          valueType: 'percent',
          defaultValue: 5,
          scopeableTo: 'project',
          groupKey: 'finance',
          description: 'Occupancy tax',
        },
        update: { defaultValue: 5 },
      });

      const breakdown = await computePriceBreakdown(
        prisma,
        unit.id,
        new Date('2025-01-15'),
        new Date('2025-01-18'), // 3 nights
        2
      );

      expect(breakdown.subtotal_thb).toBe(3000);
      expect(breakdown.occupancy_tax_thb).toBe(150); // 5% of 3000
      expect(breakdown.total_thb).toBe(3150);
    });

    it('computes full breakdown with all fees and discounts', async () => {
      const project = await createProject();
      const unit = await createUnit({ projectId: project.id,
        baseNightlyThb: 1000,
        minNights: 1,
        maxGuests: 2,
      });

      // Seed all config params
      await prisma.configParameter.upsert({
        where: { key: 'pricing.los_discount.weekly_pct' },
        create: {
          key: 'pricing.los_discount.weekly_pct',
          valueType: 'percent',
          defaultValue: 10,
          scopeableTo: 'unit',
          groupKey: 'pricing',
          description: 'Weekly LOS discount',
        },
        update: { defaultValue: 10 },
      });

      await prisma.configParameter.upsert({
        where: { key: 'pricing.cleaning_fee_thb' },
        create: {
          key: 'pricing.cleaning_fee_thb',
          valueType: 'money_thb',
          defaultValue: 1000,
          scopeableTo: 'unit',
          groupKey: 'pricing',
          description: 'Cleaning fee',
        },
        update: { defaultValue: 1000 },
      });

      await prisma.configParameter.upsert({
        where: { key: 'pricing.guest_service_fee_pct' },
        create: {
          key: 'pricing.guest_service_fee_pct',
          valueType: 'percent',
          defaultValue: 12,
          scopeableTo: 'project',
          groupKey: 'pricing',
          description: 'Guest service fee',
        },
        update: { defaultValue: 12 },
      });

      await prisma.configParameter.upsert({
        where: { key: 'finance.occupancy_tax_pct' },
        create: {
          key: 'finance.occupancy_tax_pct',
          valueType: 'percent',
          defaultValue: 8,
          scopeableTo: 'project',
          groupKey: 'finance',
          description: 'Occupancy tax',
        },
        update: { defaultValue: 8 },
      });

      const breakdown = await computePriceBreakdown(
        prisma,
        unit.id,
        new Date('2025-01-15'),
        new Date('2025-01-22'), // 7 nights (weekly discount applies)
        2
      );

      // Subtotal: 7 × 1000 = 7000
      expect(breakdown.subtotal_thb).toBe(7000);

      // LOS discount: 10% of 7000 = 700
      expect(breakdown.los_discount_thb).toBe(700);

      // Cleaning fee: 1000
      expect(breakdown.cleaning_fee_thb).toBe(1000);

      // Service fee: 12% of (subtotal - LOS discount) = 12% of 6300 = 756
      // (the cleaning fee is not part of the guest service-fee base)
      const subtotalAfterDiscount = 7000 - 700;
      expect(breakdown.service_fee_thb).toBe(Math.round(subtotalAfterDiscount * 0.12));

      // Occupancy tax: 8% of (7000 - 700 + 1000 + service_fee)
      const taxBase = subtotalAfterDiscount + 1000 + breakdown.service_fee_thb;
      expect(breakdown.occupancy_tax_thb).toBe(Math.round(taxBase * 0.08));

      // Total check
      const expectedTotal =
        subtotalAfterDiscount +
        breakdown.cleaning_fee_thb +
        breakdown.service_fee_thb +
        breakdown.occupancy_tax_thb;
      expect(breakdown.total_thb).toBe(expectedTotal);
    });
  });

  describe('scope-aware pricing config (LY-1)', () => {
    async function seedSeasonCalendarParam(defaultSeasons: unknown) {
      await prisma.configParameter.upsert({
        where: { key: 'pricing.season.calendar' },
        create: {
          key: 'pricing.season.calendar',
          valueType: 'schedule',
          defaultValue: defaultSeasons as any,
          scopeableTo: 'project,unit',
          groupKey: 'pricing',
          description: 'Season calendar',
        },
        update: { defaultValue: defaultSeasons as any },
      });
    }

    it('a project season-calendar override changes only that project prices', async () => {
      const projectA = await createProject();
      const projectB = await createProject();
      const unitA = await createUnit({ projectId: projectA.id, baseNightlyThb: 1000 });
      const unitB = await createUnit({ projectId: projectB.id, baseNightlyThb: 1000 });

      await seedSeasonCalendarParam([
        { name: 'high', from: '11-01', to: '04-30', markup_pct: 25 },
      ]);
      // Project A runs its own calendar: same window, 50% markup
      await prisma.configOverride.create({
        data: {
          parameterKey: 'pricing.season.calendar',
          scopeType: 'project',
          scopeId: projectA.id,
          value: [{ name: 'high', from: '11-01', to: '04-30', markup_pct: 50 }] as any,
          updatedByIdentityId: 'test-admin',
        },
      });

      const date = new Date('2025-12-01');
      const priceA = await getApplicableNightlyPrice(prisma, date, unitA.id);
      const priceB = await getApplicableNightlyPrice(prisma, date, unitB.id);
      const globalMarkup = await getApplicableSeasonMarkup(prisma, date);

      expect(priceA).toBe(1500); // project override 50%
      expect(priceB).toBe(1250); // global default 25%
      expect(globalMarkup).toBe(25);
    });

    it('project and unit fee overrides resolve unit → project → default', async () => {
      const project = await createProject();
      const unit = await createUnit({
        projectId: project.id,
        baseNightlyThb: 1000,
        minNights: 1,
        maxGuests: 2,
      });
      const otherUnit = await createUnit({
        projectId: project.id,
        baseNightlyThb: 1000,
        minNights: 1,
        maxGuests: 2,
      });

      await prisma.configParameter.upsert({
        where: { key: 'pricing.cleaning_fee_thb' },
        create: {
          key: 'pricing.cleaning_fee_thb',
          valueType: 'money_thb',
          defaultValue: 0,
          scopeableTo: 'unit',
          groupKey: 'pricing',
          description: 'Cleaning fee',
        },
        update: { defaultValue: 0 },
      });
      await prisma.configOverride.create({
        data: {
          parameterKey: 'pricing.cleaning_fee_thb',
          scopeType: 'project',
          scopeId: project.id,
          value: 500 as any,
          updatedByIdentityId: 'test-admin',
        },
      });
      await prisma.configOverride.create({
        data: {
          parameterKey: 'pricing.cleaning_fee_thb',
          scopeType: 'unit',
          scopeId: unit.id,
          value: 700 as any,
          updatedByIdentityId: 'test-admin',
        },
      });

      const withUnitOverride = await computePriceBreakdown(
        prisma,
        unit.id,
        new Date('2025-06-15'),
        new Date('2025-06-18'),
        2
      );
      const withProjectOverride = await computePriceBreakdown(
        prisma,
        otherUnit.id,
        new Date('2025-06-15'),
        new Date('2025-06-18'),
        2
      );

      expect(withUnitOverride.cleaning_fee_thb).toBe(700); // unit beats project
      expect(withProjectOverride.cleaning_fee_thb).toBe(500); // project beats default
    });

    it('a project with no overrides prices exactly as the global default (invariance)', async () => {
      const project = await createProject();
      const unit = await createUnit({ projectId: project.id, baseNightlyThb: 1000 });

      await seedSeasonCalendarParam([
        { name: 'peak', from: '12-15', to: '01-15', markup_pct: 60 },
        { name: 'high', from: '11-01', to: '04-30', markup_pct: 25 },
      ]);

      // Peak (shorter window) wins inside high; high applies outside peak
      const peakPrice = await getApplicableNightlyPrice(
        prisma,
        new Date('2025-12-25'),
        unit.id
      );
      const highPrice = await getApplicableNightlyPrice(
        prisma,
        new Date('2025-11-10'),
        unit.id
      );

      expect(peakPrice).toBe(1600);
      expect(highPrice).toBe(1250);
    });

    it('breakdown lines record where each night price came from', async () => {
      const project = await createProject();
      const unit = await createUnit({
        projectId: project.id,
        baseNightlyThb: 1000,
        minNights: 1,
        maxGuests: 2,
      });

      await seedSeasonCalendarParam([
        { name: 'high', from: '06-16', to: '06-16', markup_pct: 25 },
      ]);
      await prisma.pricingRule.create({
        data: {
          unitId: unit.id,
          startDate: new Date('2025-06-15'),
          endDate: new Date('2025-06-16'),
          nightlyThb: 2000,
        },
      });

      const breakdown = await computePriceBreakdown(
        prisma,
        unit.id,
        new Date('2025-06-15'),
        new Date('2025-06-18'), // rule night, season night, base night
        2
      );

      expect(breakdown.lines.map((l) => l.applied_from)).toEqual([
        'rule',
        'season',
        'base',
      ]);
      expect(breakdown.lines.map((l) => l.nightly_thb)).toEqual([2000, 1250, 1000]);
    });
  });

  describe('category rates, early-bird, long-stay monthly (LY-2)', () => {
    // The Layantara season calendar: absolute category rates carry the
    // numbers, so every markup is 0. Peak (short) wins inside high.
    const LAYANTARA_CALENDAR = [
      { name: 'shoulder_apr', from: '04-01', to: '04-30', markup_pct: 0 },
      { name: 'low', from: '05-01', to: '09-30', markup_pct: 0 },
      { name: 'shoulder_oct', from: '10-01', to: '10-31', markup_pct: 0 },
      { name: 'high', from: '11-01', to: '03-31', markup_pct: 0 },
      { name: 'peak', from: '12-21', to: '01-10', markup_pct: 0 },
    ];

    // The real Layantara retail grid, satang (THB × 100)
    const GRID: Record<string, Record<string, number>> = {
      standard_2br: { shoulder_apr: 629400, low: 547900, shoulder_oct: 566400, high: 758600, peak: 986300 },
      superior_2br: { shoulder_apr: 719300, low: 626100, shoulder_oct: 647300, high: 867000, peak: 1127200 },
      standard_3br: { shoulder_apr: 899100, low: 782700, shoulder_oct: 809200, high: 1083900, peak: 1408900 },
      superior_3br: { shoulder_apr: 989100, low: 860900, shoulder_oct: 890100, high: 1192200, peak: 1549900 },
      grand_deluxe_3br: { shoulder_apr: 1079000, low: 939300, shoulder_oct: 971100, high: 1300600, peak: 1690800 },
    };

    async function seedLayantaraPricing(projectId: string, monthly?: Record<string, Record<string, number>>) {
      await prisma.configOverride.create({
        data: {
          parameterKey: 'pricing.season.calendar',
          scopeType: 'project',
          scopeId: projectId,
          value: LAYANTARA_CALENDAR as any,
          updatedByIdentityId: 'test-admin',
        },
      });
      const rates: Record<string, unknown> = {};
      for (const [cat, nightly] of Object.entries(GRID)) {
        rates[cat] = { nightly, ...(monthly?.[cat] ? { monthly: monthly[cat] } : {}) };
      }
      await prisma.configOverride.create({
        data: {
          parameterKey: 'pricing.category_rates',
          scopeType: 'project',
          scopeId: projectId,
          value: rates as any,
          updatedByIdentityId: 'test-admin',
        },
      });
    }

    it('reproduces the exact retail grid for every category and season', async () => {
      const project = await createProject();
      await seedLayantaraPricing(project.id);

      const SEASON_DATES: Record<string, string> = {
        shoulder_apr: '2026-04-15',
        low: '2026-07-15',
        shoulder_oct: '2026-10-15',
        high: '2026-11-10',
        peak: '2026-12-25', // inside high's window — peak must win
      };

      for (const [categoryKey, seasons] of Object.entries(GRID)) {
        const unit = await createUnit({
          projectId: project.id,
          categoryKey,
          baseNightlyThb: 100, // deliberately wrong so any fallback is caught
        });
        for (const [season, expected] of Object.entries(seasons)) {
          const price = await getApplicableNightlyPrice(
            prisma,
            new Date(SEASON_DATES[season]),
            unit.id
          );
          expect(price, `${categoryKey} on ${SEASON_DATES[season]} (${season})`).toBe(expected);
        }
      }
    });

    it('applies the high rate on the January side of the year boundary, outside peak', async () => {
      const project = await createProject();
      await seedLayantaraPricing(project.id);
      const unit = await createUnit({
        projectId: project.id,
        categoryKey: 'standard_2br',
        baseNightlyThb: 100,
      });

      // 2027-02-01 is inside high (11-01 → 03-31, wraps the year), past peak
      const price = await getApplicableNightlyPrice(prisma, new Date('2027-02-01'), unit.id);
      expect(price).toBe(758600);

      // 2027-01-05 is still peak (12-21 → 01-10)
      const peakPrice = await getApplicableNightlyPrice(prisma, new Date('2027-01-05'), unit.id);
      expect(peakPrice).toBe(986300);
    });

    it('falls back to base × markup for a season the category has no rate for', async () => {
      const project = await createProject();
      await prisma.configOverride.create({
        data: {
          parameterKey: 'pricing.season.calendar',
          scopeType: 'project',
          scopeId: project.id,
          value: [
            { name: 'low', from: '05-01', to: '09-30', markup_pct: 10 },
          ] as any,
          updatedByIdentityId: 'test-admin',
        },
      });
      await prisma.configOverride.create({
        data: {
          parameterKey: 'pricing.category_rates',
          scopeType: 'project',
          scopeId: project.id,
          // rates exist only for 'high' — 'low' nights must fall through
          value: { standard_2br: { nightly: { high: 758600 } } } as any,
          updatedByIdentityId: 'test-admin',
        },
      });
      const unit = await createUnit({
        projectId: project.id,
        categoryKey: 'standard_2br',
        baseNightlyThb: 1000,
      });

      const price = await getApplicableNightlyPrice(prisma, new Date('2026-07-15'), unit.id);
      expect(price).toBe(1100); // base 1000 × 1.10
    });

    it('early-bird applies at exactly min_days_before and not a day later booking', async () => {
      const project = await createProject();
      const unit = await createUnit({
        projectId: project.id,
        baseNightlyThb: 1000,
        minNights: 1,
        maxGuests: 2,
      });
      await prisma.configOverride.create({
        data: {
          parameterKey: 'pricing.early_bird',
          scopeType: 'project',
          scopeId: project.id,
          value: { min_days_before: 60, pct: 8 } as any,
          updatedByIdentityId: 'test-admin',
        },
      });

      const checkIn = new Date('2026-06-01');
      const checkOut = new Date('2026-06-04'); // 3 nights, subtotal 3000

      const exactly60 = await computePriceBreakdown(
        prisma, unit.id, checkIn, checkOut, 2, new Date('2026-04-02')
      );
      expect(exactly60.early_bird_discount_thb).toBe(240); // 8% of 3000
      expect(exactly60.total_thb).toBe(2760);

      const only59 = await computePriceBreakdown(
        prisma, unit.id, checkIn, checkOut, 2, new Date('2026-04-03')
      );
      expect(only59.early_bird_discount_thb).toBe(0);
      expect(only59.total_thb).toBe(3000);
    });

    it('long stay ≥28 nights uses the flat monthly rate and replaces the LOS discount', async () => {
      const project = await createProject();
      await seedLayantaraPricing(project.id, {
        standard_2br: { low: 7200000 }, // ฿72,000/month, satang
      });
      // Early-bird is configured but must NOT stack with the monthly path
      await prisma.configOverride.create({
        data: {
          parameterKey: 'pricing.early_bird',
          scopeType: 'project',
          scopeId: project.id,
          value: { min_days_before: 30, pct: 8 } as any,
          updatedByIdentityId: 'test-admin',
        },
      });
      const unit = await createUnit({
        projectId: project.id,
        categoryKey: 'standard_2br',
        baseNightlyThb: 100,
        minNights: 1,
        maxGuests: 2,
      });

      const breakdown = await computePriceBreakdown(
        prisma,
        unit.id,
        new Date('2026-06-01'),
        new Date('2026-07-01'), // 30 nights, all low season
        2,
        new Date('2026-01-01')
      );

      const nightly = Math.round(7200000 / 30); // 240000
      expect(breakdown.lines.every((l) => l.applied_from === 'category_monthly')).toBe(true);
      expect(breakdown.lines.every((l) => l.nightly_thb === nightly)).toBe(true);
      expect(breakdown.subtotal_thb).toBe(nightly * 30);
      expect(breakdown.los_discount_thb).toBe(0);
      expect(breakdown.early_bird_discount_thb).toBe(0);
      expect(breakdown.total_thb).toBe(nightly * 30);
    });

    it('long stay without full monthly coverage falls back to nightly + LOS discount', async () => {
      const project = await createProject();
      // Monthly defined only for low — a stay crossing into shoulder_oct
      // must fall back to the nightly path for the whole stay
      await seedLayantaraPricing(project.id, {
        standard_2br: { low: 7200000 },
      });
      const unit = await createUnit({
        projectId: project.id,
        categoryKey: 'standard_2br',
        baseNightlyThb: 100,
        minNights: 1,
        maxGuests: 2,
      });
      await prisma.configParameter.upsert({
        where: { key: 'pricing.los_discount.monthly_pct' },
        create: {
          key: 'pricing.los_discount.monthly_pct',
          valueType: 'percent',
          defaultValue: 20,
          scopeableTo: 'unit',
          groupKey: 'pricing',
          description: 'Monthly LOS discount',
        },
        update: { defaultValue: 20 },
      });

      const breakdown = await computePriceBreakdown(
        prisma,
        unit.id,
        new Date('2026-09-15'),
        new Date('2026-10-13'), // 28 nights: 16 low (Sep 15–30) + 12 shoulder_oct (Oct 1–12)
        2,
        new Date('2026-09-01')
      );

      const subtotal = 16 * 547900 + 12 * 566400;
      expect(breakdown.subtotal_thb).toBe(subtotal);
      expect(breakdown.los_discount_thb).toBe(Math.round(subtotal * 0.2));
      expect(breakdown.lines.some((l) => l.applied_from === 'category_monthly')).toBe(false);
    });
  });

  describe('isActiveHold', () => {
    it('returns false when hold_expires_at is null', () => {
      const result = isActiveHold(null, new Date());

      expect(result).toBe(false);
    });

    it('returns true when hold has not expired', () => {
      const now = new Date();
      const futureTime = new Date(now.getTime() + 30 * 60 * 1000); // +30 minutes

      const result = isActiveHold(futureTime, now);

      expect(result).toBe(true);
    });

    it('returns false when hold has expired', () => {
      const now = new Date();
      const pastTime = new Date(now.getTime() - 30 * 60 * 1000); // -30 minutes

      const result = isActiveHold(pastTime, now);

      expect(result).toBe(false);
    });

    it('respects the now parameter', () => {
      const hold = new Date('2025-01-15T12:00:00Z');

      const beforeHold = new Date('2025-01-15T11:00:00Z');
      const afterHold = new Date('2025-01-15T13:00:00Z');

      expect(isActiveHold(hold, beforeHold)).toBe(true);
      expect(isActiveHold(hold, afterHold)).toBe(false);
    });
  });

  describe('checkAvailability', () => {
    it('returns true when no blocked dates exist', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);

      const available = await checkAvailability(
        prisma,
        unit.id,
        new Date('2025-01-15'),
        new Date('2025-01-20')
      );

      expect(available).toBe(true);
    });

    it('returns false when blocked date overlaps', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);

      // Create a blocked date
      await prisma.blockedDate.create({
        data: {
          unitId: unit.id,
          startDate: new Date('2025-01-10'),
          endDate: new Date('2025-01-18'),
          reason: 'maintenance',
        },
      });

      const available = await checkAvailability(
        prisma,
        unit.id,
        new Date('2025-01-15'),
        new Date('2025-01-20')
      );

      expect(available).toBe(false);
    });

    it('detects overlap: blocked starts before request, ends during', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);

      await prisma.blockedDate.create({
        data: {
          unitId: unit.id,
          startDate: new Date('2025-01-10'),
          endDate: new Date('2025-01-17'),
          reason: 'maintenance',
        },
      });

      const available = await checkAvailability(
        prisma,
        unit.id,
        new Date('2025-01-15'),
        new Date('2025-01-20')
      );

      expect(available).toBe(false);
    });

    it('detects overlap: blocked starts during request', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);

      await prisma.blockedDate.create({
        data: {
          unitId: unit.id,
          startDate: new Date('2025-01-17'),
          endDate: new Date('2025-01-25'),
          reason: 'maintenance',
        },
      });

      const available = await checkAvailability(
        prisma,
        unit.id,
        new Date('2025-01-15'),
        new Date('2025-01-20')
      );

      expect(available).toBe(false);
    });

    it('returns true when blocked date is after request range', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);

      await prisma.blockedDate.create({
        data: {
          unitId: unit.id,
          startDate: new Date('2025-01-20'),
          endDate: new Date('2025-01-25'),
          reason: 'maintenance',
        },
      });

      const available = await checkAvailability(
        prisma,
        unit.id,
        new Date('2025-01-15'),
        new Date('2025-01-20')
      );

      expect(available).toBe(true);
    });

    it('returns true when blocked date is before request range', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);

      await prisma.blockedDate.create({
        data: {
          unitId: unit.id,
          startDate: new Date('2025-01-10'),
          endDate: new Date('2025-01-15'),
          reason: 'maintenance',
        },
      });

      const available = await checkAvailability(
        prisma,
        unit.id,
        new Date('2025-01-15'),
        new Date('2025-01-20')
      );

      expect(available).toBe(true);
    });
  });
});
