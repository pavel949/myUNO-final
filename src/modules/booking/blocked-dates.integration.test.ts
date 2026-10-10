import { describe, it, expect, beforeEach } from 'vitest';
import { db, resetDb, createIdentity, createProject, createUnit } from '@/test/util';
import { createManualBlock } from '@/modules/core';
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
    const project = await createProject({ status: 'live' });
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

  it('refuses to approve a request after an owner hold takes its villa', async () => {
    const { project, unit, guest } = await fixture();
    const request = await bookingService.createBooking(db, {
      ...bookingFor(project.id, unit.id, guest.id), instantBook: false,
    });
    await block(unit.id, 'owner_hold');

    await expect(bookingService.approveBookingRequest(db, { authorizeCandidate: async () => true, bookingId: request.id }))
      .rejects.toMatchObject({ code: 'DOUBLE_BOOK', blockReason: 'owner_hold' });
    expect((await db.booking.findUniqueOrThrow({ where: { id: request.id } })).status)
      .toBe('requested');
  });

  it('refuses to approve a request after its villa is unpublished', async () => {
    const { project, unit, guest } = await fixture();
    const request = await bookingService.createBooking(db, {
      ...bookingFor(project.id, unit.id, guest.id), instantBook: false,
    });
    await db.unit.update({ where: { id: unit.id }, data: { status: 'draft' } });

    await expect(bookingService.approveBookingRequest(db, { authorizeCandidate: async () => true, bookingId: request.id }))
      .rejects.toMatchObject({ code: 'DOUBLE_BOOK' });
    expect((await db.booking.findUniqueOrThrow({ where: { id: request.id } })).status)
      .toBe('requested');
  });

  it('refuses an expired request even when the expiry job has not run', async () => {
    const { project, unit, guest } = await fixture();
    const request = await bookingService.createBooking(db, {
      ...bookingFor(project.id, unit.id, guest.id), instantBook: false,
    });
    await db.booking.update({
      where: { id: request.id },
      data: { requestExpiresAt: new Date(Date.now() - 60_000) },
    });

    await expect(bookingService.approveBookingRequest(db, { authorizeCandidate: async () => true, bookingId: request.id }))
      .rejects.toMatchObject({ code: 'BOOKING_REQUEST_EXPIRED' });
    const current = await db.booking.findUniqueOrThrow({ where: { id: request.id } });
    expect(current.status).toBe('requested');
    expect(current.holdExpiresAt).toBeNull();
  });

  it('reassigns a category request when its original villa was blocked', async () => {
    const project = await createProject({ status: 'live' });
    const original = await createUnit({
      projectId: project.id, name: 'A-01', categoryKey: 'superior_2br',
      status: 'live', instantBook: false,
    });
    const replacement = await createUnit({
      projectId: project.id, name: 'B-02', categoryKey: 'superior_2br',
      status: 'live', instantBook: false,
    });
    const guest = await createIdentity();
    const request = await bookingService.createBooking(db, {
      ...bookingFor(project.id, original.id, guest.id), instantBook: false,
      inventoryCategoryId: original.inventoryCategoryId!,
    });
    await block(original.id, 'maintenance');

    const approved = await bookingService.approveBookingRequest(db, { authorizeCandidate: async () => true, bookingId: request.id });
    expect(approved.status).toBe('pending_payment');
    expect(approved.unitId).toBe(replacement.id);
    expect(await db.blockedDate.count({ where: { unitId: original.id } })).toBe(1);
  });

  it('keeps a request open when every available replacement exceeds its accepted total', async () => {
    const project = await createProject({ status: 'live' });
    const original = await createUnit({
      projectId: project.id, name: 'A-01', categoryKey: 'superior_2br',
      status: 'live', instantBook: false,
    });
    const replacement = await createUnit({
      projectId: project.id, name: 'B-02', categoryKey: 'superior_2br',
      status: 'live', instantBook: false,
    });
    const guest = await createIdentity();
    const request = await bookingService.createBooking(db, {
      ...bookingFor(project.id, original.id, guest.id), instantBook: false,
      inventoryCategoryId: original.inventoryCategoryId!,
    });
    await db.pricingRule.create({
      data: {
        unitId: replacement.id, startDate: RANGE.start, endDate: RANGE.end,
        nightlyThb: 100_000_000, label: 'Replacement premium',
      },
    });
    await block(original.id, 'maintenance');

    await expect(bookingService.approveBookingRequest(db, { authorizeCandidate: async () => true, bookingId: request.id }))
      .rejects.toMatchObject({ code: 'REQUOTE_REQUIRED' });
    const current = await db.booking.findUniqueOrThrow({ where: { id: request.id } });
    expect(current.status).toBe('requested');
    expect(current.unitId).toBe(original.id);
    expect(current.totalThb).toBe(request.totalThb);
  });

  it('allows either approval or a manual block to claim the dates, never both', async () => {
    const { project, unit, guest } = await fixture();
    const request = await bookingService.createBooking(db, {
      ...bookingFor(project.id, unit.id, guest.id), instantBook: false,
    });

    const [approval, manualBlock] = await Promise.allSettled([
      bookingService.approveBookingRequest(db, { authorizeCandidate: async () => true, bookingId: request.id }),
      createManualBlock(db, {
        unitId: unit.id, startDate: RANGE.start, endDate: RANGE.end,
        reason: 'maintenance', createdByIdentityId: guest.id,
      }),
    ]);
    expect(Number(approval.status === 'fulfilled') + Number(manualBlock.status === 'fulfilled'))
      .toBe(1);
    const activeBookings = await db.booking.count({
      where: { id: request.id, status: 'pending_payment' },
    });
    const blocks = await db.blockedDate.count({ where: { unitId: unit.id } });
    expect(activeBookings + blocks).toBe(1);
    if (approval.status === 'rejected') {
      expect(approval.reason).toMatchObject({ code: 'DOUBLE_BOOK' });
    }
    if (manualBlock.status === 'rejected') {
      expect(manualBlock.reason).toMatchObject({ code: 'BOOKING_CONFLICT' });
    }
  });

  it('allows only one concurrent approval or decline of a request', async () => {
    const { project, unit, guest } = await fixture();
    const request = await bookingService.createBooking(db, {
      ...bookingFor(project.id, unit.id, guest.id), instantBook: false,
    });

    const [approval, decline] = await Promise.allSettled([
      bookingService.approveBookingRequest(db, { authorizeCandidate: async () => true, bookingId: request.id }),
      bookingService.declineBookingRequest(db, {
        bookingId: request.id, declinedByIdentityId: guest.id,
      }),
    ]);
    expect(Number(approval.status === 'fulfilled') + Number(decline.status === 'fulfilled'))
      .toBe(1);
    const final = await db.booking.findUniqueOrThrow({ where: { id: request.id } });
    expect(final.status).toBe(approval.status === 'fulfilled' ? 'pending_payment' : 'declined');
    if (approval.status === 'rejected') {
      expect(approval.reason).toMatchObject({ code: 'BOOKING_STATE_CHANGED' });
    }
    if (decline.status === 'rejected') {
      expect(decline.reason).toMatchObject({ code: 'BOOKING_STATE_CHANGED' });
    }
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

      // Exactly one side owns the range — never both. This is the invariant.
      expect(bookings + blocks).toBe(1);

      // Which side wins depends on which transaction commits first, and losing
      // is a legitimate outcome rather than an error to be avoided: the importer
      // records a conflict and returns, while the booking refuses with
      // DOUBLE_BOOK. What must never happen is the booking failing for some
      // other reason — a driver error escaping, say — so that is what is checked.
      const [bookingResult, importResult] = results;
      if (bookingResult.status === 'rejected') {
        expect(bookingResult.reason).toMatchObject({ code: 'DOUBLE_BOOK' });
        expect(blocks).toBe(1);
      } else {
        expect(bookings).toBe(1);
      }
      expect(importResult.status).toBe('fulfilled');
    });
  });
});
