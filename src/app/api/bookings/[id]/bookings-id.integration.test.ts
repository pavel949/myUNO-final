import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  db,
  resetDb,
  createIdentity,
  createProject,
  createUnit,
  createBooking,
  createRoleAssignment,
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

import { GET } from './route';

function makeRequest(): NextRequest {
  return new NextRequest('http://localhost/api/bookings/x');
}

const asUser = (identityId: string) => ({
  identityId,
  email: 'x@test.com',
  firstName: 'X',
  lastName: 'Y',
  isAdmin: false,
  roles: [],
});

const flexibleSnapshot = { name: 'flexible', steps: DEFAULT_POLICIES.flexible.steps };

describe('GET /api/bookings/[id] — satang-to-baht display boundary (Q47)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('converts totalThb, refundAccruedThb, and refundPreviewThb to baht', async () => {
    const guest = await createIdentity({ firstName: 'Guest' });
    const owner = await createIdentity({ firstName: 'Owner' });
    const project = await createProject({ status: 'live' });
    const unit = await createUnit({ projectId: project.id, ownerIdentityId: owner.id });
    const day = 24 * 60 * 60 * 1000;

    // 800000 satang = ฿8,000 — a booking well outside the flexible policy's
    // cutoff, so the preview refund is the full amount.
    const booking = await createBooking({
      unitId: unit.id,
      projectId: project.id,
      guestIdentityId: guest.id,
      status: 'confirmed',
      startDate: new Date(Date.now() + 10 * day),
      endDate: new Date(Date.now() + 12 * day),
      totalThb: 800000,
      cancellationPolicySnapshot: flexibleSnapshot,
    });

    await db.payment.create({
      data: {
        purpose: 'stay',
        bookingId: booking.id,
        payerIdentityId: guest.id,
        method: 'card_provider',
        provider: 'mock',
        amountThb: 800000,
        status: 'succeeded',
        succeededAt: new Date(),
      },
    });

    mockGetCurrentUser.mockResolvedValue(asUser(guest.id));
    const response = await GET(makeRequest(), { params: { id: booking.id } });
    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data.totalThb).toBe(8000);
    expect(data.refundAccruedThb).toBe(0);
    expect(data.refundPreviewThb).toBe(8000);
  });
});

describe('GET /api/bookings/[id] — what each viewer may see', () => {
  beforeEach(async () => {
    await resetDb();
  });

  const INTERNAL_KEYS = [
    'internalNote',
    'creationKey',
    'creationFingerprint',
    'externalRef',
    'cancellationReason',
    'cancelledByIdentityId',
    'cancellationPolicySnapshot',
    'priceBreakdown',
    'guestIdentityId',
    'channel',
  ];

  async function world() {
    const guest = await createIdentity({ firstName: 'Guest' });
    const owner = await createIdentity({ firstName: 'Owner' });
    const staff = await createIdentity({ firstName: 'Staff' });
    const project = await createProject({ status: 'live' });
    await createRoleAssignment({ identityId: staff.id, role: 'staff_ops', scopeType: 'project', projectId: project.id });
    const unit = await createUnit({ projectId: project.id, ownerIdentityId: owner.id });
    const booking = await createBooking({
      unitId: unit.id,
      projectId: project.id,
      guestIdentityId: guest.id,
      status: 'confirmed',
      cancellationPolicySnapshot: flexibleSnapshot,
    });
    await db.booking.update({
      where: { id: booking.id },
      data: {
        internalNote: 'Guest was rude at the desk - do not upgrade',
        creationKey: '11111111-1111-4111-8111-111111111111',
        creationFingerprint: 'f'.repeat(64),
        externalRef: 'OTA-REF-42',
        cancellationReason: 'staff: fraud suspected',
        cancelledByIdentityId: staff.id,
        priceBreakdown: { platformCommission: 12345 },
        guestNote: 'Late arrival please',
      },
    });
    return { guest, owner, staff, booking };
  }

  async function read(identityId: string, bookingId: string, roles: unknown[] = []) {
    mockGetCurrentUser.mockResolvedValue({ ...asUser(identityId), roles });
    const response = await GET(makeRequest(), { params: { id: bookingId } });
    expect(response.status).toBe(200);
    return response.json();
  }

  it('never shows the staff note, replay keys or internal pricing to the guest', async () => {
    const w = await world();
    const data = await read(w.guest.id, w.booking.id);
    for (const key of INTERNAL_KEYS) expect(data).not.toHaveProperty(key);
    expect(JSON.stringify(data)).not.toContain('do not upgrade');
    expect(JSON.stringify(data)).not.toContain('OTA-REF-42');
    // What the guest does need is still there.
    expect(data).toMatchObject({ id: w.booking.id, status: 'confirmed', guestNote: 'Late arrival please', viewer: { isGuest: true } });
    expect(data.unit).toMatchObject({ id: w.booking.unitId });
    expect(data.cancellationQuote).toBeTruthy();
  });

  it('shows the unit owner the same restricted view', async () => {
    const w = await world();
    const data = await read(w.owner.id, w.booking.id);
    for (const key of INTERNAL_KEYS) expect(data).not.toHaveProperty(key);
    expect(data.viewer).toMatchObject({ isOwner: true });
  });

  it('gives staff the operational fields, but still not the replay keys or other identities', async () => {
    const w = await world();
    const data = await read(w.staff.id, w.booking.id, [
      { role: 'staff_ops', projectId: w.booking.projectId, unitId: null, organizationId: null, providerId: null },
    ]);
    expect(data).toMatchObject({
      internalNote: 'Guest was rude at the desk - do not upgrade',
      cancellationReason: 'staff: fraud suspected',
      externalRef: 'OTA-REF-42',
      viewer: { isStaff: true },
    });
    for (const key of ['creationKey', 'creationFingerprint', 'cancelledByIdentityId', 'guestIdentityId', 'priceBreakdown']) {
      expect(data).not.toHaveProperty(key);
    }
  });
});
