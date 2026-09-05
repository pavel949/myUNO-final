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
vi.mock('@/app/actions/getCurrentUser', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

vi.mock('@/lib/prisma', async () => {
  const util = await import('@/test/util');
  return { prisma: util.db };
});

import { POST as checkIn } from './checkin/route';
import { POST as checkOut } from './check-out/route';

function postRequest(): NextRequest {
  return new NextRequest('http://localhost/api/bookings/x/action', { method: 'POST' });
}

describe('booking ops route authorization for management company scope', () => {
  let operator: Awaited<ReturnType<typeof createIdentity>>;
  let owner: Awaited<ReturnType<typeof createIdentity>>;
  let guest: Awaited<ReturnType<typeof createIdentity>>;
  let projectId: string;
  let unitId: string;
  let checkInBookingId: string;
  let checkOutBookingId: string;
  let managementOrgId: string;
  let otherOrgId: string;

  beforeEach(async () => {
    await resetDb();
    mockGetCurrentUser.mockReset();

    operator = await createIdentity({ firstName: 'MC' });
    owner = await createIdentity({ firstName: 'Owner' });
    guest = await createIdentity({ firstName: 'Guest' });
    const project = await createProject({ status: 'live' });
    projectId = project.id;
    const unit = await createUnit({ projectId, ownerIdentityId: owner.id, status: 'live' });
    unitId = unit.id;

    const managementOrg = await createOrganization('MC Alpha', projectId, 'management_company');
    const otherOrg = await createOrganization('MC Beta', projectId, 'management_company');
    managementOrgId = managementOrg.id;
    otherOrgId = otherOrg.id;

    await db.unitEngagement.create({
      data: {
        unitId,
        ownerIdentityId: owner.id,
        engagementType: 'via_management_company',
        managementOrgId,
        status: 'active',
      },
    });

    const checkInBooking = await createBooking({
      unitId,
      projectId,
      guestIdentityId: guest.id,
      status: 'confirmed',
      verificationStatus: 'not_required',
    });
    checkInBookingId = checkInBooking.id;

    const checkOutBooking = await createBooking({
      unitId,
      projectId,
      guestIdentityId: guest.id,
      status: 'checked_in',
      verificationStatus: 'not_required',
      startDate: new Date('2026-08-10T10:00:00Z'),
      endDate: new Date('2026-08-12T10:00:00Z'),
    });
    checkOutBookingId = checkOutBooking.id;
  });

  function asMcMember(organizationId: string) {
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
          organizationId,
          providerId: null,
        },
      ],
    });
  }

  it('allows check-in for assigned MC member', async () => {
    asMcMember(managementOrgId);
    const response = await checkIn(postRequest(), { params: { id: checkInBookingId } });
    expect(response.status).toBe(200);
  });

  it('blocks check-in for MC member outside managing organization', async () => {
    asMcMember(otherOrgId);
    const response = await checkIn(postRequest(), { params: { id: checkInBookingId } });
    expect(response.status).toBe(403);
  });

  it('allows check-out for assigned MC member', async () => {
    asMcMember(managementOrgId);
    const response = await checkOut(postRequest(), { params: { id: checkOutBookingId } });
    expect(response.status).toBe(200);
  });

  it('blocks check-out for MC member outside managing organization', async () => {
    asMcMember(otherOrgId);
    const response = await checkOut(postRequest(), { params: { id: checkOutBookingId } });
    expect(response.status).toBe(403);
  });
});
