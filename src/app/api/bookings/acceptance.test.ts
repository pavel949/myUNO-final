import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  user: vi.fn(), unit: vi.fn(), category: vi.fn(), create: vi.fn(),
  price: vi.fn(), candidates: vi.fn(), checkout: vi.fn(),
  replay: vi.fn(),
}));
vi.mock('@/app/actions/getCurrentUser', () => ({ getCurrentUser: mocks.user }));
vi.mock('@/lib/prisma', () => ({ prisma: {
  unit: { findUnique: mocks.unit }, inventoryCategory: { findUnique: mocks.category },
} }));
vi.mock('@/modules/booking', () => ({
  createBookingAttempt: mocks.create,
  findBookingByCreationIntent: mocks.replay,
  resolveStayCancellationPolicy: vi.fn().mockResolvedValue({ key: 'flexible' }),
  sourceSeasonCancellationPolicy: vi.fn().mockReturnValue(null),
  findAvailableUnitsForCategory: mocks.candidates,
}));
vi.mock('@/modules/finance', () => ({ createCheckout: mocks.checkout }));
vi.mock('@/modules/config', () => ({
  getConfig: vi.fn().mockResolvedValue(['cash', 'bank_transfer', 'card_provider']),
}));
vi.mock('@/modules/core', () => ({
  computePriceBreakdown: mocks.price,
  StayUnquotableError: class extends Error {},
}));

import { POST } from './route';
import { StayUnquotableError } from '@/modules/core';
import { createCategoryStayQuoteToken } from '@/modules/booking/category-quote';

