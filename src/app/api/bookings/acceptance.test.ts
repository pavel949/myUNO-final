import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  user: vi.fn(), unit: vi.fn(), category: vi.fn(), create: vi.fn(),
  price: vi.fn(), candidates: vi.fn(), checkout: vi.fn(),
}));
vi.mock('@/app/actions/getCurrentUser', () => ({ getCurrentUser: mocks.user }));
vi.mock('@/lib/prisma', () => ({ prisma: {
  unit: { findUnique: mocks.unit }, inventoryCategory: { findUnique: mocks.category },
} }));
vi.mock('@/modules/booking', () => ({
  createBooking: mocks.create,
  resolveStayCancellationPolicy: vi.fn().mockResolvedValue({ key: 'flexible' }),
  sourceSeasonCancellationPolicy: vi.fn().mockReturnValue(null),
  findAvailableUnitsForCategory: mocks.candidates,
}));
vi.mock('@/modules/finance', () => ({ createCheckout: mocks.checkout }));
vi.mock('@/modules/core', () => ({
  computePriceBreakdown: mocks.price,
  StayUnquotableError: class extends Error {},
}));

import { POST } from './route';
import { createCategoryStayQuoteToken } from '@/modules/booking/category-quote';

describe('POST booking acceptance', () => {
  const stay = { startDate: '2027-02-01', endDate: '2027-02-04', adultsCount: 2, childrenCount: 0 };
  const direct = { ...stay, unitId: 'unit-a', instantBook: true, acceptedTotalSatang: 300_000 };
  const request = (body: unknown) => new NextRequest('http://localhost/api/bookings', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user.mockResolvedValue({ identityId: 'guest-a' });
    mocks.unit.mockResolvedValue({
      id: 'unit-a', projectId: 'project-a', instantBook: false, status: 'live',
      inventoryCategoryId: 'category-a', inventoryCategory: { status: 'live' },
    });
    mocks.category.mockResolvedValue({
      id: 'category-a', projectId: 'project-a', categoryKey: 'villa', status: 'live',
    });
    mocks.candidates.mockResolvedValue([{ id: 'unit-a', instantBook: true }]);
    mocks.price.mockResolvedValue({ total_thb: 300_000 });
    mocks.create.mockImplementation(async (_db, input) => ({
      id: 'booking-a', status: input.instantBook ? 'pending_payment' : 'requested', totalThb: 300_000,
    }));
  });

  it('derives direct-unit booking mode from the current unit', async () => {
    const response = await POST(request({ ...direct, paymentMethod: 'card_provider' }));
    expect(response.status).toBe(201);
    expect(mocks.create.mock.calls[0][1].instantBook).toBe(false);
    expect((await response.json()).booking.status).toBe('requested');
    expect(mocks.checkout).not.toHaveBeenCalled();
  });

  it('passes the direct-unit accepted cap to the canonical writer', async () => {
    expect((await POST(request(direct))).status).toBe(201);
    expect(mocks.create.mock.calls[0][1].acceptedMaxTotalThb).toBe(300_000);
    expect(mocks.create.mock.calls[0][1].paymentMethod).toBe('cash');
  });

  it('rejects an unknown payment method without creating a reservation', async () => {
    expect((await POST(request({ ...direct, paymentMethod: 'unknown' }))).status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('uses the committed booking total when the writer calculates a lower card charge', async () => {
    mocks.unit.mockResolvedValue({
      id: 'unit-a', projectId: 'project-a', instantBook: true, status: 'live',
      inventoryCategoryId: 'category-a', inventoryCategory: { status: 'live' },
    });
    mocks.create.mockResolvedValue({ id: 'booking-a', status: 'pending_payment', totalThb: 290_000 });
    mocks.checkout.mockResolvedValue({ checkoutUrl: '/checkout/payment-a' });
    const result = await POST(request({ ...direct, paymentMethod: 'card_provider' }));
    expect(result.status).toBe(201);
    expect(mocks.checkout.mock.calls[0][1]).toMatchObject({ bookingId: 'booking-a', amountThb: 290_000 });
  });

  it.each([undefined, null, -1, 1.5, '300000', Number.MAX_SAFE_INTEGER + 1])(
    'requires an explicit valid accepted total (%s)', async (acceptedTotalSatang) => {
      const response = await POST(request({ ...direct, acceptedTotalSatang }));
      expect(response.status).toBe(409);
      expect((await response.json()).code).toBe('REQUOTE_REQUIRED');
      expect(mocks.create).not.toHaveBeenCalled();
    }
  );

  it('does not create a direct-unit booking after the reviewed price increases', async () => {
    mocks.price.mockResolvedValue({ total_thb: 300_001 });
    const response = await POST(request(direct));
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe('REQUOTE_REQUIRED');
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('preserves the category signed-quote cap and refreshes booking mode', async () => {
    const { token } = createCategoryStayQuoteToken({
      ...stay, inventoryCategoryId: 'category-a', projectId: 'project-a', petsCount: 0,
      acceptedTotalSatang: 300_000, quotedUnitId: 'unit-a',
    });
    const response = await POST(request({
      ...stay, inventoryCategoryId: 'category-a', acceptedTotalSatang: 300_000, categoryQuoteToken: token,
    }));
    expect(response.status).toBe(201);
    expect(mocks.create.mock.calls[0][1]).toMatchObject({
      instantBook: false, acceptedMaxTotalThb: 300_000,
    });
  });
});
