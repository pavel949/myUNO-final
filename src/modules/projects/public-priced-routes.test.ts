import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const mocks = vi.hoisted(() => ({ unit: vi.fn(), units: vi.fn(), quote: vi.fn(), availability: vi.fn(), sourceExcluded: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: {
  unit: { findUnique: mocks.unit, findMany: mocks.units, count: vi.fn().mockResolvedValue(0) },
  booking: { findMany: vi.fn().mockResolvedValue([]) }, blockedDate: { findMany: vi.fn().mockResolvedValue([]) },
} }));
vi.mock('@/modules/projects/public-managed-import', () => ({ managedImportedInventoryIds: vi.fn().mockResolvedValue({ unitIds: ['unit'], projectIds: ['project'] }) }));
vi.mock('@/modules/analytics', () => ({ track: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/modules/core', () => ({ computePriceBreakdown: mocks.quote, checkAvailability: mocks.availability, StayUnquotableError: class extends Error {} }));
vi.mock('@/modules/booking/source-authority', () => ({ allExcludedSourceControlledUnitIds: vi.fn().mockResolvedValue([]), excludedSourceControlledUnits: mocks.sourceExcluded }));
vi.mock('@/modules/booking', () => ({ resolveStayCancellationPolicy: vi.fn().mockResolvedValue({ name: 'policy' }), resolveStayCancellationPolicyForDates: vi.fn().mockResolvedValue({ name: 'policy' }) }));
vi.mock('@/app/actions/getCurrentUser', () => ({ getCurrentUser: vi.fn().mockResolvedValue(null) }));
vi.mock('@/lib/i18n', () => ({ getRequestLocale: () => 'en' }));
vi.mock('@/modules/content', () => ({ tMany: vi.fn().mockResolvedValue({}), t: vi.fn(), LOCALES: ['en'], DEFAULT_LOCALE: 'en' }));
vi.mock('@/modules/projects', () => ({ listAreas: vi.fn(), collectDescendantIds: vi.fn() }));
vi.mock('@/modules/destinations', () => ({ getDestination: () => ({ key: 'phuket' }) }));
vi.mock('@/modules/browse', () => ({
  parseUnitSort: () => ({ key: 'recommended' }), rankByRating: vi.fn(), getUnitRatings: vi.fn().mockResolvedValue(new Map()),
  parseMapBounds: () => ({ ok: true }), boundsWhere: vi.fn(),
}));
vi.mock('@/app/libs/rateLimit', () => ({ checkRateLimit: () => ({ allowed: true }) }));
import { POST as pricingBreakdown } from '@/app/api/pricing/breakdown/route';
import { GET as unitDetail } from '@/app/api/units/[unitId]/route';
import { GET as search } from '@/app/api/search/units/route';
const photos = [1, 2, 3].map(n => ({ mediaId: `p${n}`, media: { id: `p${n}`, storageKey: `/fixture/${n}.jpg`, kind: 'photo', mimeType: 'image/jpeg', encrypted: false, sizeBytes: 10 } }));
function fixture() {
  return {
    id: 'unit', status: 'live', assetStatus: 'active', name: 'Villa', instantBook: true,
    project: { id: 'project', status: 'live', projectType: 'villa_estate' },
    inventoryCategory: { status: 'live', baseNightlyThb: 1080000, minNights: 1 },
    commercialOfferings: [{ offeringType: 'short_stay', status: 'active' }],
    accommodationType: 'exact_unit', coverMediaId: 'p1', media: photos,
    views: [], unitFeatures: [], descriptionKey: null,
  };
}
const dated = '?startDate=2026-10-20&endDate=2026-10-23&adultsCount=2';
beforeEach(() => {
  vi.clearAllMocks(); mocks.sourceExcluded.mockResolvedValue([]); mocks.unit.mockResolvedValue(fixture()); mocks.units.mockResolvedValue([]);
  mocks.quote.mockResolvedValue({ lines: [{}, {}, {}], subtotal_thb: 3240000, occupancy_tax_thb: 0, total_thb: 3240000 });
  mocks.availability.mockResolvedValue(true);
});
describe('priced public routes do not promote draft discovery to booking', () => {
  it.each(['draft', 'paused', 'archived'])('does not quote or advertise availability for a %s unit', async status => {
    mocks.unit.mockResolvedValue({ ...fixture(), status });
    const response = await unitDetail(new NextRequest(`http://localhost/api/units/unit${dated}`), { params: { unitId: 'unit' } });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Unit not found' });
    expect(mocks.quote).not.toHaveBeenCalled(); expect(mocks.availability).not.toHaveBeenCalled();
  });
  it('rejects live units inside draft projects and suspended inventory before quoting', async () => {
    const f = fixture(); f.project.status = 'draft'; mocks.unit.mockResolvedValue(f);
    expect((await unitDetail(new NextRequest('http://localhost/api/units/unit'), { params: { unitId: 'unit' } })).status).toBe(404);
    mocks.unit.mockResolvedValue({ ...fixture(), assetStatus: 'suspended' });
    expect((await unitDetail(new NextRequest(`http://localhost/api/units/unit${dated}`), { params: { unitId: 'unit' } })).status).toBe(404);
    expect(mocks.quote).not.toHaveBeenCalled();
  });
  it('preserves canonical dated prices and advisory availability for live inventory', async () => {
    const response = await unitDetail(new NextRequest(`http://localhost/api/units/unit${dated}`), { params: { unitId: 'unit' } });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ instantBook: true, baseRateSatang: 1080000, pricing: { total: 32400, isAvailable: true } });
    expect(mocks.quote).toHaveBeenCalledOnce(); expect(mocks.availability).toHaveBeenCalledOnce();
  });
  it.each(['', dated, `${dated}&groupBy=category`])('requires live unit/project and non-suspended inventory in search %s', async query => {
    const params = query || '?adultsCount=2';
    const response = await search(new NextRequest(`http://localhost/api/search/units${params}`));
    expect(response.status).toBe(200);
    expect(mocks.units).toHaveBeenCalled();
    for (const [args] of mocks.units.mock.calls) {
      expect(args.where.status).toBe('live');
      expect(args.where.project.status).toBe('live');
      expect(args.where.assetStatus).toEqual({ not: 'suspended' });
      expect(JSON.stringify(args.where)).not.toContain('draft');
    }
    expect(mocks.quote).not.toHaveBeenCalled();
  });
});

function quoteRequest() {
  return new NextRequest('http://localhost/api/pricing/breakdown', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ unitId: 'unit', startDate: '2026-10-20', endDate: '2026-10-23', guestCount: 2 }) });
}
describe('public quote live eligibility preflight', () => {
  it.each(['draft', 'paused', 'archived', 'suspended', 'draft_project', 'draft_category', 'source_excluded', 'missing'])('does not calculate a priced checkout offer for %s', async state => {
    const f = fixture();
    if (['draft', 'paused', 'archived'].includes(state)) f.status = state;
    if (state === 'suspended') f.assetStatus = state;
    if (state === 'draft_project') f.project.status = 'draft';
    if (state === 'draft_category') f.inventoryCategory.status = 'draft';
    if (state === 'source_excluded') mocks.sourceExcluded.mockResolvedValue(['unit']);
    mocks.unit.mockResolvedValue(state === 'missing' ? null : f);
    const response = await pricingBreakdown(quoteRequest());
    expect(response.status).toBe(404);
    expect(await response.json()).not.toHaveProperty('total');
    expect(mocks.quote).not.toHaveBeenCalled(); expect(mocks.availability).not.toHaveBeenCalled();
  });
  it.each([true, false])('preserves live canonical quote and truthful calendar availability %s', async available => {
    mocks.availability.mockResolvedValue(available);
    const response = await pricingBreakdown(quoteRequest());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ total: 32400, acceptedTotalSatang: 3240000, isAvailable: available, availableCapacity: available ? 1 : 0 });
    expect(mocks.quote).toHaveBeenCalledOnce(); expect(mocks.availability).toHaveBeenCalledOnce();
  });
});
