import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
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
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': randomUUID() },
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
    // The response echoes the magnitude the caller sent; the ledger stores the outflow negative.
    expect(body.amountThb).toBe(50000);
    expect(
      (await db.ledgerEntry.findUniqueOrThrow({ where: { id: body.id } })).amountThb
    ).toBe(-50000);
  });

  it('rejects a request without an Idempotency-Key and writes nothing', async () => {
    const project = await createProject({ status: 'live' });
    const owner = await createIdentity();
    const unit = await createUnit({ projectId: project.id, ownerIdentityId: owner.id });
    const staff = await createIdentity();
    await db.roleAssignment.create({
      data: { identityId: staff.id, role: 'staff_ops', scopeType: 'project', projectId: project.id, status: 'active' },
    });
    mockGetCurrentUser.mockResolvedValue(userSession(staff));

    const res = await POST(
      new NextRequest('http://localhost/api/ledger/record-cost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unitId: unit.id,
          entryType: 'cleaning_cost',
          amountThb: 10000,
          occurredOn: '2026-09-01',
          description: 'No key',
        }),
      })
    );

    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('missing_idempotency_key');
    expect(await db.ledgerEntry.count({ where: { entryType: 'cleaning_cost' } })).toBe(0);
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
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': randomUUID() },
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
