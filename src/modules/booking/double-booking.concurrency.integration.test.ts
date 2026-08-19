import { describe, it, expect, beforeEach } from 'vitest';
import { db, resetDb, createIdentity, createProject, createUnit } from '@/test/util';
import * as bookingService from './booking.service';

/**
 * The invariant this file exists for: a unit can be sold once for a given night.
 *
 * The application's pre-flight read cannot deliver that on its own — two requests
 * can both read a free calendar before either writes. The proof therefore has to
 * come from the `booking_no_overlap` exclusion constraint, which is why these
 * tests race real concurrent calls instead of asserting on the read.
 */
describe('double-booking prevention (P0-1)', () => {
  const RANGE = { start: new Date('2026-09-10'), end: new Date('2026-09-14') };

  beforeEach(async () => {
    await resetDb();
  });

  async function fixture() {
    const project = await createProject();
    const unit = await createUnit({ projectId: project.id, status: 'live' });
    return { project, unit };
  }

  function bookingFor(projectId: string, unitId: string, guestIdentityId: string) {
    return {
      unitId,
      projectId,
      guestIdentityId,
      bookingType: 'guest_stay' as const,
      channel: 'direct' as const,
      startDate: RANGE.start,
      endDate: RANGE.end,
      adults: 2,
      children: 0,
      totalThb: 10_000,
      instantBook: true,
    };
  }

  it('lets exactly one of two simultaneous checkouts take the last unit', async () => {
    const { project, unit } = await fixture();
    const [guestA, guestB] = await Promise.all([createIdentity(), createIdentity()]);

    const results = await Promise.allSettled([
      bookingService.createBooking(db, bookingFor(project.id, unit.id, guestA.id)),
      bookingService.createBooking(db, bookingFor(project.id, unit.id, guestB.id)),
    ]);

    const won = results.filter((r) => r.status === 'fulfilled');
    const lost = results.filter((r) => r.status === 'rejected');

    expect(won).toHaveLength(1);
    expect(lost).toHaveLength(1);

    // The loser gets the domain error, not a raw driver error — the API layer
    // maps DOUBLE_BOOK onto a 409 with alternatives.
    const rejection = (lost[0] as PromiseRejectedResult).reason;
    expect((rejection as { code?: string }).code).toBe('DOUBLE_BOOK');

    const stored = await db.booking.findMany({ where: { unitId: unit.id } });
    expect(stored).toHaveLength(1);
  });

  it('holds the line under a wider stampede', async () => {
    const { project, unit } = await fixture();
    const guests = await Promise.all(Array.from({ length: 8 }, () => createIdentity()));

    const results = await Promise.allSettled(
      guests.map((g) => bookingService.createBooking(db, bookingFor(project.id, unit.id, g.id)))
    );

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);

    const blocking = await db.booking.findMany({
      where: { unitId: unit.id, status: { in: ['pending_payment', 'confirmed', 'checked_in'] } },
    });
    expect(blocking).toHaveLength(1);
  });

  it('refuses a second booking that overlaps only partially', async () => {
    const { project, unit } = await fixture();
    const [guestA, guestB] = await Promise.all([createIdentity(), createIdentity()]);

    await bookingService.createBooking(db, bookingFor(project.id, unit.id, guestA.id));

    await expect(
      bookingService.createBooking(db, {
        ...bookingFor(project.id, unit.id, guestB.id),
        startDate: new Date('2026-09-12'),
        endDate: new Date('2026-09-16'),
      })
    ).rejects.toMatchObject({ code: 'DOUBLE_BOOK' });
  });

  it('allows a back-to-back stay starting the day the previous one ends', async () => {
    const { project, unit } = await fixture();
    const [guestA, guestB] = await Promise.all([createIdentity(), createIdentity()]);

    await bookingService.createBooking(db, bookingFor(project.id, unit.id, guestA.id));

    // Half-open ranges: checkout on the 14th frees the 14th for the next arrival.
    const nextGuest = await bookingService.createBooking(db, {
      ...bookingFor(project.id, unit.id, guestB.id),
      startDate: new Date('2026-09-14'),
      endDate: new Date('2026-09-18'),
    });

    expect(nextGuest.id).toBeTruthy();
  });

  it('frees the dates once an abandoned hold has lapsed', async () => {
    const { project, unit } = await fixture();
    const [guestA, guestB] = await Promise.all([createIdentity(), createIdentity()]);

    const abandoned = await bookingService.createBooking(
      db,
      bookingFor(project.id, unit.id, guestA.id)
    );
    await db.booking.update({
      where: { id: abandoned.id },
      data: { holdExpiresAt: new Date(Date.now() - 60_000) },
    });

    // No expireHolds run in between: createBooking retires the lapsed hold itself,
    // so a guest is never turned away by a checkout somebody walked out of.
    const nextGuest = await bookingService.createBooking(
      db,
      bookingFor(project.id, unit.id, guestB.id)
    );

    expect(nextGuest.id).toBeTruthy();
    const lapsed = await db.booking.findUniqueOrThrow({ where: { id: abandoned.id } });
    expect(lapsed.status).toBe('expired');
  });

  it('rejects a cancelled booking being revived onto dates that were resold', async () => {
    const { project, unit } = await fixture();
    const [guestA, guestB] = await Promise.all([createIdentity(), createIdentity()]);

    const first = await bookingService.createBooking(db, bookingFor(project.id, unit.id, guestA.id));
    await db.booking.update({ where: { id: first.id }, data: { status: 'cancelled' } });

    await bookingService.createBooking(db, bookingFor(project.id, unit.id, guestB.id));

    // The constraint governs status changes too, not only inserts.
    await expect(
      db.booking.update({ where: { id: first.id }, data: { status: 'confirmed' } })
    ).rejects.toThrow();
  });
});
