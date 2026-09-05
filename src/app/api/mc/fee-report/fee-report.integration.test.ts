import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  db,
  resetDb,
  createIdentity,
  createProject,
  createUnit,
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

function userSession(identity: { id: string; email: string | null }, roles: unknown[] = []) {
  return {
    identityId: identity.id,
    email: identity.email,
    firstName: 'Test',
    lastName: 'User',
    isAdmin: false,
    roles,
  };
}

describe('GET /api/mc/fee-report', () => {
  beforeEach(async () => {
    await resetDb();
    mockGetCurrentUser.mockReset();
  });

  it('returns fee lines for an MC member in scope', async () => {
    const project = await createProject();
    const mcOrg = await db.organization.create({
      data: {
        name: 'Test MC',
        orgType: 'management_company',
        projectId: project.id,
        contactEmail: 'mc@test.com',
        contactPhone: '555-0001',
      },
    });

    const mcIdentity = await createIdentity();
    await db.roleAssignment.create({
      data: {
        identityId: mcIdentity.id,
        role: 'mc_member',
        scopeType: 'project',
        projectId: project.id,
        organizationId: mcOrg.id,
        status: 'active',
      },
    });

    const owner = await createIdentity();
    const unit = await createUnit({
      projectId: project.id,
      ownerIdentityId: owner.id,
    });
    await db.unitEngagement.create({
      data: {
        unitId: unit.id,
        engagementType: 'via_management_company',
        ownerIdentityId: owner.id,
        managementOrgId: mcOrg.id,
        status: 'active',
        feeOverridePct: 10,
      },
    });

    const guest = await createIdentity();
    await db.booking.create({
      data: {
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guest.id,
        bookingType: 'guest_stay',
        channel: 'direct',
        startDate: new Date('2025-03-10'),
        endDate: new Date('2025-03-15'),
        adults: 2,
        children: 0,
        totalThb: 100000,
        status: 'confirmed',
      },
    });

    mockGetCurrentUser.mockResolvedValue(
      userSession(mcIdentity, [
        {
          role: 'mc_member',
          projectId: project.id,
          organizationId: mcOrg.id,
        },
      ])
    );

    const url = new URL('http://localhost/api/mc/fee-report');
    url.searchParams.set('projectId', project.id);
    url.searchParams.set('organizationId', mcOrg.id);
    url.searchParams.set('periodStart', '2025-03-01T00:00:00.000Z');
    url.searchParams.set('periodEnd', '2025-04-01T00:00:00.000Z');

    const res = await GET(new NextRequest(url));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.feeLines).toHaveLength(1);
    expect(body.summaryThb.grossAmount).toBe(1000);
    expect(body.summaryThb.platformFeeAmount).toBe(100);
  });

  it('rejects callers outside the MC scope', async () => {
    const project = await createProject();
    const mcOrg = await db.organization.create({
      data: {
        name: 'Test MC',
        orgType: 'management_company',
        projectId: project.id,
        contactEmail: 'mc@test.com',
        contactPhone: '555-0002',
      },
    });

    const outsider = await createIdentity();
    mockGetCurrentUser.mockResolvedValue(userSession(outsider, []));

    const url = new URL('http://localhost/api/mc/fee-report');
    url.searchParams.set('projectId', project.id);
    url.searchParams.set('organizationId', mcOrg.id);
    url.searchParams.set('periodStart', '2025-03-01T00:00:00.000Z');
    url.searchParams.set('periodEnd', '2025-04-01T00:00:00.000Z');

    const res = await GET(new NextRequest(url));
    expect(res.status).toBe(403);
  });
});
