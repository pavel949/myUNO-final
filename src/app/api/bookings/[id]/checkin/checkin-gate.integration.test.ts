import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createBooking, createIdentity, createProject, createUnit, db, resetDb } from '@/test/util';

const mockGetCurrentUser = vi.fn();
vi.mock('@/app/actions/getCurrentUser', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

vi.mock('@/lib/prisma', async () => {
  const util = await import('@/test/util');
  return { prisma: util.db };
});

import { POST as checkIn } from './route';

function postRequest(): NextRequest {
  return new NextRequest('http://localhost/api/bookings/x/checkin', { method: 'POST' });
}

/**
 * The check-in route is where the TM30 clock starts. These tests pin the two
 * guarantees the audit found missing: a check-in that cannot produce TM30
 * filings is refused (with a reason the operator can read), and a successful
 * one always produces a filing per foreign guest, in the same transaction.
 */
describe('POST /api/bookings/[id]/checkin — TM30-safe check-in', () => {
  let bookingId: string;

  beforeEach(async () => {
    await resetDb();
    const admin = await createIdentity({ firstName: 'Admin' });
    const guest = await createIdentity({ firstName: 'Guest' });
    const project = await createProject({ status: 'live' });
    const unit = await createUnit({ projectId: project.id, status: 'live' });
    const now = new Date();
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const booking = await createBooking({
      unitId: unit.id,
      projectId: project.id,
      guestIdentityId: guest.id,
      status: 'confirmed',
      startDate: new Date(today - 86_400_000),
      endDate: new Date(today + 2 * 86_400_000),
      adults: 2,
      children: 0,
    });
    bookingId = booking.id;
    mockGetCurrentUser.mockResolvedValue({
      identityId: admin.id,
      email: admin.email,
      firstName: 'Admin',
      lastName: 'User',
      isAdmin: true,
      roles: [],
    });
  });

  it('refuses with a reason code when the party is not registered, and changes nothing', async () => {
    const response = await checkIn(postRequest(), { params: { id: bookingId } });
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.code).toBe('guests_incomplete');
    expect(typeof body.error).toBe('string');

    const booking = await db.booking.findUniqueOrThrow({ where: { id: bookingId } });
    expect(booking.status).toBe('confirmed');
    expect(await db.tm30Filing.count({ where: { bookingId } })).toBe(0);
  });

  it('refuses a foreign guest without a passport', async () => {
    await db.bookingGuest.createMany({
      data: [
        { bookingId, fullName: 'enc:A', nationality: 'RU', passportNumber: '', isLead: true },
        { bookingId, fullName: 'enc:B', nationality: 'RU', passportNumber: 'enc:P2' },
      ],
    });
    const response = await checkIn(postRequest(), { params: { id: bookingId } });
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe('passport_missing');
  });

  it('checks in and creates one TM30 filing per foreign guest', async () => {
    await db.bookingGuest.createMany({
      data: [
        { bookingId, fullName: 'enc:A', nationality: 'RU', passportNumber: 'enc:P1', isLead: true },
        { bookingId, fullName: 'enc:B', nationality: 'TH', passportNumber: '' },
      ],
    });
    const response = await checkIn(postRequest(), { params: { id: bookingId } });
    expect(response.status).toBe(200);
    expect((await response.json()).tm30FilingsCreated).toBe(1);

    const booking = await db.booking.findUniqueOrThrow({ where: { id: bookingId } });
    expect(booking.status).toBe('checked_in');
    expect(await db.tm30Filing.count({ where: { bookingId } })).toBe(1);
  });
});
