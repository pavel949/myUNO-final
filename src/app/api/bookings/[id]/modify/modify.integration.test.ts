import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  db,
  resetDb,
  createIdentity,
  createProject,
  createUnit,
  createBooking,
} from '@/test/util';

const mockGetCurrentUser = vi.fn();
vi.mock('@/app/actions/getCurrentUser', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

vi.mock('@/lib/prisma', async () => {
  const util = await import('@/test/util');
  return { prisma: util.db };
});

import { POST } from './route';

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/bookings/x/modify', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/bookings/[id]/modify', () => {
  let guest: Awaited<ReturnType<typeof createIdentity>>;
  let projectId: string;
  let unitId: string;

  beforeEach(async () => {
    await resetDb();
    guest = await createIdentity({ firstName: 'Guest' });
    const project = await createProject({ status: 'live' });
    projectId = project.id;
    // baseNightlyThb 1000 so night math is easy to assert
    const unit = await createUnit({ projectId, baseNightlyThb: 1000, minNights: 1 });
    unitId = unit.id;
  });

  const asUser = (identityId: string) => ({
    identityId,
    email: 'x@test.com',
    firstName: 'X',
    lastName: 'Y',
    isAdmin: false,
    roles: [],
  });

  it('extends a booking and reports the balance due', async () => {
    mockGetCurrentUser.mockResolvedValue(asUser(guest.id));
    const booking = await createBooking({
      unitId,
      projectId,
      guestIdentityId: guest.id,
      status: 'confirmed',
      startDate: new Date('2026-08-15'),
      endDate: new Date('2026-08-17'), // 2 nights
      totalThb: 2000,
    });

    const res = await POST(makeRequest({ endDate: '2026-08-18' }), {
      params: { id: booking.id },
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.booking.totalThb).toBe(3000);
    expect(body.pricing.balanceThb).toBe(1000);
  });

  it('shortens a booking and accrues a refund', async () => {
    mockGetCurrentUser.mockResolvedValue(asUser(guest.id));
    const booking = await createBooking({
      unitId,
      projectId,
      guestIdentityId: guest.id,
      status: 'confirmed',
      startDate: new Date('2026-08-20'),
      endDate: new Date('2026-08-23'), // 3 nights
      totalThb: 3000,
    });

    const res = await POST(makeRequest({ endDate: '2026-08-22' }), {
      params: { id: booking.id },
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.booking.totalThb).toBe(2000);
    expect(body.pricing.balanceThb).toBe(-1000);
    expect(body.booking.refundAccruedThb).toBe(1000);
  });

  it('changes party size', async () => {
    mockGetCurrentUser.mockResolvedValue(asUser(guest.id));
    const booking = await createBooking({
      unitId,
      projectId,
      guestIdentityId: guest.id,
      status: 'confirmed',
      startDate: new Date('2026-08-25'),
      endDate: new Date('2026-08-27'),
      totalThb: 2000,
    });

    const res = await POST(makeRequest({ adultsCount: 3, childrenCount: 1 }), {
      params: { id: booking.id },
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.booking.adults).toBe(3);
    expect(body.booking.children).toBe(1);
  });

  it('never leaks the guest password hash in the response', async () => {
    mockGetCurrentUser.mockResolvedValue(asUser(guest.id));
    const booking = await createBooking({
      unitId,
      projectId,
      guestIdentityId: guest.id,
      status: 'confirmed',
      startDate: new Date('2026-08-25'),
      endDate: new Date('2026-08-27'),
      totalThb: 2000,
    });

    const res = await POST(makeRequest({ adultsCount: 3 }), {
      params: { id: booking.id },
    });
    const raw = JSON.stringify(await res.json());
    expect(raw).not.toContain('hashedPassword');
  });

  it('detects an availability conflict when extending into another booking', async () => {
    mockGetCurrentUser.mockResolvedValue(asUser(guest.id));
    const booking1 = await createBooking({
      unitId,
      projectId,
      guestIdentityId: guest.id,
      status: 'confirmed',
      startDate: new Date('2026-09-01'),
      endDate: new Date('2026-09-03'),
      totalThb: 2000,
    });
    const otherGuest = await createIdentity({ firstName: 'Other' });
    await createBooking({
      unitId,
      projectId,
      guestIdentityId: otherGuest.id,
      status: 'confirmed',
      startDate: new Date('2026-09-05'),
      endDate: new Date('2026-09-07'),
      totalThb: 2000,
    });

    const res = await POST(makeRequest({ endDate: '2026-09-06' }), {
      params: { id: booking1.id },
    });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('unavailable');
  });

  it('rejects an unauthorized modifier with 403', async () => {
    const stranger = await createIdentity({ firstName: 'Stranger' });
    mockGetCurrentUser.mockResolvedValue(asUser(stranger.id));
    const booking = await createBooking({
      unitId,
      projectId,
      guestIdentityId: guest.id,
      status: 'confirmed',
      startDate: new Date('2026-09-10'),
      endDate: new Date('2026-09-12'),
      totalThb: 2000,
    });

    const res = await POST(makeRequest({ endDate: '2026-09-13' }), {
      params: { id: booking.id },
    });
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toContain('authorized');
  });

  it('cannot modify a non-confirmed booking', async () => {
    mockGetCurrentUser.mockResolvedValue(asUser(guest.id));
    const booking = await createBooking({
      unitId,
      projectId,
      guestIdentityId: guest.id,
      status: 'pending_payment',
      startDate: new Date('2026-09-15'),
      endDate: new Date('2026-09-17'),
      totalThb: 2000,
    });

    const res = await POST(makeRequest({ endDate: '2026-09-18' }), {
      params: { id: booking.id },
    });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('Cannot modify booking');
  });
});
