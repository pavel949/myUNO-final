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
    // Anchor check-in to "now" — the route refunds against the live clock, so
    // fixed dates rotted into the past and silently turned this into a
    // 0%-refund late cancellation (fixed dates rotted).
    const day = 24 * 60 * 60 * 1000;
    const booking = await createBooking({
      unitId,
      projectId,
      guestIdentityId: guest.id,
      status: 'confirmed',
      startDate: new Date(Date.now() + 3 * day),
      endDate: new Date(Date.now() + 5 * day),
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

    const guestAlert = await db.notification.findFirst({
      where: { identityId: guest.id, type: 'stay_cancelled' },
    });
    expect(guestAlert).not.toBeNull();
    expect(guestAlert?.titleKey).toBe('notify.stay_cancelled.title');
    expect(guestAlert?.bodyKey).toBe('notify.stay_cancelled.body');

    const ownerAlert = await db.notification.findFirst({
      where: { identityId: owner.id, type: 'stay_cancelled' },
    });
    expect(ownerAlert).not.toBeNull();
    expect(ownerAlert?.titleKey).toBe('notify.stay_cancelled.owner_title');
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

  it('creates a requested cash refund record when a paid stay is cancelled', async () => {
    mockGetCurrentUser.mockResolvedValue(asUser(owner.id));
    const day = 24 * 60 * 60 * 1000;
    const booking = await createBooking({
      unitId,
      projectId,
      guestIdentityId: guest.id,
      status: 'confirmed',
      startDate: new Date(Date.now() + 3 * day),
      endDate: new Date(Date.now() + 5 * day),
      totalThb: 7000,
      cancellationPolicySnapshot: flexibleSnapshot,
    });

    const payment = await db.payment.create({
      data: {
        purpose: 'stay',
        bookingId: booking.id,
        payerIdentityId: guest.id,
        method: 'cash',
        provider: 'cash',
        amountThb: 7000,
        status: 'succeeded',
        succeededAt: new Date(),
      },
    });

    const res = await POST(makeRequest({ reason: 'host_requested' }), {
      params: { id: booking.id },
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.refund.amountThb).toBe(7000);
    expect(body.refund.issuedThb).toBe(7000);
    expect(body.refund.pendingThb).toBe(0);

    const refunds = await db.refund.findMany({ where: { paymentId: payment.id } });
    expect(refunds).toHaveLength(1);
    expect(refunds[0].amountThb).toBe(7000);
    expect(refunds[0].method).toBe('cash');
    expect(refunds[0].status).toBe('requested');
    expect(refunds[0].reason).toBe('cancellation');
  });

  it('creates a provider refund request for card payments on cancellation', async () => {
    mockGetCurrentUser.mockResolvedValue(asUser(owner.id));
    const day = 24 * 60 * 60 * 1000;
    const booking = await createBooking({
      unitId,
      projectId,
      guestIdentityId: guest.id,
      status: 'confirmed',
      startDate: new Date(Date.now() + 3 * day),
      endDate: new Date(Date.now() + 5 * day),
      totalThb: 9000,
      cancellationPolicySnapshot: flexibleSnapshot,
    });

    const payment = await db.payment.create({
      data: {
        purpose: 'stay',
        bookingId: booking.id,
        payerIdentityId: guest.id,
        method: 'card_provider',
        provider: 'mock',
        amountThb: 9000,
        status: 'succeeded',
        succeededAt: new Date(),
      },
    });

    const res = await POST(makeRequest({ reason: 'host_requested' }), {
      params: { id: booking.id },
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.refund.issuedThb).toBe(9000);
    expect(body.refund.pendingThb).toBe(0);

    const refunds = await db.refund.findMany({ where: { paymentId: payment.id } });
    expect(refunds).toHaveLength(1);
    expect(refunds[0].method).toBe('card_provider');
    expect(refunds[0].status).toBe('processing');

    const ledger = await db.ledgerEntry.findFirst({
      where: { paymentId: payment.id, refundId: refunds[0].id, entryType: 'refund_out' },
    });
    expect(ledger).not.toBeNull();
    expect(ledger?.amountThb).toBe(-9000);
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

    const guestAlert = await db.notification.findFirst({
      where: { identityId: guest.id, type: 'stay_cancelled' },
    });
    expect(guestAlert?.bodyKey).toBe('notify.stay_cancelled.body_no_refund');
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