describe('POST booking acceptance', () => {
  const stay = { startDate: '2027-02-01', endDate: '2027-02-04', adultsCount: 2, childrenCount: 0 };
  const direct = { ...stay, unitId: 'unit-a', instantBook: true, acceptedTotalSatang: 300_000,
    idempotencyKey: '00000000-0000-4000-8000-000000000001' };
  const request = (body: unknown) => new NextRequest('http://localhost/api/bookings', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.replay.mockResolvedValue(null);
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
      booking: { id: 'booking-a', status: input.instantBook ? 'pending_payment' : 'requested', totalThb: 300_000 },
      replayed: false,
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
    mocks.create.mockResolvedValue({ booking: { id: 'booking-a', status: 'pending_payment', totalThb: 290_000 }, replayed: false });
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

  const categoryBody = () => ({
    ...stay, inventoryCategoryId: 'category-a', acceptedTotalSatang: 300_000,
    idempotencyKey: direct.idempotencyKey,
    categoryQuoteToken: createCategoryStayQuoteToken({
      ...stay, inventoryCategoryId: 'category-a', projectId: 'project-a', petsCount: 0,
      acceptedTotalSatang: 300_000, quotedUnitId: 'unit-b',
    }).token,
  });

  it('retries an unquotable first category candidate and books the eligible sibling', async () => {
    mocks.candidates.mockResolvedValue([{ id: 'unit-a' }, { id: 'unit-b' }]);
    mocks.price.mockRejectedValueOnce(new StayUnquotableError('This unit does not accept pets'));
    const response = await POST(request(categoryBody()));
    expect(response.status).toBe(201);
    expect(mocks.create.mock.calls[0][1]).toMatchObject({ unitId: 'unit-b',
      inventoryCategoryId: 'category-a' });
  });

  it.each(['DOUBLE_BOOK', 'REQUOTE_REQUIRED', 'stay_unquotable'])(
    'retries a category candidate rejected at the locked writer (%s)', async (code) => {
      mocks.candidates.mockResolvedValue([{ id: 'unit-a' }, { id: 'unit-b' }]);
      mocks.create.mockRejectedValueOnce(code === 'stay_unquotable'
        ? new StayUnquotableError('Party no longer fits') : Object.assign(new Error('Candidate changed'), { code }));
      const response = await POST(request(categoryBody()));
      expect(response.status).toBe(201);
      expect(mocks.create.mock.calls[1][1].unitId).toBe('unit-b');
    }
  );

  it('keeps a re-consent outcome when the remaining category candidate is unquotable', async () => {
    mocks.candidates.mockResolvedValue([{ id: 'unit-a' }, { id: 'unit-b' }]);
    mocks.price.mockResolvedValueOnce({ total_thb: 300_001 })
      .mockRejectedValueOnce(new StayUnquotableError('Party too large'));
    const response = await POST(request(categoryBody()));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'REQUOTE_REQUIRED' });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('never treats an exact-unit commercial rejection as category consent', async () => {
    mocks.price.mockRejectedValueOnce(new StayUnquotableError('Party too large'));
    expect((await POST(request(direct))).status).toBe(400);
    expect(mocks.candidates).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('rejects mixed exact-unit and category selectors without persisting ambiguous consent', async () => {
    expect((await POST(request({ ...direct, inventoryCategoryId: 'category-a' }))).status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('does not suppress infrastructure failures as exhausted category inventory', async () => {
    mocks.candidates.mockResolvedValue([{ id: 'unit-a' }, { id: 'unit-b' }]);
    mocks.price.mockRejectedValueOnce(new Error('Database connection lost'));
    expect((await POST(request(categoryBody()))).status).toBe(500);
    expect(mocks.price).toHaveBeenCalledTimes(1);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('does not mark an exact-unit price snapshot as category-selected', async () => {
    expect((await POST(request(direct))).status).toBe(201);
    expect(mocks.create.mock.calls[0][1].priceBreakdown).not.toHaveProperty('inventory_category_id');
    expect(mocks.create.mock.calls[0][1].inventoryCategoryId).toBeUndefined();
  });

  it('ignores a client-supplied category marker on an exact-unit request', async () => {
    expect((await POST(request({ ...direct, priceBreakdown: { inventory_category_id: 'category-a', inventory_selection: { version: 1, kind: 'category', inventoryCategoryId: 'category-a' } } }))).status).toBe(201);
    expect(mocks.create.mock.calls[0][1].priceBreakdown).not.toHaveProperty('inventory_category_id');
    expect(mocks.create.mock.calls[0][1].inventoryCategoryId).toBeUndefined();
  });

  it('returns exhausted inventory without writing when every category candidate is unquotable', async () => {
    mocks.candidates.mockResolvedValue([{ id: 'unit-a' }, { id: 'unit-b' }]);
    mocks.price.mockRejectedValue(new StayUnquotableError('Party too large'));
    const response = await POST(request(categoryBody()));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'DOUBLE_BOOK' });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('skips a category candidate whose canonical category changed', async () => {
    mocks.candidates.mockResolvedValue([{ id: 'unit-a' }, { id: 'unit-b' }]);
    mocks.unit.mockResolvedValueOnce({ projectId: 'project-a', status: 'live', inventoryCategoryId: 'category-other', inventoryCategory: { status: 'live' } });
    expect((await POST(request(categoryBody()))).status).toBe(201);
    expect(mocks.create.mock.calls[0][1].unitId).toBe('unit-b');
    expect(mocks.candidates.mock.calls[0].at(-1)).toBe('category-a');
  });

  it('preserves the category signed-quote cap and refreshes booking mode', async () => {
    const { token } = createCategoryStayQuoteToken({
      ...stay, inventoryCategoryId: 'category-a', projectId: 'project-a', petsCount: 0,
      acceptedTotalSatang: 300_000, quotedUnitId: 'unit-a',
    });
    const response = await POST(request({
      ...stay, inventoryCategoryId: 'category-a', acceptedTotalSatang: 300_000, categoryQuoteToken: token,
      idempotencyKey: direct.idempotencyKey,
    }));
    expect(response.status).toBe(201);
    expect(mocks.create.mock.calls[0][1]).toMatchObject({
      instantBook: false, acceptedMaxTotalThb: 300_000, inventoryCategoryId: 'category-a',
    });
  });
});
