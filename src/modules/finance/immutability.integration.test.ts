import { describe, it, expect, beforeEach } from 'vitest';
import { db, resetDb, createIdentity, createProject, createUnit, createBooking } from '@/test/util';

/**
 * P1-1 and P1-3. Two promises CLAUDE.md makes, now enforced by the database.
 *
 * "Fee calculations are immutable" and "every role grant, config change and PII
 * access is audited" were both true only by convention. `price_breakdown` and
 * `cancellation_policy_snapshot` were ordinary updatable JSON; `audit_log` had
 * no trigger or revoke anywhere in the schema, so any code path could rewrite or
 * delete an entry.
 *
 * Nothing in the application did either — which is exactly when to add the
 * constraint, while it costs nothing and before someone disputes a statement.
 */
describe('financial records cannot be rewritten', () => {
  let bookingId: string;

  beforeEach(async () => {
    await resetDb();

    const project = await createProject();
    const unit = await createUnit({ projectId: project.id, status: 'live' });
    const guest = await createIdentity();
    const booking = await createBooking({
      unitId: unit.id,
      projectId: project.id,
      guestIdentityId: guest.id,
      status: 'confirmed',
    });

    bookingId = booking.id;
    await db.booking.update({
      where: { id: bookingId },
      data: {
        priceBreakdown: { nightly_thb: 500_000, nights: 4, total_thb: 2_000_000 },
        cancellationPolicySnapshot: { name: 'moderate', steps: [{ daysBefore: 7, refundPct: 50 }] },
      },
    });
  });

  describe('the price a booking was sold at', () => {
    it('refuses to be rewritten', async () => {
      await expect(
        db.booking.update({
          where: { id: bookingId },
          data: { priceBreakdown: { nightly_thb: 1, nights: 4, total_thb: 4 } },
        })
      ).rejects.toThrow(/immutable/i);
    });

    it('survives a later change to the unit-s rate — the mandatory financial test', async () => {
      // Master spec §20: a confirmed booking retains its original price, policy
      // and terms after future configuration changes.
      const before = await db.booking.findUnique({
        where: { id: bookingId },
        select: { priceBreakdown: true, cancellationPolicySnapshot: true },
      });

      const booking = await db.booking.findUniqueOrThrow({
        where: { id: bookingId },
        select: { unitId: true },
      });
      await db.unit.update({
        where: { id: booking.unitId },
        data: { baseNightlyThb: 999_999, cancellationPolicyKey: 'strict' },
      });

      const after = await db.booking.findUnique({
        where: { id: bookingId },
        select: { priceBreakdown: true, cancellationPolicySnapshot: true },
      });

      expect(after?.priceBreakdown).toEqual(before?.priceBreakdown);
      expect(after?.cancellationPolicySnapshot).toEqual(before?.cancellationPolicySnapshot);
    });

    it('refuses to have its agreed cancellation terms rewritten', async () => {
      await expect(
        db.booking.update({
          where: { id: bookingId },
          data: { cancellationPolicySnapshot: { name: 'strict', steps: [] } },
        })
      ).rejects.toThrow(/immutable/i);
    });

    it('refuses to have the snapshot cleared', async () => {
      // Deleting the record of terms is the same harm as changing it.
      await expect(
        db.booking.update({ where: { id: bookingId }, data: { priceBreakdown: undefined as never } })
      ).resolves.toBeTruthy(); // undefined = "don't touch", which is fine

      await expect(
        db.booking.update({ where: { id: bookingId }, data: { priceBreakdown: {} } })
      ).rejects.toThrow(/immutable/i);
    });
  });

  describe('what a booking may still do', () => {
    it('changes status, because a stay progresses', async () => {
      const updated = await db.booking.update({
        where: { id: bookingId },
        data: { status: 'checked_in', checkedInAt: new Date() },
      });

      expect(updated.status).toBe('checked_in');
    });

    it('changes its total when the guest extends, which is an agreed change', async () => {
      // total_thb is deliberately not frozen: an extension legitimately changes
      // what is owed. What must not change is the terms it was sold under.
      const updated = await db.booking.update({
        where: { id: bookingId },
        data: { totalThb: 2_500_000, endDate: new Date('2026-09-20') },
      });

      expect(updated.totalThb).toBe(2_500_000);
    });

    it('accepts a snapshot where none existed, so an older booking can be completed', async () => {
      const project = await createProject();
      const unit = await createUnit({ projectId: project.id, status: 'live' });
      const guest = await createIdentity();
      const bare = await createBooking({
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guest.id,
        startDate: new Date('2027-01-10'),
        endDate: new Date('2027-01-14'),
      });

      const filled = await db.booking.update({
        where: { id: bare.id },
        data: { priceBreakdown: { total_thb: 1000 } },
      });

      expect(filled.priceBreakdown).toEqual({ total_thb: 1000 });
    });
  });

  describe('the audit log is append-only', () => {
    async function anEntry() {
      const actor = await createIdentity();
      return db.auditLog.create({
        data: {
          actorIdentityId: actor.id,
          action: 'role.granted',
          entityType: 'identity',
          entityId: actor.id,
          data: { role: 'staff_ops' },
        },
      });
    }

    it('refuses an update', async () => {
      const entry = await anEntry();

      await expect(
        db.auditLog.update({ where: { id: entry.id }, data: { action: 'role.revoked' } })
      ).rejects.toThrow(/append-only/i);
    });

    it('refuses a delete', async () => {
      const entry = await anEntry();

      await expect(db.auditLog.delete({ where: { id: entry.id } })).rejects.toThrow(/append-only/i);
    });

    it('refuses a bulk delete, which is how a trail actually disappears', async () => {
      await anEntry();
      await anEntry();

      await expect(db.auditLog.deleteMany({ where: { action: 'role.granted' } })).rejects.toThrow(
        /append-only/i
      );
    });

    it('still accepts new entries — corrections are appended, not edited', async () => {
      const first = await anEntry();
      const correction = await anEntry();

      expect(correction.id).not.toBe(first.id);
      expect(await db.auditLog.count()).toBe(2);
    });
  });
});
