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
