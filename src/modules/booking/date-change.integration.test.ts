import { describe, it, expect, beforeEach } from 'vitest';
import { db, resetDb, createIdentity, createProject, createUnit, createBooking } from '@/test/util';
import { seedConfig } from '@/modules/config';
import { changeBookingDates } from './booking.service';

/**
 * Moving a booking's dates (F-GUEST-9, the general case).
 *
 * `requestExtension` can only push the end date out. A guest whose flight moves
 * needs the whole range to shift; one cutting a trip short needs it to shrink.
 * Neither was expressible, so the only route was cancel and rebook — which loses
 * the booking, the price the guest agreed, and often the guest.
 */
describe('changing a booking-s dates', () => {
  const START = new Date('2026-11-10');
  const END = new Date('2026-11-14');

  let projectId: string;
  let unitId: string;
  let bookingId: string;

  beforeEach(async () => {
    await resetDb();
    await seedConfig(db);

    const project = await createProject();
    const unit = await createUnit({
      projectId: project.id,
      status: 'live',
      baseNightlyThb: 100_000,
      maxGuests: 4,
    });
    const guest = await createIdentity();

    projectId = project.id;
    unitId = unit.id;

    const booking = await createBooking({
      unitId,
      projectId,
      guestIdentityId: guest.id,
      status: 'confirmed',
      startDate: START,
      endDate: END,
      totalThb: 400_000,
    });
    bookingId = booking.id;
  });

  describe('moving the whole stay', () => {
    it('shifts both ends, which cancel-and-rebook was the only way to do', async () => {
      const result = await changeBookingDates(db, {
        bookingId,
        startDate: new Date('2026-11-17'),
        endDate: new Date('2026-11-21'),
      });

      expect(result.startDate.toISOString()).toBe(new Date('2026-11-17').toISOString());
      expect(result.endDate.toISOString()).toBe(new Date('2026-11-21').toISOString());

      const after = await db.booking.findUniqueOrThrow({ where: { id: bookingId } });
      expect(after.startDate.toISOString()).toBe(new Date('2026-11-17').toISOString());
    });

    it('does not treat the booking-s own nights as a conflict with itself', async () => {
      // The usual case: the new range overlaps the old one.
      await expect(
        changeBookingDates(db, {
          bookingId,
          startDate: new Date('2026-11-12'),
          endDate: new Date('2026-11-16'),
        })
      ).resolves.toBeTruthy();
    });
  });

  describe('money', () => {
    it('bills the difference when the stay grows', async () => {
      const result = await changeBookingDates(db, {
        bookingId,
        startDate: START,
        endDate: new Date('2026-11-18'),
      });

      expect(result.totalThb).toBeGreaterThan(result.previousTotalThb);
      expect(result.balanceDueThb).toBe(result.totalThb - result.previousTotalThb);
      expect(result.refundAccruedThb).toBe(0);
    });

    it('accrues a refund when the stay shrinks, rather than paying it here', async () => {
      const result = await changeBookingDates(db, {
        bookingId,
        startDate: START,
        endDate: new Date('2026-11-12'),
      });

      expect(result.totalThb).toBeLessThan(result.previousTotalThb);
      expect(result.refundAccruedThb).toBe(result.previousTotalThb - result.totalThb);
      expect(result.balanceDueThb).toBe(0);
    });

    it('reprices the new nights rather than adjusting the old total', async () => {
      // Nights move across seasons. A delta from the old nightly rate would
      // undercharge a stay that shifted into a peak, so the whole range is
      // recomputed.
      await db.pricingRule.create({
        data: {
          unitId,
          startDate: new Date('2026-12-20'),
          endDate: new Date('2026-12-31'),
          nightlyThb: 900_000,
          label: 'Peak',
        },
      });

      const result = await changeBookingDates(db, {
        bookingId,
        startDate: new Date('2026-12-21'),
        endDate: new Date('2026-12-25'),
      });

      // Four peak nights, not four nights at the base rate.
      expect(result.totalThb).toBeGreaterThan(400_000 * 2);
    });

    it('leaves the sold terms alone — the new pricing lives on the change row', async () => {
      await db.booking.update({
        where: { id: bookingId },
        data: { priceBreakdown: { total_thb: 400_000, note: 'as sold' } },
      });

      await changeBookingDates(db, {
        bookingId,
        startDate: START,
        endDate: new Date('2026-11-16'),
      });

      const after = await db.booking.findUniqueOrThrow({ where: { id: bookingId } });
      // Immutable once set — the terms the guest agreed to are a financial record.
      expect(after.priceBreakdown).toEqual({ total_thb: 400_000, note: 'as sold' });

      const [change] = await db.bookingChange.findMany({ where: { bookingId } });
      expect((change.newValue as Record<string, unknown>).priceBreakdown).toBeTruthy();
    });
  });

  describe('what it refuses', () => {
    it('refuses dates another guest holds', async () => {
      const other = await createIdentity();
      await createBooking({
        unitId,
        projectId,
        guestIdentityId: other.id,
        status: 'confirmed',
        startDate: new Date('2026-11-20'),
        endDate: new Date('2026-11-25'),
      });

      await expect(
        changeBookingDates(db, {
          bookingId,
          startDate: new Date('2026-11-21'),
          endDate: new Date('2026-11-24'),
        })
      ).rejects.toMatchObject({ code: 'DOUBLE_BOOK' });
    });

    it('refuses dates an owner has held or an OTA has sold', async () => {
      await db.blockedDate.create({
        data: {
          unitId,
          startDate: new Date('2026-11-20'),
          endDate: new Date('2026-11-25'),
          reason: 'owner_hold',
        },
      });

      await expect(
        changeBookingDates(db, {
          bookingId,
          startDate: new Date('2026-11-21'),
          endDate: new Date('2026-11-24'),
        })
      ).rejects.toMatchObject({ code: 'DOUBLE_BOOK', blockReason: 'owner_hold' });
    });

    it('refuses to move the arrival of a stay already in progress', async () => {
      // The guest is in the villa. Rewriting the arrival would falsify the
      // register the TM30 filing was made from.
      await db.booking.update({ where: { id: bookingId }, data: { status: 'checked_in' } });

      await expect(
        changeBookingDates(db, {
          bookingId,
          startDate: new Date('2026-11-11'),
          endDate: END,
        })
      ).rejects.toThrow(/departure, not its arrival/i);
    });

    it('lets a stay in progress change its departure', async () => {
      await db.booking.update({ where: { id: bookingId }, data: { status: 'checked_in' } });

      await expect(
        changeBookingDates(db, { bookingId, startDate: START, endDate: new Date('2026-11-16') })
      ).resolves.toBeTruthy();
    });

    it('refuses an end before the start', async () => {
      await expect(
        changeBookingDates(db, {
          bookingId,
          startDate: new Date('2026-11-20'),
          endDate: new Date('2026-11-18'),
        })
      ).rejects.toThrow(/after the new start/i);
    });

    it('refuses to move a cancelled booking', async () => {
      await db.booking.update({ where: { id: bookingId }, data: { status: 'cancelled' } });

      await expect(
        changeBookingDates(db, {
          bookingId,
          startDate: new Date('2026-11-17'),
          endDate: new Date('2026-11-21'),
        })
      ).rejects.toThrow(/status cancelled/i);
    });

    it('changes nothing when it refuses', async () => {
      await db.blockedDate.create({
        data: {
          unitId,
          startDate: new Date('2026-11-20'),
          endDate: new Date('2026-11-25'),
          reason: 'maintenance',
        },
      });

      await expect(
        changeBookingDates(db, {
          bookingId,
          startDate: new Date('2026-11-21'),
          endDate: new Date('2026-11-24'),
        })
      ).rejects.toThrow();

      const after = await db.booking.findUniqueOrThrow({ where: { id: bookingId } });
      expect(after.startDate.toISOString()).toBe(START.toISOString());
      expect(await db.bookingChange.count({ where: { bookingId } })).toBe(0);
    });
  });

  describe('history', () => {
    it('records where the stay was and where it went', async () => {
      await changeBookingDates(db, {
        bookingId,
        startDate: new Date('2026-11-17'),
        endDate: new Date('2026-11-21'),
      });

      const [change] = await db.bookingChange.findMany({ where: { bookingId } });
      expect(change.changeType).toBe('dates');
      expect((change.oldValue as Record<string, unknown>).startDate).toContain('2026-11-10');
      expect((change.newValue as Record<string, unknown>).startDate).toContain('2026-11-17');
    });
  });

  describe('two guests moving into the same window', () => {
    it('lets only one of them have it', async () => {
      const otherGuest = await createIdentity();
      const other = await createBooking({
        unitId,
        projectId,
        guestIdentityId: otherGuest.id,
        status: 'confirmed',
        startDate: new Date('2026-10-01'),
        endDate: new Date('2026-10-05'),
      });

      const target = { startDate: new Date('2026-12-01'), endDate: new Date('2026-12-05') };

      const results = await Promise.allSettled([
        changeBookingDates(db, { bookingId, ...target }),
        changeBookingDates(db, { bookingId: other.id, ...target }),
      ]);

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const loser = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
      expect((loser.reason as { code?: string }).code).toBe('DOUBLE_BOOK');
    });
  });
});
