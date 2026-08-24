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

import { GET } from './route';

function makeRequest(): NextRequest {
  return new NextRequest('http://localhost/api/checkout/x');
}

const asUser = (identityId: string) => ({
  identityId,
  email: 'x@test.com',
  firstName: 'X',
  lastName: 'Y',
  isAdmin: false,
  roles: [],
});

describe('GET /api/checkout/[sessionId] — satang-to-baht display boundary (Q47)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('converts the display amountThb to baht without touching the underlying charge', async () => {
    const guest = await createIdentity({ firstName: 'Guest' });
    const owner = await createIdentity({ firstName: 'Owner' });
    const project = await createProject({ status: 'live' });
    const unit = await createUnit({ projectId: project.id, ownerIdentityId: owner.id });
    const booking = await createBooking({
      unitId: unit.id,
      projectId: project.id,
      guestIdentityId: guest.id,
      status: 'pending_payment',
      totalThb: 500000,
    });

    const payment = await db.payment.create({
      data: {
        purpose: 'stay',
        bookingId: booking.id,
        payerIdentityId: guest.id,
        method: 'card_provider',
        provider: 'mock',
        amountThb: 500000,
        status: 'created',
      },
    });

    mockGetCurrentUser.mockResolvedValue(asUser(guest.id));
    const response = await GET(makeRequest(), { params: { sessionId: payment.id } });
    expect(response.status).toBe(200);
    const data = await response.json();

    // 500000 satang stored — the guest must see ฿5,000, not ฿500,000.
    expect(data.amountThb).toBe(5000);

    // The stored Payment row itself (what actually gets charged/confirmed)
    // is untouched by the display conversion.
    const stored = await db.payment.findUnique({ where: { id: payment.id } });
    expect(stored?.amountThb).toBe(500000);
  });
});
