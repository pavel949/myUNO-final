import { describe, it, expect, beforeEach } from 'vitest';
import { db, resetDb, createIdentity, createProject, createUnit } from '@/test/util';
import {
  setUnitOwner,
  getOwnerAt,
  getOwnershipHistory,
  ensureOwnershipRecorded,
} from './ownership.service';

/**
 * Ownership is a dated fact.
 *
 * `Unit.ownerIdentityId` answers "who owns this now" and is read everywhere, so
 * it stays — but it cannot answer "who owned it in March", and that question has
 * money attached. A statement, a payout or a fee earned under a previous owner
 * is only defensible if the platform can still say who held title at the time.
 */
describe('unit ownership history', () => {
  let unitId: string;
  let alice: string;
  let bob: string;

  beforeEach(async () => {
    await resetDb();

    const project = await createProject();
    const a = await createIdentity({ firstName: 'Alice' });
    const b = await createIdentity({ firstName: 'Bob' });
    alice = a.id;
    bob = b.id;

    const unit = await createUnit({ projectId: project.id, ownerIdentityId: alice });
    unitId = unit.id;
    await ensureOwnershipRecorded(db, unitId, new Date('2026-01-01'));
  });

  describe('recording a transfer', () => {
    it('closes the outgoing period and opens the incoming one', async () => {
      await setUnitOwner(db, {
        unitId,
        ownerIdentityId: bob,
        effectiveFrom: new Date('2026-06-01'),
      });

      const history = await getOwnershipHistory(db, unitId);

      expect(history).toHaveLength(2);
      expect(history[0].ownerIdentityId).toBe(alice);
      expect(history[0].endsOn?.toISOString().slice(0, 10)).toBe('2026-06-01');
      expect(history[1].ownerIdentityId).toBe(bob);
      expect(history[1].endsOn).toBeNull();
    });

    it('moves the unit scalar in the same breath', async () => {
      await setUnitOwner(db, { unitId, ownerIdentityId: bob });

      const unit = await db.unit.findUnique({
        where: { id: unitId },
        select: { ownerIdentityId: true },
      });

      // The scalar is a denormalisation of the history, so the two can never
      // disagree — that is the whole reason they are written together.
      expect(unit?.ownerIdentityId).toBe(bob);
    });

    it('records nothing when the owner has not actually changed', async () => {
      const result = await setUnitOwner(db, { unitId, ownerIdentityId: alice });

      expect(result.changed).toBe(false);
      expect(await getOwnershipHistory(db, unitId)).toHaveLength(1);
    });

    it('refuses a transfer dated before the period it replaces', async () => {
      await expect(
        setUnitOwner(db, {
          unitId,
          ownerIdentityId: bob,
          effectiveFrom: new Date('2025-06-01'),
        })
      ).rejects.toThrow(/cannot start before/i);
    });

    it('can hand a unit back to no owner without losing the history', async () => {
      await setUnitOwner(db, {
        unitId,
        ownerIdentityId: null,
        effectiveFrom: new Date('2026-06-01'),
      });

      const unit = await db.unit.findUnique({
        where: { id: unitId },
        select: { ownerIdentityId: true },
      });
      const history = await getOwnershipHistory(db, unitId);

      expect(unit?.ownerIdentityId).toBeNull();
      expect(history).toHaveLength(1);
      expect(history[0].ownerIdentityId).toBe(alice);
      expect(history[0].endsOn).not.toBeNull();
    });
  });

  describe('asking who owned it then', () => {
    beforeEach(async () => {
      await setUnitOwner(db, {
        unitId,
        ownerIdentityId: bob,
        effectiveFrom: new Date('2026-06-01'),
      });
    });

    it('names the previous owner for a date inside their tenure', async () => {
      // The case that matters: a statement generated now for a period in March
      // must attribute to Alice, not to whoever holds the unit today.
      expect(await getOwnerAt(db, unitId, new Date('2026-03-15'))).toBe(alice);
    });

    it('names the current owner for today', async () => {
      expect(await getOwnerAt(db, unitId, new Date('2026-08-18'))).toBe(bob);
    });

    it('treats the handover day as the incoming owner-s, like a check-in', async () => {
      // Half-open ranges, the same convention bookings use.
      expect(await getOwnerAt(db, unitId, new Date('2026-06-01'))).toBe(bob);
      expect(await getOwnerAt(db, unitId, new Date('2026-05-31'))).toBe(alice);
    });

    it('answers null for a date before any recorded ownership', async () => {
      expect(await getOwnerAt(db, unitId, new Date('2025-01-01'))).toBeNull();
    });
  });

  describe('the database, not the service, is the guarantee', () => {
    it('refuses two owners of one unit on the same day', async () => {
      // A concurrent transfer that skipped setUnitOwner would otherwise leave
      // the unit with two owners of record.
      await expect(
        db.ownershipPeriod.create({
          data: {
            unitId,
            ownerIdentityId: bob,
            startsOn: new Date('2026-03-01'),
          },
        })
      ).rejects.toThrow();
    });

    it('refuses a period that ends before it starts', async () => {
      const carol = await createIdentity({ firstName: 'Carol' });

      await expect(
        db.ownershipPeriod.create({
          data: {
            unitId,
            ownerIdentityId: carol.id,
            startsOn: new Date('2027-06-01'),
            endsOn: new Date('2027-01-01'),
          },
        })
      ).rejects.toThrow();
    });

    it('allows a later period once the earlier one is closed', async () => {
      await setUnitOwner(db, {
        unitId,
        ownerIdentityId: bob,
        effectiveFrom: new Date('2026-06-01'),
      });

      expect(await getOwnershipHistory(db, unitId)).toHaveLength(2);
    });
  });

  describe('units that predate the history table', () => {
    it('opens a period from the unit-s own creation date', async () => {
      const project = await createProject();
      const owner = await createIdentity();
      const unit = await db.unit.create({
        data: {
          projectId: project.id,
          ownerIdentityId: owner.id,
          name: 'Legacy villa',
          unitType: 'villa',
          bedrooms: 2,
          bathrooms: 1,
          maxGuests: 4,
          addressSupplement: '1',
          baseNightlyThb: 1000,
          minNights: 1,
        },
      });

      await ensureOwnershipRecorded(db, unit.id);

      const history = await getOwnershipHistory(db, unit.id);
      expect(history).toHaveLength(1);
      expect(history[0].ownerIdentityId).toBe(owner.id);
    });

    it('is idempotent — running it twice does not duplicate the period', async () => {
      await ensureOwnershipRecorded(db, unitId);
      await ensureOwnershipRecorded(db, unitId);

      expect(await getOwnershipHistory(db, unitId)).toHaveLength(1);
    });

    it('does nothing for a unit that has no owner', async () => {
      const project = await createProject();
      const unit = await createUnit({ projectId: project.id });

      expect(await ensureOwnershipRecorded(db, unit.id)).toBeNull();
      expect(await getOwnershipHistory(db, unit.id)).toHaveLength(0);
    });
  });
});
