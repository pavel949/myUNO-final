import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';
const mocks = vi.hoisted(() => ({ guard: vi.fn(), offers: vi.fn(), quote: vi.fn() }));
vi.mock('@/app/libs/onboardingGuard', () => ({ requireAdmin: mocks.guard }));
vi.mock('@/lib/prisma', () => ({ prisma: { commercialOffering: { findMany: mocks.offers } } }));
vi.mock('@/modules/core/canonical-pricing.service', () => ({ computeCanonicalPriceBreakdown: mocks.quote }));
import { POST } from './route';
const request = (body: unknown) => new Request('http://localhost/api/admin/units/unit/tariff-preview', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
}) as NextRequest;
const input = { mode: 'stay', checkIn: '2028-06-01', checkOut: '2028-06-04', guests: 2 };
const tariff = { sourceRateId: 'rate', seasonCode: 'ALL', dateWindows: [{ start: '01-01', end: '12-31' }],
  rateMode: 'daily', pricingUnit: 'night', amountSatang: 123400, currency: 'THB', minimumNights: 1,
  includesTaxes: true, includesServiceCharge: true, includesBreakfast: false, sourceSellable: true };
beforeEach(() => {
  vi.clearAllMocks(); mocks.guard.mockResolvedValue({ ok: true });
  mocks.offers.mockResolvedValue([{ id: 'offer', offeringType: 'short_term_stay', status: 'active', pricingTerms: {} }]);
  mocks.quote.mockResolvedValue({ lines: [{ date: '2028-06-01', nightly_thb: 123400 }], subtotal_thb: 370200,
    total_thb: 396214, cleaning_fee_thb: 2000, service_fee_thb: 3000, occupancy_tax_thb: 21014,
    los_discount_thb: 0, early_bird_discount_thb: 0 });
});
describe('saved tariff preview', () => {
  it('uses the booking calculator for active ordinary/grid offers, including fees and guest count', async () => {
    const response = await POST(request(input), { params: { id: 'unit' } });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ pricingScope: 'canonical_quote', totalSatang: 396214,
      subtotalSatang: 370200, bookable: false, availabilityChecked: false });
    expect(mocks.quote).toHaveBeenCalledWith(expect.anything(), 'unit', new Date('2028-06-01T00:00:00Z'), new Date('2028-06-04T00:00:00Z'), 2);
  });
  it('never masks a canonical quote failure with a tariff subtotal', async () => {
    mocks.quote.mockRejectedValue(new Error('Source booking policy requires approval'));
    const response = await POST(request(input), { params: { id: 'unit' } });
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ error: 'Source booking policy requires approval', bookable: false });
  });
  it('labels draft calculations as partial and does not manufacture a final total', async () => {
    mocks.offers.mockResolvedValue([{ id: 'offer', offeringType: 'short_term_stay', status: 'draft',
      pricingTerms: { tariffGrid: [tariff] }, rulesAndPolicies: {} }]);
    const response = await POST(request(input), { params: { id: 'unit' } });
    const body = await response.json();
    expect(body).toMatchObject({ pricingScope: 'tariff_subtotal', subtotalSatang: 370200, bookable: false });
    expect(body).not.toHaveProperty('totalSatang'); expect(mocks.quote).not.toHaveBeenCalled();
  });
  it('enforces a source policy minimum even in draft previews', async () => {
    mocks.offers.mockResolvedValue([{ id: 'offer', offeringType: 'short_term_stay', status: 'draft',
      pricingTerms: { sourceSystem: 'layantara_os', tariffGrid: [tariff] }, rulesAndPolicies: { bookingPolicies: [{
        id: 'policy', active: true, scope_type: 'project', rate_mode: 'daily', season_code: 'ALL', min_nights: 5,
        confirmation_payment_value: 50, cancellation_summary: 'Fixture terms', balance_timing: '', stay_terms: '', included: [], excluded: [],
      }] } }]);
    const response = await POST(request(input), { params: { id: 'unit' } });
    expect(response.status).toBe(422); expect((await response.json()).error).toContain('minimum');
  });
  it('rejects invalid calendar dates, party counts and explicit mismatched modes', async () => {
    for (const body of [{ ...input, checkIn: '2028-02-30' }, { ...input, guests: 0 }, { ...input, mode: 'monthly' }]) {
      expect((await POST(request(body), { params: { id: 'unit' } })).status).toBeGreaterThanOrEqual(400);
    }
    expect(mocks.quote).not.toHaveBeenCalled();
  });
  it('does not query prices when authorization is refused', async () => {
    mocks.guard.mockResolvedValue({ ok: false, error: new Response(null, { status: 403 }) });
    expect((await POST(request(input), { params: { id: 'unit' } })).status).toBe(403);
    expect(mocks.offers).not.toHaveBeenCalled();
  });
});
