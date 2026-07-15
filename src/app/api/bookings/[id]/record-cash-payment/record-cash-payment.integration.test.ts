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

// The route reads the session via getCurrentUser — mock it per test
const mockGetCurrentUser = vi.fn();
vi.mock('@/app/actions/getCurrentUser', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

// Route module uses the shared client; point it at the test DB client
vi.mock('@/lib/prisma', async () => {
  const util = await import('@/test/util');
  return { prisma: util.db };
});

import { POST } from './route';

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/bookings/x/record-cash-payment', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/bookings/[id]/record-cash-payment', () => {
  let staff: Awaited<ReturnType<typeof createIdentity>>;
  let guest: Awaited<ReturnType<typeof createIdentity>>;
  let bookingId: string;

  beforeEach(async () => {
    await resetDb();
    staff = await createIdentity({ firstName: 'Ops' });
    guest = await createIdentity({ firstName: 'Guest' });
    const project = await createProject({ status: 'live' });
    const unit = await createUnit({ projectId: project.id });
    const booking = await createBooking({
      unitId: unit.id,
      projectId: project.id,
      guestIdentityId: guest.id,
      status: 'pending_payment',
      totalThb: 50000,
    });
    bookingId = booking.id;
  });

  const staffUser = () => ({
    identityId: staff.id,
    email: staff.email,
    firstName: 'Ops',
    lastName: 'User',
    isAdmin: false,
    roles: [{ role: 'staff_ops', projectId: null, unitId: null, organizationId: null }],
  });

  it('records cash, confirms the booking, and writes the ledger entry', async () => {
    mockGetCurrentUser.mockResolvedValue(staffUser());

    const response = await POST(makeRequest({ receiptRef: 'чек-001' }), {
      params: { id: bookingId },
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.confirmed).toBe(true);
    expect(body.payment.method).toBe('cash');
    expect(body.payment.receiptRef).toBe('чек-001');
    expect(body.payment.receivedByIdentityId).toBe(staff.id);
    expect(body.payment.amountThb).toBe(50000);

    const booking = await db.booking.findUnique({ where: { id: bookingId } });
    expect(booking?.status).toBe('confirmed');

    const ledger = await db.ledgerEntry.findFirst({ where: { bookingId } });
    expect(ledger?.entryType).toBe('rental_revenue');
    expect(ledger?.amountThb).toBe(50000);
  });

  it('is refused for a guest (403)', async () => {
    mockGetCurrentUser.mockResolvedValue({
      identityId: guest.id,
      email: guest.email,
      firstName: 'Guest',
      lastName: 'User',
      isAdmin: false,
      roles: [{ role: 'guest', projectId: null, unitId: null, organizationId: null }],
    });

    const response = await POST(makeRequest({ receiptRef: 'r-1' }), {
      params: { id: bookingId },
    });
    expect(response.status).toBe(403);
  });

  it('requires a receipt reference (400)', async () => {
    mockGetCurrentUser.mockResolvedValue(staffUser());
    const response = await POST(makeRequest({}), { params: { id: bookingId } });
    expect(response.status).toBe(400);
  });

  it('refuses a booking that is not awaiting payment (400)', async () => {
    mockGetCurrentUser.mockResolvedValue(staffUser());
    await db.booking.update({ where: { id: bookingId }, data: { status: 'confirmed' } });
    const response = await POST(makeRequest({ receiptRef: 'r-2' }), {
      params: { id: bookingId },
    });
    expect(response.status).toBe(400);
  });

  it('is idempotent-guarded: refuses a second payment (400)', async () => {
    mockGetCurrentUser.mockResolvedValue(staffUser());
    const first = await POST(makeRequest({ receiptRef: 'r-3' }), {
      params: { id: bookingId },
    });
    expect(first.status).toBe(200);

    // Booking is now confirmed → refused as not awaiting payment
    const second = await POST(makeRequest({ receiptRef: 'r-4' }), {
      params: { id: bookingId },
    });
    expect(second.status).toBe(400);
  });
});
