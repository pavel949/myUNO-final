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

  /**
   * The unit decides the project. Both ids used to be accepted independently,
   * each checked only for existence, so a management contract — the document
   * that decides whether a performance fee is owed — could be filed against a
   * project that does not contain the unit.
   */
  describe('the project comes from the unit', () => {
    async function setup() {
      const admin = await createIdentity({ isAdmin: true });
      const home = await createProject({ slug: 'contract-home', status: 'live' });
      const other = await createProject({ slug: 'contract-other', status: 'live' });
      const owner = await createIdentity();
      const unit = await createUnit({ projectId: home.id, ownerIdentityId: owner.id });
      mockGetCurrentUser.mockResolvedValue(adminUser(admin));
      return { home, other, owner, unit };
    }

    function post(payload: Record<string, unknown>) {
      return POST(
        new NextRequest('http://localhost/api/admin/contracts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      );
    }

    const base = (unitId: string, ownerIdentityId: string) => ({
      unitId,
      ownerIdentityId,
      managementFeeBasis: 'percentage_noi',
      managementFeeRate: 0.12,
      contractStartDate: '2026-02-01',
    });

    it("refuses a projectId that is not the unit's project", async () => {
      const { other, owner, unit } = await setup();

      const res = await post({ ...base(unit.id, owner.id), projectId: other.id });

      expect(res.status).toBe(400);
      expect(await db.managementContract.count()).toBe(0);
    });

    it('needs no projectId, and files the contract under the unit\'s project', async () => {
      const { home, owner, unit } = await setup();

      const res = await post(base(unit.id, owner.id));

      expect(res.status).toBe(200);
      const contract = await db.managementContract.findFirstOrThrow();
      expect(contract.projectId).toBe(home.id);
    });
  });
});
