import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  createIdentity,
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

import { GET } from './route';

describe('GET /api/tickets/[id] scoped access', () => {
  let reporter: Awaited<ReturnType<typeof createIdentity>>;
  let assignee: Awaited<ReturnType<typeof createIdentity>>;
  let owner: Awaited<ReturnType<typeof createIdentity>>;
  let staff: Awaited<ReturnType<typeof createIdentity>>;
  let outsider: Awaited<ReturnType<typeof createIdentity>>;
  let projectId: string;
  let ticketId: string;

  beforeEach(async () => {
    await resetDb();
    mockGetCurrentUser.mockReset();

    reporter = await createIdentity({ firstName: 'Reporter' });
    assignee = await createIdentity({ firstName: 'Assignee' });
    owner = await createIdentity({ firstName: 'Owner' });
    staff = await createIdentity({ firstName: 'Staff' });
    outsider = await createIdentity({ firstName: 'Outsider' });

    const project = await createProject({ status: 'live' });
    projectId = project.id;
    const unit = await createUnit({ projectId, ownerIdentityId: owner.id, status: 'live' });

    await db.roleAssignment.create({
      data: {
        identityId: staff.id,
        role: 'staff_ops',
        scopeType: 'project',
        projectId,
        unitId: null,
        organizationId: null,
        providerId: null,
        status: 'active',
      },
    });

    const ticket = await db.ticket.create({
      data: {
        projectId,
        unitId: unit.id,
        raisedByIdentityId: reporter.id,
        raisedByRole: 'guest',
        categoryKey: 'maintenance',
        title: 'Broken door lock',
        status: 'open',
        assigneeIdentityId: assignee.id,
      },
    });
    ticketId = ticket.id;
  });

  async function requestAs(input: {
    identityId: string;
    isAdmin?: boolean;
    role?: string;
    roleProjectId?: string;
  }) {
    mockGetCurrentUser.mockResolvedValue({
      identityId: input.identityId,
      email: 'user@example.com',
      firstName: 'User',
      lastName: 'Test',
      isAdmin: Boolean(input.isAdmin),
      roles: input.role
        ? [
            {
              role: input.role,
              projectId: input.roleProjectId ?? null,
              unitId: null,
              organizationId: null,
              providerId: null,
            },
          ]
        : [],
    });

    return GET(new NextRequest(`http://localhost/api/tickets/${ticketId}`), {
      params: { id: ticketId },
    });
  }

  it('allows reporter to view own ticket', async () => {
    const response = await requestAs({ identityId: reporter.id });
    expect(response.status).toBe(200);
  });

  it('allows assigned operator to view ticket', async () => {
    const response = await requestAs({ identityId: assignee.id });
    expect(response.status).toBe(200);
  });

  it('allows project staff to view ticket', async () => {
    const response = await requestAs({
      identityId: staff.id,
      role: 'staff_ops',
      roleProjectId: projectId,
    });
    expect(response.status).toBe(200);
  });

  it('allows unit owner to view ticket', async () => {
    const response = await requestAs({
      identityId: owner.id,
      role: 'owner',
      roleProjectId: projectId,
    });
    expect(response.status).toBe(200);
  });

  it('blocks unrelated identity', async () => {
    const response = await requestAs({ identityId: outsider.id });
    expect(response.status).toBe(404);
  });
});
