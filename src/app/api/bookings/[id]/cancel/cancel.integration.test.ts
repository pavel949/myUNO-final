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
import { DEFAULT_POLICIES } from '@/modules/booking';

const mockGetCurrentUser = vi.fn();
vi.mock('@/app/actions/getCurrentUser', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

vi.mock('@/lib/prisma', async () => {
  const util = await import('@/test/util');
  return { prisma: util.db };
});

import { POST } from './route';

function makeRequest(body?: unknown): NextRequest {
  return new NextRequest('http://localhost/api/bookings/x/cancel', {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
    headers: { 'Content-Type': 'application/json' },
  });
}

const flexibleSnapshot = { name: 'flexible', steps: DEFAULT_POLICIES.flexible.steps };

describe('POST /api/bookings/[id]/cancel', () => {
  let guest: Awaited<ReturnType<typeof createIdentity>>;
  let owner: Awaited<ReturnType<typeof createIdentity>>;
  let projectId: string;
  let unitId: string;

  beforeEach(async () => {
    await resetDb();
    guest = await createIdentity({ firstName: 'Guest' });
    owner = await createIdentity({ firstName: 'Owner' });
    const project = await createProject({ status: 'live' });
    projectId = project.id;
    const unit = await createUnit({ projectId, ownerIdentityId: owner.id });
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

  it('guest cancels a confirmed flexible booking with full refund 2+ days out', async () => {
    mockGetCurrentUser.mockResolvedValue(asUser(guest.id));
    const booking = await createBooking({
      unitId,
      projectId,
      guestIdentityId: guest.id,
      status: 'confirmed',
      startDate: new Date('2026-08-15'),
      endDate: new Date('2026-08-17'),
      totalThb: 8000,
      cancellationPolicySnapshot: flexibleSnapshot,
    });

    const res = await POST(makeRequest({ reason: 'guest_requested' }), {
      params: { id: booking.id },
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.booking.status).toBe('cancelled');
    expect(body.refund.amountThb).toBe(8000);
  });

  it('never leaks the guest password hash in the response', async () => {
    mockGetCurrentUser.mockResolvedValue(asUser(guest.id));
    const booking = await createBooking({
      unitId,
      projectId,
      guestIdentityId: guest.id,
      status: 'confirmed',
      totalThb: 5000,
      cancellationPolicySnapshot: flexibleSnapshot,
    });

    const res = await POST(makeRequest({ reason: 'guest_requested' }), {
      params: { id: booking.id },
    });
    const raw = JSON.stringify(await res.json());
    expect(raw).not.toContain('hashedPassword');
  });

  it('host (unit owner) can cancel a guest booking', async () => {
    mockGetCurrentUser.mockResolvedValue(asUser(owner.id));
    const booking = await createBooking({
      unitId,
      projectId,
      guestIdentityId: guest.id,
      status: 'confirmed',
      totalThb: 5000,
      cancellationPolicySnapshot: flexibleSnapshot,
    });

    const res = await POST(makeRequest({ reason: 'host_requested' }), {
      params: { id: booking.id },
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.booking.status).toBe('cancelled');
  });

  it('lets a guest withdraw a pending request (no refund owed)', async () => {
    mockGetCurrentUser.mockResolvedValue(asUser(guest.id));
    const booking = await createBooking({
      unitId,
      projectId,
      guestIdentityId: guest.id,
      status: 'requested',
      totalThb: 5000,
      cancellationPolicySnapshot: flexibleSnapshot,
    });

    const res = await POST(makeRequest({ reason: 'guest_withdrew' }), {
      params: { id: booking.id },
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.booking.status).toBe('cancelled');
    expect(body.refund.amountThb).toBe(0);
  });

  it('rejects an unauthorized canceller with 403', async () => {
    const stranger = await createIdentity({ firstName: 'Stranger' });
    mockGetCurrentUser.mockResolvedValue(asUser(stranger.id));
    const booking = await createBooking({
      unitId,
      projectId,
      guestIdentityId: guest.id,
      status: 'confirmed',
      totalThb: 5000,
      cancellationPolicySnapshot: flexibleSnapshot,
    });

    const res = await POST(makeRequest(), { params: { id: booking.id } });
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toContain('authorized');
  });
});
