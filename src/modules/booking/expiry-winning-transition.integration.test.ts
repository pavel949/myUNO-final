import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { db, resetDb, createIdentity, createProject, createUnit } from '@/test/util';
import { approveBookingRequest, autoDeclineRequests, confirmBooking, createBooking, expireHolds } from './booking.service';

async function fixture(instantBook = true) {
  const project = await createProject({ status: 'live' });
  const unit = await createUnit({ projectId: project.id, status: 'live', instantBook });
  const actor = await createIdentity({ isAdmin: true });
  const booking = await createBooking(db, { unitId: unit.id, projectId: project.id, guestIdentityId: actor.id,
    bookingType: 'guest_stay', channel: 'manual', instantBook, totalThb: 1,
    startDate: new Date('2027-11-01'), endDate: new Date('2027-11-03'), adults: 2, children: 0 });
  return { actor, booking };
}
function pausedExpiryRead() {
  let read!: () => void; let release!: () => void;
  const selected = new Promise<void>(resolve => { read = resolve; });
  const proceed = new Promise<void>(resolve => { release = resolve; });
  const client = new Proxy(db, { get(target, property) {
    if (property !== 'booking') return Reflect.get(target, property);
    return new Proxy(db.booking, { get(delegate, method) {
      if (method !== 'findMany') return Reflect.get(delegate, method);
      return async (args: Parameters<typeof db.booking.findMany>[0]) => {
        const rows = await db.booking.findMany(args); read(); await proceed; return rows;
      };
    } });
  } }) as PrismaClient;
  return { client, selected, release };
}

describe('only the winning expiry transition sends an expiry notification', () => {
  beforeEach(resetDb);

  it('does not announce expiry after an operator confirmation wins', async () => {
    const { actor, booking } = await fixture();
    const gate = pausedExpiryRead();
    const expiring = expireHolds(gate.client, new Date(booking.holdExpiresAt!.getTime() + 1));
    await gate.selected;
    try {
      await confirmBooking(db, { bookingId: booking.id, mode: 'operator_unpaid', actorIdentityId: actor.id,
        reason: 'Synthetic reservation', expectedUpdatedAt: booking.updatedAt, commandId: randomUUID(), authorizeCandidate: async () => true });
    } finally { gate.release(); }
    expect(await expiring).toBe(0);
    expect((await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe('confirmed');
    expect(await db.notification.count({ where: { type: 'stay_hold_expired' } })).toBe(0);
  });

  it('does not announce decline after a request approval wins', async () => {
    const { booking } = await fixture(false);
    const gate = pausedExpiryRead();
    const declining = autoDeclineRequests(gate.client, new Date(booking.requestExpiresAt!.getTime() + 1));
    await gate.selected;
    try { await approveBookingRequest(db, { bookingId: booking.id, authorizeCandidate: async () => true }); }
    finally { gate.release(); }
    expect(await declining).toBe(0);
    expect((await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe('pending_payment');
    expect(await db.notification.count({ where: { type: 'stay_request_declined' } })).toBe(0);
  });

  it('expires a real losing hold once even with concurrent scheduler attempts', async () => {
    const { booking } = await fixture();
    const now = new Date(booking.holdExpiresAt!.getTime() + 1);
    const counts = await Promise.all([expireHolds(db, now), expireHolds(db, now)]);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(1);
    expect((await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe('expired');
    expect(await db.notification.count({ where: { type: 'stay_hold_expired' } })).toBe(1);
  });
});
