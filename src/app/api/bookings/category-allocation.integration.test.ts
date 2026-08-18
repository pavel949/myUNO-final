import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { db, resetDb, createIdentity, createProject, createUnit } from '@/test/util';
import { seedConfig } from '@/modules/config';

const mockGetCurrentUser = vi.fn();
vi.mock('@/app/actions/getCurrentUser', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

vi.mock('@/lib/prisma', async () => {
  const util = await import('@/test/util');
  return { prisma: util.db };
});

import { POST } from './route';

/**
 * Category-first booking (LY-6) must not lose a sale it can honour.
 *
 * Availability is read outside the booking transaction, so the villa chosen may
 * be taken before we commit. The old code picked one villa and gave up if it
 * lost that race — telling the guest the category was unavailable while a
 * sibling villa stood empty. Two concurrent bookings of a two-villa category
 * therefore failed one of them, deterministically, because both reads returned
 * the same first villa.
 */
describe('category booking falls through to the next villa', () => {
  const START = '2026-11-10';
  const END = '2026-11-14';

  let projectId: string;

  beforeEach(async () => {
    await resetDb();
    await seedConfig(db);

    const project = await createProject({ status: 'live' });
    projectId = project.id;
  });

  async function villa(name: string) {
    return createUnit({
      projectId,
      name,
      status: 'live',
      categoryKey: 'garden_villa',
      baseNightlyThb: 500_000,
      instantBook: true,
    });
  }

  function request(body: unknown): NextRequest {
    return new NextRequest('http://localhost/api/bookings', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  function categoryBooking() {
    return request({
      categoryKey: 'garden_villa',
      projectId,
      startDate: START,
      endDate: END,
      adultsCount: 2,
      childrenCount: 0,
      paymentMethod: 'cash',
    });
  }

  it('houses both of two simultaneous guests when the category has two villas', async () => {
    await villa('Villa A');
    await villa('Villa B');

    const guestOne = await createIdentity();
    const guestTwo = await createIdentity();

    // Both reads see Villa A free, so both attempt it. One loses and must be
    // moved to Villa B rather than refused.
    const [first, second] = await Promise.all([
      (async () => {
        mockGetCurrentUser.mockReturnValue({ identityId: guestOne.id, isAdmin: false });
        return POST(categoryBooking());
      })(),
      (async () => {
        mockGetCurrentUser.mockReturnValue({ identityId: guestTwo.id, isAdmin: false });
        return POST(categoryBooking());
      })(),
    ]);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);

    const bookings = await db.booking.findMany({
      where: { projectId },
      select: { unitId: true },
    });

    expect(bookings).toHaveLength(2);
    // Two guests, two villas — never the same villa twice.
    expect(new Set(bookings.map((b) => b.unitId)).size).toBe(2);
  });

  it('still refuses when the category genuinely has nothing left', async () => {
    await villa('Villa A');

    const guestOne = await createIdentity();
    mockGetCurrentUser.mockReturnValue({ identityId: guestOne.id, isAdmin: false });
    const taken = await POST(categoryBooking());
    expect(taken.status).toBe(201);

    const guestTwo = await createIdentity();
    mockGetCurrentUser.mockReturnValue({ identityId: guestTwo.id, isAdmin: false });
    const refused = await POST(categoryBooking());

    expect(refused.status).toBe(409);
    expect(await db.booking.count({ where: { projectId } })).toBe(1);
  });

  it('skips a villa held by an owner block and books the free one', async () => {
    const a = await villa('Villa A');
    const b = await villa('Villa B');

    await db.blockedDate.create({
      data: {
        unitId: a.id,
        startDate: new Date(START),
        endDate: new Date(END),
        reason: 'owner_hold',
      },
    });

    const guest = await createIdentity();
    mockGetCurrentUser.mockReturnValue({ identityId: guest.id, isAdmin: false });

    const res = await POST(categoryBooking());
    expect(res.status).toBe(201);

    const booking = await db.booking.findFirst({ where: { projectId } });
    expect(booking?.unitId).toBe(b.id);
  });

  it('prices the villa it actually books, not the one it first considered', async () => {
    // Two villas of one category at different rates: whichever is booked, the
    // stored total has to be that villa's, or the guest is charged for a room
    // they are not in.
    const a = await villa('Villa A');
    await db.unit.update({ where: { id: a.id }, data: { baseNightlyThb: 900_000 } });
    const b = await villa('Villa B');
    await db.unit.update({ where: { id: b.id }, data: { baseNightlyThb: 100_000 } });

    await db.blockedDate.create({
      data: {
        unitId: a.id,
        startDate: new Date(START),
        endDate: new Date(END),
        reason: 'maintenance',
      },
    });

    const guest = await createIdentity();
    mockGetCurrentUser.mockReturnValue({ identityId: guest.id, isAdmin: false });

    const res = await POST(categoryBooking());
    expect(res.status).toBe(201);

    const booking = await db.booking.findFirst({ where: { projectId } });
    expect(booking?.unitId).toBe(b.id);
    // Four nights of the cheaper villa, not the pricier one it skipped.
    expect(booking?.totalThb).toBeLessThan(900_000 * 4);
  });
});
