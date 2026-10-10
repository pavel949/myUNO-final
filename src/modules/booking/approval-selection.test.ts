import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';

vi.mock('@/modules/analytics', () => ({ track: vi.fn().mockResolvedValue(null) }));
vi.mock('@/modules/comms', () => ({ createNotification: vi.fn() }));
vi.mock('@/modules/finance', () => ({ ensureDepositPreauthOnStayConfirmed: vi.fn() }));
vi.mock('./source-authority', () => ({
  assertLayantaraBookingAuthority: vi.fn().mockResolvedValue(null),
  excludedSourceControlledUnits: vi.fn().mockResolvedValue([]),
}));
vi.mock('./notify-requested', () => ({ notifyBookingRequested: vi.fn() }));
vi.mock('./notify-modified', () => ({ notifyBookingModified: vi.fn() }));
vi.mock('@/modules/core', async () => ({
  computePriceBreakdown: vi.fn(),
  ...(await import('@/modules/core/stay-unquotable')),
}));

import { computePriceBreakdown, StayUnquotableError } from '@/modules/core';
import { approveBookingRequest, findAvailableUnitsForCategory } from './booking.service';

// Deterministic service tests, not a substitute for PostgreSQL lock/exclusion tests.
describe('request approval preserves the guest inventory selection', () => {
  const requested = () => ({
    id: 'booking-a', unitId: 'unit-a', projectId: 'project-a', bookingType: 'guest_stay',
    status: 'requested', startDate: new Date('2027-02-01'), endDate: new Date('2027-02-04'),
    requestExpiresAt: new Date('2099-01-01'), adults: 2, children: 0, pets: 0,
    paymentMethod: 'cash', totalThb: 300_000, priceBreakdown: {} as Record<string, unknown>,
    cancellationPolicySnapshot: { key: 'flexible' },
  });
  const categorySnapshot = () => ({ inventory_category_id: 'category-a',
    inventory_selection: { version: 1, kind: 'category', inventoryCategoryId: 'category-a' } });
  let booking = requested();
  const tx = {
    $executeRaw: vi.fn().mockResolvedValue(1),
    booking: { findUnique: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
    unit: { findFirst: vi.fn() }, blockedDate: { findFirst: vi.fn() },
  };
  const client = {
    $transaction: (fn: (value: typeof tx) => unknown) => fn(tx),
    booking: { findUnique: vi.fn() }, unit: { findUnique: vi.fn(), findMany: vi.fn() },
    inventoryCategory: { findUnique: vi.fn() },
  };
  const db = client as unknown as PrismaClient;

  beforeEach(() => {
    vi.clearAllMocks();
    booking = requested();
    client.booking.findUnique.mockImplementation(async () => ({ ...booking }));
    tx.booking.findUnique.mockImplementation(async () => ({ ...booking }));
    tx.booking.findFirst.mockResolvedValue(null);
    tx.booking.updateMany.mockResolvedValue({ count: 0 });
    tx.booking.update.mockImplementation(async ({ data }) => ({ ...booking, ...data }));
    tx.unit.findFirst.mockImplementation(async ({ where }) => ({ id: where.id }));
    tx.blockedDate.findFirst.mockImplementation(async ({ where }) => where.unitId === 'unit-a' ? { reason: 'maintenance' } : null);
    client.unit.findUnique.mockResolvedValue({ categoryKey: 'villa' });
    client.unit.findMany.mockResolvedValue([{ id: 'unit-b', instantBook: false }]);
    client.inventoryCategory.findUnique.mockResolvedValue({ id: 'category-a', projectId: 'project-a', categoryKey: 'villa', status: 'live' });
    vi.mocked(computePriceBreakdown).mockResolvedValue({ total_thb: 290_000 } as never);
  });

  it.each([{}, { inventory_category_id: 'category-a' }, { inventory_category_id: null }, { inventory_category_id: [] }, { inventory_category_id: '' }])(
    'does not infer category consent from the unit category (%s)', async (priceBreakdown) => {
      booking.priceBreakdown = priceBreakdown;
      await expect(approveBookingRequest(db, { authorizeCandidate: async () => true, bookingId: booking.id })).rejects.toMatchObject({ code: 'DOUBLE_BOOK' });
      expect(tx.booking.update).not.toHaveBeenCalled();
      expect(client.unit.findMany).not.toHaveBeenCalled();
    }
  );

  it('can still approve a historical request on its original available unit', async () => {
    booking.priceBreakdown = { inventory_category_id: 'category-a' };
    tx.blockedDate.findFirst.mockResolvedValue(null);
    expect(await approveBookingRequest(db, { authorizeCandidate: async () => true, bookingId: booking.id })).toMatchObject({ unitId: 'unit-a', status: 'pending_payment' });
    expect(client.unit.findMany).not.toHaveBeenCalled();
  });

  it.each([
    { version: 2, kind: 'category', inventoryCategoryId: 'category-a' },
    { version: 1, kind: 'unit', unitId: 'unit-a' },
    { version: 1, kind: 'category', inventoryCategoryId: 'category-other' },
  ])('fails closed for an invalid or mismatched selection version (%s)', async (inventory_selection) => {
    booking.priceBreakdown = { inventory_category_id: 'category-a', inventory_selection };
    await expect(approveBookingRequest(db, { authorizeCandidate: async () => true, bookingId: booking.id })).rejects.toMatchObject({ code: 'DOUBLE_BOOK' });
    expect(tx.booking.update).not.toHaveBeenCalled();
  });

  it('reallocates explicitly selected category inventory and preserves the snapshot marker', async () => {
    booking.priceBreakdown = categorySnapshot();
    const result = await approveBookingRequest(db, { authorizeCandidate: async () => true, bookingId: booking.id });
    expect(result).toMatchObject({ unitId: 'unit-b', status: 'pending_payment', totalThb: 290_000,
      priceBreakdown: { ...categorySnapshot(), total_thb: 290_000 } });
    expect(client.unit.findMany.mock.calls[0][0].where).toMatchObject({ inventoryCategoryId: 'category-a', projectId: 'project-a' });
    expect(tx.unit.findFirst.mock.calls[1][0].where).toMatchObject({ inventoryCategoryId: 'category-a' });
    expect(result.cancellationPolicySnapshot).toEqual({ key: 'flexible' });
  });

  it('does not allocate an old category marker from another project', async () => {
    booking.priceBreakdown = categorySnapshot();
    client.inventoryCategory.findUnique.mockResolvedValue({ id: 'category-a', projectId: 'project-other', categoryKey: 'villa', status: 'live' });
    await expect(approveBookingRequest(db, { authorizeCandidate: async () => true, bookingId: booking.id })).rejects.toMatchObject({ code: 'DOUBLE_BOOK' });
    expect(tx.booking.update).not.toHaveBeenCalled();
  });

  it('skips an unquotable replacement while preserving the accepted price cap', async () => {
    booking.priceBreakdown = categorySnapshot();
    client.unit.findMany.mockResolvedValue([{ id: 'unit-b' }, { id: 'unit-c' }]);
    vi.mocked(computePriceBreakdown).mockRejectedValueOnce(new StayUnquotableError('This villa does not accept pets'));
    expect(await approveBookingRequest(db, { authorizeCandidate: async () => true, bookingId: booking.id })).toMatchObject({ unitId: 'unit-c', totalThb: 290_000 });
    expect(tx.booking.update).toHaveBeenCalledTimes(1);
  });

  it('requires re-consent if every eligible sibling is more expensive', async () => {
    booking.priceBreakdown = categorySnapshot();
    vi.mocked(computePriceBreakdown).mockResolvedValue({ total_thb: 300_001 } as never);
    await expect(approveBookingRequest(db, { authorizeCandidate: async () => true, bookingId: booking.id })).rejects.toMatchObject({ code: 'REQUOTE_REQUIRED' });
    expect(tx.booking.update).not.toHaveBeenCalled();
  });

  it('rejects a changed selection read inside the candidate transaction', async () => {
    booking.priceBreakdown = categorySnapshot();
    tx.booking.findUnique.mockResolvedValueOnce({ ...booking }).mockResolvedValueOnce({ ...booking, priceBreakdown: {} });
    await expect(approveBookingRequest(db, { authorizeCandidate: async () => true, bookingId: booking.id })).rejects.toMatchObject({ code: 'BOOKING_STATE_CHANGED' });
    expect(tx.booking.update).not.toHaveBeenCalled();
  });

  it('keeps unexpected pricing errors visible instead of trying another unit', async () => {
    booking.priceBreakdown = categorySnapshot();
    vi.mocked(computePriceBreakdown).mockRejectedValue(new Error('Database connection lost'));
    await expect(approveBookingRequest(db, { authorizeCandidate: async () => true, bookingId: booking.id })).rejects.toThrow('Database connection lost');
    expect(tx.booking.update).not.toHaveBeenCalled();
  });

  it('queries live, unsuspended canonical-category inventory rather than a mutable compatibility key', async () => {
    await findAvailableUnitsForCategory(db, 'project-a', 'villa', booking.startDate, booking.endDate, 'category-a');
    expect(client.unit.findMany.mock.calls[0][0].where).toMatchObject({
      inventoryCategoryId: 'category-a', inventoryCategory: { status: 'live' }, assetStatus: { not: 'suspended' },
    });
    expect(client.unit.findMany.mock.calls[0][0].where).not.toHaveProperty('categoryKey');
  });

  it('does not allocate another management company unit from the same category', async () => {
    booking.priceBreakdown = categorySnapshot();
    const authorizeCandidate = vi.fn(async (_tx, scope) => scope.unitId === 'unit-a');
    await expect(approveBookingRequest(db, { bookingId: booking.id, authorizeCandidate })).rejects.toMatchObject({ code: 'DOUBLE_BOOK' });
    expect(authorizeCandidate).toHaveBeenCalledWith(tx, { projectId: 'project-a', unitId: 'unit-b' });
    expect(tx.booking.update).not.toHaveBeenCalled();
  });

  it('skips foreign inventory but can allocate a later currently authorized sibling', async () => {
    booking.priceBreakdown = categorySnapshot();
    client.unit.findMany.mockResolvedValue([{ id: 'unit-b' }, { id: 'unit-c' }]);
    const authorizeCandidate = vi.fn(async (_tx, scope) => scope.unitId !== 'unit-b');
    expect(await approveBookingRequest(db, { bookingId: booking.id, authorizeCandidate })).toMatchObject({ unitId: 'unit-c' });
    expect(tx.booking.update).toHaveBeenCalledTimes(1);
  });

  it('rechecks original authority under the lock before changing expired holds', async () => {
    const authorizeCandidate = vi.fn(async () => false);
    await expect(approveBookingRequest(db, { bookingId: booking.id, authorizeCandidate })).rejects.toMatchObject({ code: 'BOOKING_FORBIDDEN' });
    expect(tx.booking.updateMany).not.toHaveBeenCalled();
    expect(tx.booking.update).not.toHaveBeenCalled();
  });

});
