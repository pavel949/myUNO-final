import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { db, resetDb, createProject, createUnit } from '@/test/util';

vi.mock('@/lib/prisma', async () => {
  const util = await import('@/test/util');
  return { prisma: util.db };
});

import { GET } from './route';

/**
 * One villa's rule must never take the whole search down.
 *
 * Production, 2026-10-05: a villa whose seasonal tariff starts at 5 nights
 * made every 4-night search return HTTP 500 "Stay length below seasonal
 * minimum of 5" — for every guest, every project. Search recognised
 * "not sellable for this stay" by matching message text, and that wording
 * was not on its list. The pricing seam now throws StayUnquotableError for
 * those answers and search drops just that unit.
 */
const grid = (minimumNights: number, window = { start: '01-01', end: '12-31' }) => ({
  quoteEngine: 'canonical_tariff_grid_v1',
  taxPolicyVerified: true,
  tariffGrid: [{
    sourceRateId: 'all-year', seasonCode: 'ALL_YEAR', dateWindows: [window],
    rateMode: 'daily', pricingUnit: 'night', amountSatang: 500_000, currency: 'THB',
    minimumNights, includesTaxes: true, includesServiceCharge: true,
    includesBreakfast: false, sourceSellable: true,
  }],
});

describe('GET /api/search/units — an unsellable unit is dropped, not a 500', () => {
  let projectId: string;

  beforeEach(async () => {
    await resetDb();
    projectId = (await createProject({ status: 'live' })).id;
    await createUnit({ projectId, name: 'Open', baseNightlyThb: 400_000, status: 'live' });
  });

  async function search(nights: { startDate: string; endDate: string }) {
    const params = new URLSearchParams({ projectId, adultsCount: '2', ...nights });
    const res = await GET(new NextRequest(`http://localhost/api/search/units?${params}`));
    const body = await res.json();
    return { status: res.status, names: ((body.units ?? []) as { name: string }[]).map(u => u.name).sort() };
  }

  async function gridUnit(name: string, terms: ReturnType<typeof grid>) {
    const unit = await createUnit({ projectId, name, baseNightlyThb: 500_000, status: 'live' });
    await db.commercialOffering.updateMany({
      where: { unitId: unit.id, offeringType: 'short_term_stay' },
      data: { pricingTerms: terms },
    });
  }

  it('a seasonal 5-night minimum hides that villa from a 4-night search', async () => {
    await gridUnit('FiveNightMin', grid(5));
    expect(await search({ startDate: '2026-11-10', endDate: '2026-11-14' }))
      .toEqual({ status: 200, names: ['Open'] });
    expect(await search({ startDate: '2026-11-10', endDate: '2026-11-15' }))
      .toEqual({ status: 200, names: ['FiveNightMin', 'Open'] });
  });

  it('dates outside the published season hide that villa, not the page', async () => {
    await gridUnit('SummerOnly', grid(1, { start: '05-01', end: '09-30' }));
    expect(await search({ startDate: '2026-11-10', endDate: '2026-11-12' }))
      .toEqual({ status: 200, names: ['Open'] });
  });
});
