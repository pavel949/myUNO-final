import { describe, it, expect, beforeEach } from 'vitest';
import { db, resetDb, createIdentity, createProject, createUnit } from '@/test/util';
import * as bookingService from './booking.service';
import { importICalEvents } from '@/modules/integrations/ical-import';

/**
 * P0-4. A unit can be unavailable without a booking.
 *
 * Owner holds, maintenance windows and stays imported from an OTA all live in
 * `blocked_date`, a different table from `booking`. The exclusion constraint
 * cannot see across tables, so the two paths are kept apart by taking the same
 * per-unit advisory lock and checking inside the transaction.
 *
 * Before this, `resolveUnitForCategory` honoured blocks but `createBooking` did
 * not — a villa Airbnb had already sold could be sold again on the direct site.
 */
describe('blocked dates block a booking (P0-4)', () => {
  const RANGE = { start: new Date('2026-11-10'), end: new Date('2026-11-14') };

  beforeEach(async () => {
    await resetDb();
  });

  async function fixture() {
    const project = await createProject();
    const unit = await createUnit({ projectId: project.id, status: 'live' });
    const guest = await createIdentity();
    return { project, unit, guest };
  }

  function bookingFor(projectId: string, unitId: string, guestIdentityId: string, range = RANGE) {
    return {
      unitId,
      projectId,
      guestIdentityId,
      bookingType: 'guest_stay' as const,
      channel: 'direct' as const,
      startDate: range.start,
      endDate: range.end,
      adults: 2,
      children: 0,
      totalThb: 10_000,
      instantBook: true,
    };
  }

  async function block(unitId: string, reason: 'owner_hold' | 'maintenance' | 'ota_import') {
    return db.blockedDate.create({
      data: { unitId, startDate: RANGE.start, endDate: RANGE.end, reason },
    });
  }

  it('refuses a stay over an owner hold', async () => {
    const { project, unit, guest } = await fixture();
    await block(unit.id, 'owner_hold');

    await expect(
      bookingService.createBooking(db, bookingFor(project.id, unit.id, guest.id))
    ).rejects.toMatchObject({ code: 'DOUBLE_BOOK', blockReason: 'owner_hold' });

    expect(await db.booking.count({ where: { unitId: unit.id } })).toBe(0);
  });

  it('refuses a stay over a maintenance window', async () => {
    const { project, unit, guest } = await fixture();
    await block(unit.id, 'maintenance');

    await expect(
      bookingService.createBooking(db, bookingFor(project.id, unit.id, guest.id))
    ).rejects.toMatchObject({ code: 'DOUBLE_BOOK', blockReason: 'maintenance' });
  });

  it('refuses a stay over a range imported from an OTA', async () => {
    const { project, unit, guest } = await fixture();
    await block(unit.id, 'ota_import');

    // The case that costs real money: Airbnb already sold these nights.
    await expect(
      bookingService.createBooking(db, bookingFor(project.id, unit.id, guest.id))
    ).rejects.toMatchObject({ code: 'DOUBLE_BOOK', blockReason: 'ota_import' });
  });

  it('refuses a stay that only partially overlaps a block', async () => {
    const { project, unit, guest } = await fixture();
    await block(unit.id, 'owner_hold');

    await expect(
      bookingService.createBooking(
        db,
        bookingFor(project.id, unit.id, guest.id, {
          start: new Date('2026-11-12'),
          end: new Date('2026-11-18'),
        })
      )
    ).rejects.toMatchObject({ code: 'DOUBLE_BOOK' });
  });

  it('allows a stay that starts the day a block ends', async () => {
    const { project, unit, guest } = await fixture();
    await block(unit.id, 'maintenance');

    // Half-open ranges, same rule the booking overlap uses.
    const booking = await bookingService.createBooking(
      db,
      bookingFor(project.id, unit.id, guest.id, {
        start: new Date('2026-11-14'),
        end: new Date('2026-11-18'),
      })
    );

    expect(booking.id).toBeTruthy();
  });

  it('ignores a block on a different unit', async () => {
    const { project, unit, guest } = await fixture();
    const other = await createUnit({ projectId: project.id, name: 'OTHER', status: 'live' });
    await block(other.id, 'owner_hold');

    const booking = await bookingService.createBooking(
      db,
      bookingFor(project.id, unit.id, guest.id)
    );

    expect(booking.id).toBeTruthy();
  });

  describe('racing an OTA import against a direct booking', () => {
    it('lets only one of them take the nights', async () => {
      const { project, unit, guest } = await fixture();
      const account = await db.integrationAccount.create({
        data: {
          integrationKey: 'ical_airbnb',
          scopeType: 'unit',
          unitId: unit.id,
          projectId: project.id,
          status: 'active',
          config: {},
        },
      });

      const results = await Promise.allSettled([
        bookingService.createBooking(db, bookingFor(project.id, unit.id, guest.id)),
        importICalEvents(db, account.id, unit.id, [
          {
            uid: 'airbnb-evt-1',
            dtStart: RANGE.start,
            dtEnd: RANGE.end,
            summary: 'Reserved (Airbnb)',
          },
        ]),
      ]);

      const bookings = await db.booking.count({
        where: {
          unitId: unit.id,
          status: { in: ['pending_payment', 'confirmed', 'checked_in'] },
        },
      });
      const blocks = await db.blockedDate.count({ where: { unitId: unit.id } });

      // Exactly one side owns the range — never both.
      expect(bookings + blocks).toBe(1);
      expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
    });
  });
});
