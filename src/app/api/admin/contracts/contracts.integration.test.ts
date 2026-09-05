import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { db, resetDb, createIdentity, createProject, createUnit } from '@/test/util';
import { ManagementFeeBasis } from '@prisma/client';

const mockGetCurrentUser = vi.fn();
vi.mock('@/app/actions/getCurrentUser', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

vi.mock('@/lib/prisma', async () => {
  const util = await import('@/test/util');
  return { prisma: util.db };
});

import { GET, POST } from './route';

function adminUser(identity: { id: string; email: string | null }) {
  return {
    identityId: identity.id,
    email: identity.email,
    firstName: 'Admin',
    lastName: 'User',
    isAdmin: true,
    roles: [],
  };
}

describe('GET /api/admin/contracts', () => {
  beforeEach(async () => {
    await resetDb();
    mockGetCurrentUser.mockReset();
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('lists management contracts', async () => {
    const admin = await createIdentity({ isAdmin: true });
    const project = await createProject({ status: 'live' });
    const owner = await createIdentity();
    const unit = await createUnit({ projectId: project.id, ownerIdentityId: owner.id });
    mockGetCurrentUser.mockResolvedValue(adminUser(admin));

    await db.managementContract.create({
      data: {
        unitId: unit.id,
        projectId: project.id,
        ownerIdentityId: owner.id,
        managementFeeBasis: ManagementFeeBasis.percentage_noi,
        managementFeeRate: 0.15,
        contractStartDate: new Date('2026-01-01'),
      },
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.contracts).toHaveLength(1);
    expect(body.contracts[0].unitName).toBeTruthy();
  });
});

describe('POST /api/admin/contracts', () => {
  beforeEach(async () => {
    await resetDb();
    mockGetCurrentUser.mockReset();
  });

  it('creates a management contract', async () => {
    const admin = await createIdentity({ isAdmin: true });
    const project = await createProject({ status: 'live' });
    const owner = await createIdentity();
    const unit = await createUnit({ projectId: project.id, ownerIdentityId: owner.id });
    mockGetCurrentUser.mockResolvedValue(adminUser(admin));

    const res = await POST(
      new NextRequest('http://localhost/api/admin/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unitId: unit.id,
          projectId: project.id,
          ownerIdentityId: owner.id,
          managementFeeBasis: 'percentage_noi',
          managementFeeRate: 0.12,
          contractStartDate: '2026-02-01',
        }),
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.contract.id).toBeTruthy();
    expect(body.contract.managementFeeBasis).toBe('percentage_noi');
  });
});
