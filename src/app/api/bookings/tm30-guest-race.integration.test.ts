import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { db, resetDb, createIdentity, createProject, createUnit, createBooking, createBookingGuest } from '@/test/util';
const control = vi.hoisted(() => ({ identityId: '', isAdmin: true, pause: undefined as undefined | { observed: () => void; resume: Promise<void> } }));
vi.mock('@/app/actions/getCurrentUser', () => ({ getCurrentUser: async () => ({ identityId: control.identityId, isAdmin: control.isAdmin, roles: [] }) }));
vi.mock('@/lib/prisma', async () => {
  const { db: client } = await import('@/test/util');
  return { prisma: new Proxy(client, { get(target, key) {
    if (key !== 'booking') return Reflect.get(target, key);
    return new Proxy(target.booking, { get(model, method) {
      if (method !== 'findUnique') return Reflect.get(model, method);
      return async (...args: any[]) => {
        const value = await (model.findUnique as any)(...args);
        if (control.pause && args[0]?.include?.guestIdentity) {
          const barrier = control.pause; control.pause = undefined;
          barrier.observed(); await barrier.resume;
        }
        return value;
      };
    } });
  } }) };
});
import { POST as checkIn } from './[id]/checkin/route';
import { POST as addGuest } from './[id]/guests/route';
import { capturePassportData, safeDecrypt } from '@/modules/ops';

beforeEach(async () => { control.pause = undefined; control.isAdmin = true; await resetDb(); });
async function fixture(status: 'confirmed' | 'checked_in' = 'confirmed') {
  const admin = await createIdentity({ isAdmin: true }); control.identityId = admin.id;
  const guest = await createIdentity(), project = await createProject(), unit = await createUnit(project.id);
  const booking = await createBooking({ projectId: project.id, unitId: unit.id, guestIdentityId: guest.id, status,
    adults: 1, startDate: new Date(Date.now() - 86_400_000), endDate: new Date(Date.now() + 2 * 86_400_000) });
  return { admin, guest, booking };
}
const request = (body: unknown = {}) => new NextRequest('http://localhost/api/bookings/synthetic', { method: 'POST', body: JSON.stringify(body) });
const party = (nationality = 'RU') => request({ fullName: 'Synthetic visitor', nationality, passportNumber: 'SYNTHETIC-PASSPORT', isLead: true });

describe('party changes and TM30 snapshot', () => {
  it('files the foreign guest committed after the route initial snapshot but before locked arrival', async () => {
    const f = await fixture(); let observed!: () => void, release!: () => void;
    const read = new Promise<void>(r => { observed = r; }), resume = new Promise<void>(r => { release = r; });
    control.pause = { observed, resume };
    const arrival = checkIn(request(), { params: { id: f.booking.id } });
    await read;
    try { expect((await addGuest(party(), { params: { id: f.booking.id } })).status).toBe(201); }
    finally { release(); }
    const arrived = await arrival; expect(arrived.status).toBe(200); expect((await arrived.json()).tm30FilingsCreated).toBe(1);
    const registered = await db.bookingGuest.findFirstOrThrow({ where: { bookingId: f.booking.id } });
    expect(safeDecrypt(registered.passportNumber)).toBe('SYNTHETIC-PASSPORT');
    expect(await db.tm30Filing.count({ where: { bookingId: f.booking.id, bookingGuestId: registered.id } })).toBe(1);
    expect((await checkIn(request(), { params: { id: f.booking.id } })).status).toBe(409);
    expect(await db.tm30Filing.count({ where: { bookingId: f.booking.id } })).toBe(1);
  });
  it('creates a canonical filing when a foreign guest is registered after arrival', async () => {
    const f = await fixture('checked_in');
    const response = await addGuest(party(), { params: { id: f.booking.id } }); expect(response.status).toBe(201);
    const registered = await db.bookingGuest.findFirstOrThrow();
    expect(await db.tm30Filing.count({ where: { bookingGuestId: registered.id } })).toBe(1);
    expect((await db.booking.findUniqueOrThrow({ where: { id: f.booking.id } })).status).toBe('checked_in');
  });
  it('rolls back late guest, passport and verification changes if filing persistence fails', async () => {
    const f = await fixture('checked_in');
    await db.$executeRawUnsafe("CREATE FUNCTION synthetic_tm30_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic filing failure'; END $$");
    await db.$executeRawUnsafe('CREATE TRIGGER synthetic_tm30_fail BEFORE INSERT ON tm30_filing FOR EACH ROW EXECUTE FUNCTION synthetic_tm30_fail()');
    try { expect((await addGuest(party(), { params: { id: f.booking.id } })).status).toBeGreaterThanOrEqual(400); }
    finally { await db.$executeRawUnsafe('DROP TRIGGER synthetic_tm30_fail ON tm30_filing'); await db.$executeRawUnsafe('DROP FUNCTION synthetic_tm30_fail()'); }
    expect(await db.bookingGuest.count()).toBe(0); expect(await db.tm30Filing.count()).toBe(0);
    expect((await db.booking.findUniqueOrThrow({ where: { id: f.booking.id } })).verificationStatus).toBe(f.booking.verificationStatus);
    expect((await addGuest(party(), { params: { id: f.booking.id } })).status).toBe(201);
    expect(await db.bookingGuest.count()).toBe(1); expect(await db.tm30Filing.count()).toBe(1);
  });
  it('keeps Thai guests filing-free and includes an already registered foreign guest once', async () => {
    const f = await fixture(); await createBookingGuest({ bookingId: f.booking.id, fullName: 'Existing foreign guest', nationality: 'RU', passportNumber: 'SYNTHETIC-EXISTING' });
    expect((await checkIn(request(), { params: { id: f.booking.id } })).status).toBe(200);
    expect(await db.tm30Filing.count()).toBe(1);
    expect((await addGuest(party('TH'), { params: { id: f.booking.id } })).status).toBe(201);
    expect(await db.tm30Filing.count()).toBe(1);
  });
  it('passport retries preserve the original registered guest and one filing', async () => {
    const f = await fixture();
    await createBookingGuest({ bookingId: f.booking.id, fullName: 'Existing visitor', nationality: 'RU', passportNumber: 'SYNTHETIC-ORIGINAL' });
    expect((await checkIn(request(), { params: { id: f.booking.id } })).status).toBe(200);
    const guest = await db.bookingGuest.findFirstOrThrow();
    for (let i = 0; i < 2; i++) await capturePassportData(db, { bookingGuestId: guest.id, passportNumber: 'SYNTHETIC-UPDATED' });
    expect(await db.bookingGuest.count()).toBe(1); expect(await db.tm30Filing.count()).toBe(1);
    expect(safeDecrypt((await db.bookingGuest.findUniqueOrThrow({ where: { id: guest.id } })).passportNumber)).toBe('SYNTHETIC-UPDATED');
  });
  it('keeps foreign-identity registration denied without party or filing writes', async () => {
    const f = await fixture('checked_in'); const foreign = await createIdentity();
    control.identityId = foreign.id; control.isAdmin = false;
    expect((await addGuest(party(), { params: { id: f.booking.id } })).status).toBe(404);
    expect(await db.bookingGuest.count()).toBe(0); expect(await db.tm30Filing.count()).toBe(0);
  });

});
