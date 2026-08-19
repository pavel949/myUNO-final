import { describe, it, expect, beforeEach } from 'vitest';
import { db, resetDb, createIdentity, createProject, createUnit } from '@/test/util';
import { seedConfig } from '@/modules/config';
import { computePriceBreakdown } from '@/modules/core';
import { createBooking } from './booking.service';

/**
 * A party is more than a headcount.
 *
 * Bookings recorded adults and children only. A villa's house rules turn on
 * pets — whether they are allowed, how many, what the cleaning costs — and the
 * model could not express the question, let alone the answer. Infants matter
 * differently: they need a cot rather than a bed, so counting them against
 * capacity turns a family of four into a party the villa refuses.
 */
describe('booking party composition', () => {
  const START = new Date('2026-11-10');
  const END = new Date('2026-11-14');

  let projectId: string;
  let guestId: string;

  beforeEach(async () => {
    await resetDb();
    await seedConfig(db);

    const project = await createProject();
    const guest = await createIdentity();
    projectId = project.id;
    guestId = guest.id;
  });

  async function villa(opts: { maxGuests?: number; petsAllowed?: boolean | null; maxPets?: number | null } = {}) {
    const unit = await createUnit({
      projectId,
      status: 'live',
      maxGuests: opts.maxGuests ?? 4,
      baseNightlyThb: 100_000,
    });
    if (opts.petsAllowed !== undefined || opts.maxPets !== undefined) {
      await db.unit.update({
        where: { id: unit.id },
        data: { petsAllowed: opts.petsAllowed ?? null, maxPets: opts.maxPets ?? null },
      });
    }
    return unit;
  }

  function bookingFor(unitId: string, party: { adults: number; children: number; infants?: number; pets?: number }) {
    return {
      unitId,
      projectId,
      guestIdentityId: guestId,
      bookingType: 'guest_stay' as const,
      channel: 'direct' as const,
      startDate: START,
      endDate: END,
      totalThb: 400_000,
      instantBook: true,
      ...party,
    };
  }

  describe('infants do not consume the bed count', () => {
    it('lets a family of four adults-and-children bring an infant to a four-guest villa', async () => {
      const unit = await villa({ maxGuests: 4 });

      const booking = await createBooking(
        db,
        bookingFor(unit.id, { adults: 2, children: 2, infants: 1 })
      );

      expect(booking.infants).toBe(1);
      // Occupancy is adults + children. Counting the infant would have refused
      // a party the villa can genuinely sleep.
      await expect(
        computePriceBreakdown(db, unit.id, START, END, 4)
      ).resolves.toBeTruthy();
    });

    it('still refuses when adults and children alone exceed capacity', async () => {
      const unit = await villa({ maxGuests: 4 });

      await expect(computePriceBreakdown(db, unit.id, START, END, 5)).rejects.toThrow(/exceeds/i);
    });
  });

  describe('pets are a house rule, not a headcount', () => {
    it('refuses a pet at a villa that has not answered the question', async () => {
      // Null is not "no", but it is not "yes" either — and guessing yes puts an
      // animal in a villa whose owner never agreed to one.
      const unit = await villa({ petsAllowed: null });

      await expect(
        computePriceBreakdown(db, unit.id, START, END, 2, undefined, 1)
      ).rejects.toThrow(/does not accept pets/i);
    });

    it('refuses a pet at a villa that said no', async () => {
      const unit = await villa({ petsAllowed: false });

      await expect(
        computePriceBreakdown(db, unit.id, START, END, 2, undefined, 1)
      ).rejects.toThrow(/does not accept pets/i);
    });

    it('accepts a pet at a villa that said yes', async () => {
      const unit = await villa({ petsAllowed: true });

      await expect(
        computePriceBreakdown(db, unit.id, START, END, 2, undefined, 1)
      ).resolves.toBeTruthy();
    });

    it('enforces the villa-s pet limit', async () => {
      const unit = await villa({ petsAllowed: true, maxPets: 1 });

      await expect(
        computePriceBreakdown(db, unit.id, START, END, 2, undefined, 2)
      ).rejects.toThrow(/up to 1 pet/i);
    });

    it('allows any number when the villa set no limit', async () => {
      const unit = await villa({ petsAllowed: true, maxPets: null });

      await expect(
        computePriceBreakdown(db, unit.id, START, END, 2, undefined, 3)
      ).resolves.toBeTruthy();
    });

    it('does not ask the question when there is no pet', async () => {
      const unit = await villa({ petsAllowed: false });

      await expect(computePriceBreakdown(db, unit.id, START, END, 2, undefined, 0)).resolves.toBeTruthy();
    });
  });

  describe('what the database will not store', () => {
    it('refuses a booking with no adult', async () => {
      // Somebody has to be responsible for the stay.
      const unit = await villa();

      await expect(
        createBooking(db, bookingFor(unit.id, { adults: 0, children: 2 }))
      ).rejects.toThrow();
    });

    it('refuses a negative count, which would corrupt every occupancy figure', async () => {
      const unit = await villa();

      await expect(
        createBooking(db, bookingFor(unit.id, { adults: 2, children: -1 }))
      ).rejects.toThrow();
    });

    it('refuses a negative pet limit on a unit', async () => {
      const unit = await villa();

      await expect(
        db.unit.update({ where: { id: unit.id }, data: { maxPets: -1 } })
      ).rejects.toThrow();
    });
  });

  describe('defaults', () => {
    it('records zero infants and pets when the guest did not say', async () => {
      const unit = await villa();

      const booking = await createBooking(db, bookingFor(unit.id, { adults: 2, children: 0 }));

      expect(booking.infants).toBe(0);
      expect(booking.pets).toBe(0);
    });
  });
});
