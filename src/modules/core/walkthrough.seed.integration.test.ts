import { describe, it, expect, beforeEach } from 'vitest';
import { db, resetDb } from '@/test/util';
import { seedConfig } from '@/modules/config/seed';
import { seedContent } from '@/modules/content/seed';
import { seedDemoData } from './seed';
import { seedWalkthroughState } from './walkthrough.seed';

/**
 * T-041 DoD: every doc 07 flow is walkable on a freshly seeded staging
 * environment.
 *
 * A seed that half-runs is worse than no seed — the founder finds out by
 * walking into an empty screen. So this runs the real thing and checks each
 * surface has what it needs.
 */
describe('Staging seed (T-041)', () => {
  beforeEach(async () => {
    await resetDb();
    await seedConfig(db);
    await seedContent(db);
    await seedDemoData(db);
  });

  it('runs end to end without error', async () => {
    await expect(seedWalkthroughState(db)).resolves.toBeUndefined();
  });

  it('is idempotent — re-seeding does not duplicate anything', async () => {
    await seedWalkthroughState(db);
    await seedWalkthroughState(db);
    await seedWalkthroughState(db);

    // Staging gets re-seeded; a seed that appends would inflate every board
    // it is meant to demonstrate.
    expect(await db.booking.count()).toBe(3);
    expect(await db.ticket.count()).toBe(1);
    expect(await db.serviceOrder.count()).toBe(1);
    expect(await db.ledgerEntry.count()).toBe(2);
  });

  describe('each surface has something to show', () => {
    beforeEach(async () => {
      await seedWalkthroughState(db);
    });

    it('gives the in-stay home space a guest who is actually checked in', async () => {
      const inStay = await db.booking.findFirst({ where: { status: 'checked_in' } });

      expect(inStay).not.toBeNull();
      expect(inStay!.checkedInAt).toBeInstanceOf(Date);
      // The stay must straddle today, or the home space is showing history.
      expect(inStay!.startDate.getTime()).toBeLessThan(Date.now());
      expect(inStay!.endDate.getTime()).toBeGreaterThan(Date.now());
    });

    it('gives the ops arrivals board an arrival still to come', async () => {
      const upcoming = await db.booking.findFirst({
        where: { status: 'confirmed', startDate: { gt: new Date() } },
      });

      expect(upcoming).not.toBeNull();
    });

    it('gives owner statements a completed stay with revenue and cost behind it', async () => {
      const completed = await db.booking.findFirstOrThrow({ where: { status: 'completed' } });

      const entries = await db.ledgerEntry.findMany({ where: { bookingId: completed.id } });
      const types = entries.map((e) => e.entryType).sort();

      // A statement with revenue but no costs proves nothing about NOI.
      expect(types).toEqual(['cleaning_cost', 'rental_revenue']);
      expect(entries.every((e) => e.unitId === completed.unitId)).toBe(true);
    });

    it('gives the tickets board an open ticket inside its SLA', async () => {
      const ticket = await db.ticket.findFirstOrThrow();

      expect(ticket.status).toBe('open');
      expect(ticket.slaDueAt!.getTime()).toBeGreaterThan(Date.now());
      expect(ticket.assigneeIdentityId).not.toBeNull();
    });

    it('gives the provider queue and the guest orders list an order', async () => {
      const order = await db.serviceOrder.findFirstOrThrow();

      expect(order.status).toBe('accepted');
      // Attached to the live stay, so it shows on the home space too.
      expect(order.booking_id).toBe('demo-booking-in-stay');
    });

    it('keeps every stay inside a unit the demo owner actually owns', async () => {
      const bookings = await db.booking.findMany({ include: { unit: true } });
      const owner = await db.identity.findUniqueOrThrow({
        where: { email: 'owner@ignatev.test' },
      });

      expect(bookings).toHaveLength(3);
      for (const booking of bookings) {
        expect(booking.unit.ownerIdentityId).toBe(owner.id);
      }
    });

    it('leaves the booking flow itself walkable — no stay blocks the near calendar', async () => {
      // The founder will want to book something themselves. The in-stay
      // booking ends within a few days and the next arrival is over a week
      // out, so there is a free window between them.
      const inStay = await db.booking.findFirstOrThrow({ where: { status: 'checked_in' } });
      const upcoming = await db.booking.findFirst({
        where: { status: 'confirmed', startDate: { gt: new Date() } },
      });

      if (upcoming) {
        expect(upcoming.startDate.getTime()).toBeGreaterThan(inStay.endDate.getTime());
      }
    });
  });

  it('skips quietly rather than throwing when the demo cast is absent', async () => {
    await resetDb();

    // Running the walkthrough seed alone must not crash the seed script.
    await expect(seedWalkthroughState(db)).resolves.toBeUndefined();
    expect(await db.booking.count()).toBe(0);
  });
});
