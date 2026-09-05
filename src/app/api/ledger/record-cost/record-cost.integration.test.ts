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

import { POST } from './route';

function userSession(identity: { id: string; email: string | null }) {
  return {
    identityId: identity.id,
    email: identity.email,
    firstName: 'Test',
    lastName: 'User',
    isAdmin: false,
    roles: [],
  };
}

describe('POST /api/ledger/record-cost', () => {
  beforeEach(async () => {
    await resetDb();
    mockGetCurrentUser.mockReset();
  });

  it('allows MC members to record a cost on their managed unit', async () => {
    const project = await createProject({ status: 'live' });
    const owner = await createIdentity();
    const unit = await createUnit({ projectId: project.id, ownerIdentityId: owner.id });
    const mcMember = await createIdentity();

    const org = await db.organization.create({
      data: {
        name: 'Test MC',
        orgType: 'management_company',
        projectId: project.id,
        contactEmail: 'mc@test.com',
        contactPhone: '+66000000000',
      },
    });

    await db.unitEngagement.create({
      data: {
        unitId: unit.id,
        engagementType: 'via_management_company',
        ownerIdentityId: owner.id,
        managementOrgId: org.id,
        status: 'active',
      },
    });

    await db.roleAssignment.create({
      data: {
        identityId: mcMember.id,
        role: 'mc_member',
        scopeType: 'project',
        projectId: project.id,
        organizationId: org.id,
        status: 'active',
      },
    });

    mockGetCurrentUser.mockResolvedValue(userSession(mcMember));

    const res = await POST(
      new NextRequest('http://localhost/api/ledger/record-cost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unitId: unit.id,
          entryType: 'cleaning_cost',
          amountThb: 50000,
          occurredOn: '2026-09-01',
          description: 'Deep clean after checkout',
        }),
      })
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.amountThb).toBe(50000);
  });

  it('returns 403 for unrelated identities', async () => {
    const project = await createProject({ status: 'live' });
    const owner = await createIdentity();
    const unit = await createUnit({ projectId: project.id, ownerIdentityId: owner.id });
    const stranger = await createIdentity();

    mockGetCurrentUser.mockResolvedValue(userSession(stranger));

    const res = await POST(
      new NextRequest('http://localhost/api/ledger/record-cost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unitId: unit.id,
          entryType: 'cleaning_cost',
          amountThb: 10000,
          occurredOn: '2026-09-01',
          description: 'Should fail',
        }),
      })
    );

    expect(res.status).toBe(403);
  });
});
