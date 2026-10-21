import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { db, resetDb, createIdentity, createProject, createUnit, createBooking } from '@/test/util';
import { seedConfig } from '@/modules/config';
import { changeBookingDates } from './booking.service';

const auth = vi.hoisted(() => ({ identityId: '' }));
vi.mock('@/app/actions/getCurrentUser', () => ({ getCurrentUser: async () => ({ identityId: auth.identityId }) }));
vi.mock('@/lib/prisma', async () => ({ prisma: (await import('@/test/util')).db }));
import { POST } from '@/app/api/bookings/[id]/modify/route';

beforeEach(async () => {
  await resetDb();
  await seedConfig(db);
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-21T01:00:00Z'));
});
afterEach(() => vi.useRealTimers());

async function fixture(timezone = 'Asia/Bangkok', status: 'confirmed' | 'checked_in' = 'confirmed') {
  const project = await createProject({ status: 'live' });
  await db.project.update({ where: { id: project.id }, data: { timezone } });
  const unit = await createUnit({ projectId: project.id, status: 'live', baseNightlyThb: 100_000, minNights: 1 });
  const guest = await createIdentity();
  auth.identityId = guest.id;
  return createBooking({ projectId: project.id, unitId: unit.id, guestIdentityId: guest.id,
    status, startDate: new Date(status === 'checked_in' ? '2026-10-19' : '2026-11-10'),
    endDate: new Date(status === 'checked_in' ? '2026-10-22' : '2026-11-14'), totalThb: 400_000 });
}
async function modify(bookingId: string, startDate: string, endDate: string) {
  return POST(new NextRequest('http://localhost/api/bookings/x/modify', {
    method: 'POST', body: JSON.stringify({ startDate, endDate }),
  }), { params: Promise.resolve({ id: bookingId }) });
}

describe('guest date changes respect the property calendar', () => {
  it('rejects a wholly past stay through the API without changing dates, money or history', async () => {
    const booking = await fixture();
    const response = await modify(booking.id, '2020-01-01', '2020-01-05');
    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain('Arrival cannot be before today');
    expect(await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).toMatchObject({
      startDate: booking.startDate, endDate: booking.endDate, status: booking.status,
      totalThb: booking.totalThb, balanceDueThb: booking.balanceDueThb,
      refundAccruedThb: booking.refundAccruedThb, updatedAt: booking.updatedAt,
    });
    expect(await db.bookingChange.count({ where: { bookingId: booking.id } })).toBe(0);
    expect(await db.payment.count({ where: { bookingId: booking.id } })).toBe(0);
  });

  it('uses the next property day before UTC midnight and permits arrival on that day', async () => {
    vi.setSystemTime(new Date('2026-10-20T18:00:00Z')); // Bangkok: October 21, 01:00.
    const booking = await fixture();
    await expect(changeBookingDates(db, { bookingId: booking.id,
      startDate: new Date('2026-10-20'), endDate: new Date('2026-10-24') }))
      .rejects.toMatchObject({ code: 'BOOKING_DATES_IN_PAST' });
    expect((await modify(booking.id, '2026-10-21', '2026-10-25')).status).toBe(200);
  });

  it('permits the previous UTC day when it is still today at a western property', async () => {
    const booking = await fixture('America/Los_Angeles'); // October 20, 18:00 locally.
    expect((await modify(booking.id, '2026-10-20', '2026-10-24')).status).toBe(200);
    expect((await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).startDate)
      .toEqual(new Date('2026-10-20'));
  });

  it('allows extending a checked-in stay with its historical arrival unchanged', async () => {
    const booking = await fixture('Asia/Bangkok', 'checked_in');
    expect((await modify(booking.id, '2026-10-19', '2026-10-24')).status).toBe(200);
    expect(await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).toMatchObject({
      startDate: booking.startDate, endDate: new Date('2026-10-24'), status: 'checked_in',
    });
  });

  it.each(['2026-10-20', '2026-10-21'])('refuses checked-in departure on %s at the canonical writer', async endDate => {
    const booking = await fixture('Asia/Bangkok', 'checked_in');
    await expect(changeBookingDates(db, { bookingId: booking.id,
      startDate: booking.startDate, endDate: new Date(endDate) }))
      .rejects.toMatchObject({ code: 'BOOKING_DATES_IN_PAST' });
    expect(await db.bookingChange.count({ where: { bookingId: booking.id } })).toBe(0);
  });

  it('preserves historical source-party reconciliation without granting historical date changes', async () => {
    const original = await fixture();
    const booking = await db.booking.update({ where: { id: original.id }, data: {
      startDate: new Date('2020-01-01'), endDate: new Date('2020-01-05'),
      bookingType: 'external_ota', externalRef: 'synthetic:historical-source',
      adults: 0, children: 0, partyDetailsStatus: 'source_unknown',
      priceBreakdown: { importedFrom: 'operator_workbook', sourcePartyEvidence: {
        adults: null, children: null, provenance: 'synthetic-reviewed-source',
      } },
    } });
    await changeBookingDates(db, { bookingId: booking.id, startDate: booking.startDate,
      endDate: booking.endDate, adults: 2, children: 0 });
    expect(await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).toMatchObject({
      startDate: booking.startDate, endDate: booking.endDate,
      adults: 2, children: 0, partyDetailsStatus: 'known', totalThb: booking.totalThb,
    });
    await expect(changeBookingDates(db, { bookingId: booking.id,
      startDate: new Date('2020-01-02'), endDate: booking.endDate }))
      .rejects.toMatchObject({ code: 'BOOKING_DATES_IN_PAST' });
  });
});
