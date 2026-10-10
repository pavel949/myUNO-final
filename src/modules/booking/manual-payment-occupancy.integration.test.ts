import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { db, resetDb, createProject, createUnit, createIdentity } from '@/test/util';
import { checkAvailability, createManualBlock } from '@/modules/core';
import { recordCashPayment, recordBankTransfer } from '@/modules/finance';
import { createBooking, approveBookingRequest, expireHolds, findAvailableUnitsForCategory } from './booking.service';
import { projectCalendarCell } from './calendar-projection';

vi.mock('@/lib/prisma', async () => ({ prisma: (await import('@/test/util')).db }));
import { GET as search } from '@/app/api/search/units/route';

describe('manual payment reservations occupy canonical inventory', () => {
  const dates = { startDate: new Date('2027-02-01'), endDate: new Date('2027-02-04') };
  beforeEach(resetDb);

  async function fixture() {
    const project = await createProject({ status: 'live' });
    const guest = await createIdentity();
    const unit = await createUnit({ projectId: project.id, status: 'live', instantBook: true, categoryKey: 'villa' });
    const input = {
      ...dates, unitId: unit.id, projectId: project.id, guestIdentityId: guest.id,
      adults: 2, children: 0, totalThb: 1, instantBook: true,
      bookingType: 'guest_stay' as const, channel: 'direct' as const,
    };
    return { project, guest, unit, input };
  }

  it.each(['cash', 'bank_transfer'] as const)('keeps %s occupied across expiry, search, allocation and PMS', async (paymentMethod) => {
    const { project, unit, input } = await fixture();
    const sibling = await createUnit({ projectId: project.id, status: 'live', categoryKey: 'villa', name: 'Free sibling' });
    const booking = await createBooking(db, { ...input, paymentMethod });
    expect(booking).toMatchObject({ status: 'pending_payment', paymentMethod, holdExpiresAt: null });
    expect(await expireHolds(db, new Date(Date.now() + 7 * 86_400_000))).toBe(0);
    expect(await checkAvailability(db, unit.id, dates.startDate, dates.endDate)).toBe(false);
    const candidates = await findAvailableUnitsForCategory(db, project.id, 'villa', dates.startDate, dates.endDate);
    expect(candidates.map((candidate) => candidate.id)).toEqual([sibling.id]);

    const result = await search(new NextRequest('http://localhost/api/search/units?' + new URLSearchParams({
      projectId: project.id, startDate: '2027-02-01', endDate: '2027-02-04', adultsCount: '2',
    })));
    expect(result.status).toBe(200);
    expect((await result.json()).units.map((entry: { id: string }) => entry.id)).toEqual([sibling.id]);
    expect(projectCalendarCell([{
      id: booking.id, unitId: unit.id, kind: 'booking', status: booking.status,
      startDate: '2027-02-01', endDate: '2027-02-04', holdExpiresAt: null,
    }], unit.id, '2027-02-02')).toMatchObject({ state: 'hold', blocking: true });
  });

  it('rejects both a second booking and a maintenance block on a cash reservation', async () => {
    const { guest, input } = await fixture();
    await createBooking(db, { ...input, paymentMethod: 'cash' });
    await expect(createBooking(db, { ...input, paymentMethod: 'card_provider' }))
      .rejects.toMatchObject({ code: 'DOUBLE_BOOK' });
    await expect(createManualBlock(db, {
      ...dates, unitId: input.unitId, reason: 'maintenance', createdByIdentityId: guest.id,
    })).rejects.toMatchObject({ code: 'BOOKING_CONFLICT' });
    expect(await db.booking.count()).toBe(1);
    expect(await db.blockedDate.count()).toBe(0);
  });

  it.each(['cash', 'bank_transfer'] as const)('preserves %s after host approval and records one real receipt', async (paymentMethod) => {
    const { guest, input } = await fixture();
    const staff = await createIdentity();
    const request = await createBooking(db, { ...input, instantBook: false, paymentMethod });
    expect(await checkAvailability(db, input.unitId, dates.startDate, dates.endDate)).toBe(true);
    const booking = await approveBookingRequest(db, { authorizeCandidate: async () => true, bookingId: request.id });
    expect(booking).toMatchObject({ status: 'pending_payment', paymentMethod, holdExpiresAt: null });
    expect(await db.payment.count()).toBe(0);
    const receipt = { purpose: 'stay' as const, bookingId: booking.id, payerIdentityId: guest.id, amountThb: booking.totalThb };
    if (paymentMethod === 'cash') {
      await recordCashPayment(db, { ...receipt, receivedByIdentityId: staff.id, receiptRef: 'SYNTHETIC-CASH-1' });
    } else {
      await recordBankTransfer(db, { ...receipt, confirmedByIdentityId: staff.id, bankReference: 'SYNTHETIC-BANK-1' });
    }
    expect(await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).toMatchObject({ status: 'confirmed' });
    expect(await db.payment.count({ where: { bookingId: booking.id, status: 'succeeded', method: paymentMethod } })).toBe(1);
    expect(await db.ledgerEntry.count({ where: { bookingId: booking.id, entryType: 'rental_revenue' } })).toBe(1);
  });

  it('expires a card hold and then frees its dates', async () => {
    const { unit, input } = await fixture();
    const booking = await createBooking(db, { ...input, paymentMethod: 'card_provider' });
    expect(booking.holdExpiresAt).not.toBeNull();
    expect(await expireHolds(db, new Date(booking.holdExpiresAt!.getTime() + 1))).toBe(1);
    expect(await checkAvailability(db, unit.id, dates.startDate, dates.endDate)).toBe(true);
  });

  it('still refuses approval when the project has been archived', async () => {
    const { project, input } = await fixture();
    const request = await createBooking(db, { ...input, instantBook: false, paymentMethod: 'cash' });
    await db.project.update({ where: { id: project.id }, data: { status: 'archived' } });
    await expect(approveBookingRequest(db, { authorizeCandidate: async () => true, bookingId: request.id })).rejects.toMatchObject({ code: 'DOUBLE_BOOK' });
    expect(await db.booking.findUniqueOrThrow({ where: { id: request.id } })).toMatchObject({ status: 'requested' });
  });
});
