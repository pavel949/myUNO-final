import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  createIdentity,
  createProject,
  createUnit,
  createUnitEngagement,
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

import { POST as postQuestion } from './route';

describe('POST /api/owner/statements/[statementId]/question', () => {
  let owner: Awaited<ReturnType<typeof createIdentity>>;
  let otherOwner: Awaited<ReturnType<typeof createIdentity>>;
  let statementId: string;

  beforeEach(async () => {
    await resetDb();
    mockGetCurrentUser.mockReset();

    owner = await createIdentity({ firstName: 'Owner' });
    otherOwner = await createIdentity({ firstName: 'Other' });
    const project = await createProject({ status: 'live' });
    const unit = await createUnit({
      projectId: project.id,
      ownerIdentityId: owner.id,
      status: 'live',
    });
    const engagement = await createUnitEngagement({
      unitId: unit.id,
      ownerIdentityId: owner.id,
      engagementType: 'direct_managed',
      status: 'active',
    });

    const statement = await db.ownerStatement.create({
      data: {
        unitId: unit.id,
        ownerIdentityId: owner.id,
        engagementId: engagement.id,
        periodStart: new Date('2026-07-01'),
        periodEnd: new Date('2026-07-31'),
        grossRevenueTh: 5000000,
        totalCostsTh: 800000,
        noiTh: 4200000,
        ownerShareTh: 3400000,
        estateShareTh: 800000,
        status: 'published',
        publishedAt: new Date('2026-08-01'),
      },
    });
    statementId = statement.id;
  });

  it('creates a statement-linked thread for the owner', async () => {
    mockGetCurrentUser.mockResolvedValue({
      identityId: owner.id,
      email: owner.email,
      roles: [{ role: 'owner', projectId: null, unitId: null }],
    });

    const response = await postQuestion(
      new NextRequest(`http://localhost/api/owner/statements/${statementId}/question`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: 'Can you explain the cleaning fee line?' }),
      }),
      { params: { statementId } }
    );

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.threadId).toBeTruthy();

    const thread = await db.thread.findUnique({
      where: { id: data.threadId },
      include: { messages: true, participants: true },
    });
    expect(thread?.contextType).toBe('statement');
    expect(thread?.contextId).toBe(statementId);
    expect(thread?.messages).toHaveLength(1);
    expect(thread?.participants.some((p) => p.identityId === owner.id)).toBe(true);
  });

  it('rejects questions from a non-owner', async () => {
    mockGetCurrentUser.mockResolvedValue({
      identityId: otherOwner.id,
      email: otherOwner.email,
      roles: [{ role: 'owner', projectId: null, unitId: null }],
    });

    const response = await postQuestion(
      new NextRequest(`http://localhost/api/owner/statements/${statementId}/question`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: 'Not my statement' }),
      }),
      { params: { statementId } }
    );

    expect(response.status).toBe(404);
  });
});
