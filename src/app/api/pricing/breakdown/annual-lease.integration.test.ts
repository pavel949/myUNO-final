import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { db, resetDb, createProject, createUnit } from '@/test/util';
import { computePriceBreakdown, LeaseRequestRequiredError } from '@/modules/core';

vi.mock('@/lib/prisma', async () => {
  const util = await import('@/test/util');
  return { prisma: util.db };
});

import { POST } from './route';

/**
 * Founder ruling 2026-10-06 (Layantara Partner Guide): monthly rates apply
 * from 30 nights; the 12-month rate is agreed by lease request, never
 * instant-booked and never priced as twelve monthly blocks.
 */
const flags = { includesTaxes: true, includesServiceCharge: true, includesBreakfast: false, sourceSellable: true };
const daily = { sourceRateId: 'all', seasonCode: 'ALL', dateWindows: [{ start: '01-01', end: '12-31' }],
  rateMode: 'daily', pricingUnit: 'night', amountSatang: 500_000, currency: 'THB', minimumNights: 1, ...flags };
const monthly = { ...daily, sourceRateId: 'm-all', rateMode: 'monthly', pricingUnit: '30_nights',
  amountSatang: 9_000_000, minimumNights: 30 };
const yearly = { ...daily, sourceRateId: 'year', seasonCode: 'YEAR_CONTRACT', dateWindows: [],
  rateMode: 'yearly', pricingUnit: 'month', amountSatang: 8_000_000, minimumNights: 365 };

describe('annual stays route to a lease request', () => {
  let unitId: string;

  beforeEach(async () => {
    await resetDb();
    const project = await createProject({ status: 'live' });
    const unit = await createUnit({ projectId: project.id, status: 'live', baseNightlyThb: 500_000, maxGuests: 4 });
    unitId = unit.id;
    await db.commercialOffering.updateMany({
      where: { unitId, offeringType: 'short_term_stay' },
      data: { pricingTerms: { quoteEngine: 'canonical_tariff_grid_v1', taxPolicyVerified: true, tariffGrid: [daily] } },
    });
    const short = await db.commercialOffering.findFirstOrThrow({ where: { unitId, offeringType: 'short_term_stay' } });
    await db.commercialOffering.create({
      data: {
        unitId, projectId: short.projectId, offeringType: 'long_term_rental', status: 'active',
        pricingTerms: { quoteEngine: 'canonical_tariff_grid_v1', taxPolicyVerified: true, tariffGrid: [monthly, yearly] },
      },
    });
  });

  const day = (s: string) => new Date(s + 'T00:00:00Z');

  it('prices 40 nights from the monthly rate, per 30 nights', async () => {
    const quote = await computePriceBreakdown(db, unitId, day('2027-05-01'), day('2027-06-10'), 2);
    expect(quote.subtotal_thb).toBe(12_000_000);
    expect(quote.lines.every(line => line.applied_from === 'category_monthly')).toBe(true);
  });

  it('refuses to price 365 nights as monthly blocks', async () => {
    await expect(computePriceBreakdown(db, unitId, day('2027-05-01'), day('2028-04-30'), 2))
      .rejects.toBeInstanceOf(LeaseRequestRequiredError);
  });

  it('tells the unit page to show the lease request, not a price', async () => {
    const res = await POST(new NextRequest('http://localhost/api/pricing/breakdown', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unitId, startDate: '2027-05-01', endDate: '2028-04-30', guestCount: 2 }),
    }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('lease_request_required');
  });

  it('a stay past a year is still a lease request, not a server error', async () => {
    const res = await POST(new NextRequest('http://localhost/api/pricing/breakdown', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unitId, startDate: '2027-05-01', endDate: '2028-05-10', guestCount: 2 }),
    }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('lease_request_required');
  });

  it('marks other unsellable stays with the generic code', async () => {
    const res = await POST(new NextRequest('http://localhost/api/pricing/breakdown', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unitId, startDate: '2027-05-01', endDate: '2027-05-04', guestCount: 9 }),
    }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('stay_unquotable');
  });
});
