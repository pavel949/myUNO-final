import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  createBooking,
  createIdentity,
  createOrganization,
  createProject,
  createUnit,
  db,
  resetDb,
} from '@/test/util';

const mockGetCurrentUser = vi.fn();
const mockGetTransferInstructions = vi.fn();

vi.mock('@/app/actions/getCurrentUser', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

vi.mock('@/modules/finance', () => ({
  getTransferInstructions: (...args: unknown[]) => mockGetTransferInstructions(...args),
}));

vi.mock('@/lib/prisma', async () => {
  const util = await import('@/test/util');
  return { prisma: util.db };
});

import { GET } from './route';

describe('GET /api/bookings/[id]/transfer-instructions', () => {
  let operator: Awaited<ReturnType<typeof createIdentity>>;
  let owner: Awaited<ReturnType<typeof createIdentity>>;
  let guest: Awaited<ReturnType<typeof createIdentity>>;
  let bookingId: string;
  let projectId: string;
  let unitId: string;

  beforeEach(async () => {
    await resetDb();
    mockGetCurrentUser.mockReset();
    mockGetTransferInstructions.mockReset();

    operator = await createIdentity({ firstName: 'Operator' });
    owner = await createIdentity({ firstName: 'Owner' });
    guest = await createIdentity({ firstName: 'Guest' });

    const project = await createProject({ status: 'live' });
    projectId = project.id;
    const unit = await createUnit({ projectId, ownerIdentityId: owner.id, status: 'live' });
    unitId = unit.id;

    const booking = await createBooking({
      unitId,
      projectId,
      guestIdentityId: guest.id,
      totalThb: 120_000,
      status: 'pending_payment',
    });
    bookingId = booking.id;

    mockGetTransferInstructions.mockImplementation(async (_db, input) => ({
      accountName: 'myUNO Operations',
      accountNumberMasked: 'xxx-1234',
      bankName: 'Kasikorn',
      amountThb: input.amountThb,
      reference: 'BOOK-REF-1',
      expiresAt: new Date(Date.now() + 4 * 3_600_000),
    }));
  });

  it('allows assigned MC member and returns transfer instructions', async () => {
    const organization = await createOrganization('MC Alpha', projectId, 'management_company');
    await db.unitEngagement.create({
      data: {
        unitId,
        ownerIdentityId: owner.id,
        engagementType: 'via_management_company',
        managementOrgId: organization.id,
        status: 'active',
      },
    });

    mockGetCurrentUser.mockResolvedValue({
      identityId: operator.id,
      email: operator.email,
      firstName: 'MC',
      lastName: 'Member',
      isAdmin: false,
      roles: [
        {
          role: 'mc_member',
          projectId,
          unitId: null,
          organizationId: organization.id,
          providerId: null,
        },
      ],
    });

    const response = await GET(
      new NextRequest(`http://localhost/api/bookings/${bookingId}/transfer-instructions`),
      { params: { id: bookingId } }
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.reference).toBe('BOOK-REF-1');
    expect(mockGetTransferInstructions).toHaveBeenCalledTimes(1);
  });

  it('blocks MC member from unrelated organization', async () => {
    const organization = await createOrganization('MC Alpha', projectId, 'management_company');
    const otherOrganization = await createOrganization('MC Beta', projectId, 'management_company');
    await db.unitEngagement.create({
      data: {
        unitId,
        ownerIdentityId: owner.id,
        engagementType: 'via_management_company',
        managementOrgId: organization.id,
        status: 'active',
      },
    });

    mockGetCurrentUser.mockResolvedValue({
      identityId: operator.id,
      email: operator.email,
      firstName: 'MC',
      lastName: 'Other',
      isAdmin: false,
      roles: [
        {
          role: 'mc_member',
          projectId,
          unitId: null,
          organizationId: otherOrganization.id,
          providerId: null,
        },
      ],
    });

    const response = await GET(
      new NextRequest(`http://localhost/api/bookings/${bookingId}/transfer-instructions`),
      { params: { id: bookingId } }
    );
    expect(response.status).toBe(403);
    expect(mockGetTransferInstructions).not.toHaveBeenCalled();
  });

  it('never shows a transfer deadline later than the date hold', async () => {
    const holdExpiresAt = new Date(Date.now() + 2 * 3_600_000);
    await db.booking.update({ where: { id: bookingId }, data: { holdExpiresAt } });
    mockGetCurrentUser.mockResolvedValue({ identityId: guest.id, isAdmin: false, roles: [] });
    const response = await GET(new NextRequest('http://localhost/api/bookings/x/transfer-instructions'), { params: { id: bookingId } });
    expect(response.status).toBe(200);
    expect((await response.json()).expiresAt).toBe(holdExpiresAt.toISOString());
  });

  it.each(['requested', 'declined', 'cancelled', 'expired', 'completed'] as const)(
    'does not offer transfer instructions for %s', async status => {
      await db.booking.update({ where: { id: bookingId }, data: { status, balanceDueThb: 120_000 } });
      mockGetCurrentUser.mockResolvedValue({ identityId: guest.id, isAdmin: false, roles: [] });
      const response = await GET(new NextRequest('http://localhost/api/bookings/x/transfer-instructions'), { params: { id: bookingId } });
      expect(response.status).toBe(409);
      expect(mockGetTransferInstructions).not.toHaveBeenCalled();
    }
  );

  it('does not invite payment after a hold deadline even before the expiry job runs', async () => {
    await db.booking.update({ where: { id: bookingId }, data: { holdExpiresAt: new Date(Date.now() - 1_000) } });
    mockGetCurrentUser.mockResolvedValue({ identityId: guest.id, isAdmin: false, roles: [] });
    const response = await GET(new NextRequest('http://localhost/api/bookings/x/transfer-instructions'), { params: { id: bookingId } });
    expect(response.status).toBe(409);
    expect(mockGetTransferInstructions).not.toHaveBeenCalled();
  });

  it.each(['confirmed', 'checked_in', 'checked_out'] as const)(
    'preserves positive unpaid balance collection in %s', async status => {
      await db.booking.update({ where: { id: bookingId }, data: {
        status, balanceDueThb: 120_000, holdExpiresAt: new Date(Date.now() - 1_000),
      } });
      mockGetCurrentUser.mockResolvedValue({ identityId: guest.id, isAdmin: false, roles: [] });
      const response = await GET(new NextRequest('http://localhost/api/bookings/x/transfer-instructions'), { params: { id: bookingId } });
      expect(response.status).toBe(200);
      expect(new Date((await response.json()).expiresAt).getTime()).toBeGreaterThan(Date.now());
      expect(mockGetTransferInstructions).toHaveBeenCalledTimes(1);
    }
  );

  it('does not show a new payment invitation for a confirmed booking with no recorded balance', async () => {
    await db.booking.update({ where: { id: bookingId }, data: { status: 'confirmed', balanceDueThb: 0 } });
    mockGetCurrentUser.mockResolvedValue({ identityId: guest.id, isAdmin: false, roles: [] });
    const response = await GET(new NextRequest('http://localhost/api/bookings/x/transfer-instructions'), { params: { id: bookingId } });
    expect(response.status).toBe(409);
    expect(mockGetTransferInstructions).not.toHaveBeenCalled();
  });


  it.each([
    ['confirmed unpaid', 120_000, 120_000, 0],
    ['partially settled', 120_000, 70_000, 50_000],
    ['extension already in total', 150_000, 30_000, 120_000],
  ] as const)('invites exactly the canonical remaining amount for %s', async (_label, totalThb, balanceDueThb, paid) => {
    await db.booking.update({ where: { id: bookingId }, data: { status: 'confirmed', totalThb, balanceDueThb } });
    if (paid) await db.payment.create({ data: { purpose: 'stay', bookingId, payerIdentityId: guest.id,
      method: 'cash', provider: 'mock', amountThb: paid, status: 'succeeded', succeededAt: new Date() } });
    mockGetCurrentUser.mockResolvedValue({ identityId: guest.id, isAdmin: false, roles: [] });
    const response = await GET(new NextRequest('http://localhost/api/bookings/x/transfer-instructions'), { params: { id: bookingId } });
    expect(response.status).toBe(200);
    expect((await response.json()).amountThb).toBe(balanceDueThb);
    expect(mockGetTransferInstructions.mock.calls[0][1].amountThb).toBe(balanceDueThb);
  });

  it('requires reconciliation instead of a second initial transfer after any succeeded payment', async () => {
    await db.payment.create({ data: { purpose: 'stay', bookingId, payerIdentityId: guest.id,
      method: 'cash', provider: 'mock', amountThb: 10_000, status: 'succeeded', succeededAt: new Date() } });
    mockGetCurrentUser.mockResolvedValue({ identityId: guest.id, isAdmin: false, roles: [] });
    const response = await GET(new NextRequest('http://localhost/api/bookings/x/transfer-instructions'), { params: { id: bookingId } });
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe('PAYMENT_RECONCILIATION_REQUIRED');
    expect(mockGetTransferInstructions).not.toHaveBeenCalled();
  });

});

