import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({ category: vi.fn(), candidates: vi.fn(), price: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: { inventoryCategory: { findUnique: mocks.category } } }));
vi.mock('@/modules/booking', () => ({ findAvailableUnitsForCategory: mocks.candidates }));
vi.mock('@/modules/core', async () => ({ computePriceBreakdown: mocks.price, ...(await import('@/modules/core/stay-unquotable')) }));
vi.mock('@/app/libs/rateLimit', () => ({ checkRateLimit: () => ({ allowed: true }) }));
vi.mock('@/modules/analytics', () => ({ track: vi.fn().mockResolvedValue(null) }));
vi.mock('@/modules/destinations', () => ({ getDestination: () => ({ key: 'phuket' }) }));
vi.mock('@/lib/i18n', () => ({ getRequestLocale: () => 'en' }));

import { POST } from './route';
import { StayUnquotableError } from '@/modules/core';
import { verifyCategoryStayQuoteToken } from '@/modules/booking/category-quote';

const request = () => new NextRequest('http://localhost/api/pricing/category-quote', {
  method: 'POST', body: JSON.stringify({ inventoryCategoryId: 'category-a', startDate: '2027-02-01', endDate: '2027-02-04', adultsCount: 2 }),
});

describe('category quote candidate selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.category.mockResolvedValue({ id: 'category-a', projectId: 'project-a', categoryKey: 'villa', status: 'live', name: 'Villas' });
    mocks.candidates.mockResolvedValue([{ id: 'unit-a', instantBook: true }, { id: 'unit-b', instantBook: false }]);
    mocks.price.mockResolvedValue({ total_thb: 300_000, subtotal_thb: 300_000, lines: [{ nightly_thb: 100_000 }],
      los_discount_thb: 0, early_bird_discount_thb: 0, cleaning_fee_thb: 0, service_fee_thb: 0, occupancy_tax_thb: 0 });
  });

  it('returns explicit availability and signs the first commercially eligible canonical-category unit', async () => {
    mocks.price.mockRejectedValueOnce(new StayUnquotableError('Party too large for A'));
    const response = await POST(request());
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toMatchObject({ isAvailable: true, acceptedTotalSatang: 300_000, instantBook: false });
    expect(verifyCategoryStayQuoteToken(data.quoteToken)).toMatchObject({ quotedUnitId: 'unit-b', inventoryCategoryId: 'category-a' });
    expect(mocks.candidates.mock.calls[0].at(-1)).toBe('category-a');
  });

  it('does not issue a quote when all eligible inventory rejects the stay', async () => {
    mocks.price.mockRejectedValue(new StayUnquotableError('Stay minimum not met'));
    const response = await POST(request());
    expect(response.status).toBe(409);
    expect(await response.json()).not.toHaveProperty('quoteToken');
  });

  it('does not hide a pricing infrastructure failure as sold-out inventory', async () => {
    mocks.price.mockRejectedValueOnce(new Error('Database connection lost'));
    expect((await POST(request())).status).toBe(500);
    expect(mocks.price).toHaveBeenCalledTimes(1);
  });
});
