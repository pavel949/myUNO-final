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

    mockGetTransferInstructions.mockResolvedValue({
      accountName: 'myUNO Operations',
      accountNumberMasked: 'xxx-1234',
      bankName: 'Kasikorn',
      amountThb: 120_000,
      reference: 'BOOK-REF-1',
      expiresAt: new Date('2026-09-05T10:00:00Z'),
    });
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
});
