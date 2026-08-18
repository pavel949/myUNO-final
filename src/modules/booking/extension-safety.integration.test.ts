import { describe, it, expect, beforeEach } from 'vitest';
import { db, resetDb, createIdentity, createProject, createUnit, createBooking } from '@/test/util';
import { requestExtension } from './booking.service';

/**
 * P1-2. An extension is a booking, and was not treated like one.
 *
 * `requestExtension` read the calendar, checked for a clash, and updated the
 * booking as three separate statements — no transaction, no lock. It also never
 * looked at `blocked_date`, so a guest could extend straight over an owner's
 * hold, a maintenance window, or nights already sold on Airbnb. That is the same
 * hole P0-4 closed on the booking path, still open on this one.
 */
describe('extending a stay cannot take nights that are not free (P1-2)', () => {
  const STAY_START = new Date('2026-11-10');
  const STAY_END = new Date('2026-11-14');
  const EXTEND_TO = new Date('2026-11-18');

  let projectId: string;
  let unitId: string;
  let bookingId: string;

  beforeEach(async () => {
    await resetDb();

    const project = await createProject();
    const unit = await createUnit({ projectId: project.id, status: 'live', baseNightlyThb: 100_000 });
    const guest = await createIdentity();

    projectId = project.id;
    unitId = unit.id;

    const booking = await createBooking({
      unitId,
      projectId,
      guestIdentityId: guest.id,
      status: 'checked_in',
      startDate: STAY_START,
      endDate: STAY_END,
    });
    bookingId = booking.id;
  });

  describe('what it refuses', () => {
    it('refuses to extend over an owner hold', async () => {
      await db.blockedDate.create({
        data: { unitId, startDate: STAY_END, endDate: EXTEND_TO, reason: 'owner_hold' },
      });

      await expect(requestExtension(db, bookingId, EXTEND_TO)).rejects.toMatchObject({
        code: 'DOUBLE_BOOK',
        blockReason: 'owner_hold',
      });
    });

    it('refuses to extend over nights already sold on an OTA', async () => {
      // The case that costs money twice: Airbnb has taken these nights.
      await db.blockedDate.create({
        data: { unitId, startDate: STAY_END, endDate: EXTEND_TO, reason: 'ota_import' },
      });

      await expect(requestExtension(db, bookingId, EXTEND_TO)).rejects.toMatchObject({
        code: 'DOUBLE_BOOK',
      });
    });

    it('refuses to extend into another guest-s booking, with a code the caller can act on', async () => {
      const nextGuest = await createIdentity();
      await createBooking({
        unitId,
        projectId,
        guestIdentityId: nextGuest.id,
        status: 'confirmed',
        startDate: STAY_END,
        endDate: EXTEND_TO,
      });

      await expect(requestExtension(db, bookingId, EXTEND_TO)).rejects.toMatchObject({
        code: 'DOUBLE_BOOK',
      });
    });

    it('leaves the booking untouched when it refuses', async () => {
      await db.blockedDate.create({
        data: { unitId, startDate: STAY_END, endDate: EXTEND_TO, reason: 'maintenance' },
      });

      await expect(requestExtension(db, bookingId, EXTEND_TO)).rejects.toThrow();

      const after = await db.booking.findUniqueOrThrow({ where: { id: bookingId } });
      expect(after.endDate.toISOString()).toBe(STAY_END.toISOString());
      expect(after.balanceDueThb ?? 0).toBe(0);
      // And no history of a move that never happened.
      expect(await db.bookingChange.count({ where: { bookingId } })).toBe(0);
    });
  });

  describe('what it still allows', () => {
    it('extends into genuinely free nights', async () => {
      const result = await requestExtension(db, bookingId, EXTEND_TO);

      expect(result.additionalNights).toBe(4);
      expect(result.addedThb).toBe(400_000);

      const after = await db.booking.findUniqueOrThrow({ where: { id: bookingId } });
      expect(after.endDate.toISOString()).toBe(EXTEND_TO.toISOString());
    });

    it('records the move in the same breath as making it', async () => {
      await requestExtension(db, bookingId, EXTEND_TO);

      // A stay whose dates moved without a record of the move is worse than one
      // that did not move, so the change row is written inside the transaction.
      const changes = await db.bookingChange.findMany({ where: { bookingId } });
      expect(changes).toHaveLength(1);
      expect(changes[0].changeType).toBe('dates');
      expect(changes[0].priceDeltaThb).toBe(400_000);
    });

    it('ignores a block on a different unit', async () => {
      const other = await createUnit({ projectId, name: 'Other villa', status: 'live' });
      await db.blockedDate.create({
        data: { unitId: other.id, startDate: STAY_END, endDate: EXTEND_TO, reason: 'owner_hold' },
      });

      await expect(requestExtension(db, bookingId, EXTEND_TO)).resolves.toBeTruthy();
    });
  });

  describe('two extensions racing each other', () => {
    it('lets only one of them take the nights', async () => {
      const neighbourGuest = await createIdentity();
      const neighbour = await createBooking({
        unitId,
        projectId,
        guestIdentityId: neighbourGuest.id,
        status: 'checked_in',
        startDate: new Date('2026-11-01'),
        endDate: STAY_START,
      });

      // Both stays try to grow into the same free window at once.
      const results = await Promise.allSettled([
        requestExtension(db, bookingId, EXTEND_TO),
        requestExtension(db, neighbour.id, EXTEND_TO),
      ]);

      const won = results.filter((r) => r.status === 'fulfilled');
      expect(won).toHaveLength(1);

      const loser = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
      // The loser gets a refusal it can explain to a guest, not a driver error.
      expect((loser.reason as { code?: string }).code).toBe('DOUBLE_BOOK');
    });
  });
});
