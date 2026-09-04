import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
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

import { GET as getTicket } from './route';
import { POST as updateStatus } from './status/route';
import { POST as assign } from './assign/route';

function asMcMember(input: {
  identity: { id: string; email: string | null };
  projectId: string;
  organizationId: string;
}) {
  mockGetCurrentUser.mockResolvedValue({
    identityId: input.identity.id,
    email: input.identity.email,
    firstName: 'MC',
    lastName: 'Member',
    isAdmin: false,
    roles: [
      {
        role: 'mc_member',
        projectId: input.projectId,
        unitId: null,
        organizationId: input.organizationId,
        providerId: null,
      },
    ],
  });
}

describe('ticket API scope — management company', () => {
  let operator: Awaited<ReturnType<typeof createIdentity>>;
  let strangerMc: Awaited<ReturnType<typeof createIdentity>>;
  let guest: Awaited<ReturnType<typeof createIdentity>>;
  let owner: Awaited<ReturnType<typeof createIdentity>>;
  let projectId: string;
  let managedOrgId: string;
  let otherOrgId: string;
  let ticketId: string;

  beforeEach(async () => {
    await resetDb();
    mockGetCurrentUser.mockReset();

    operator = await createIdentity({ firstName: 'Operator' });
    strangerMc = await createIdentity({ firstName: 'Other MC' });
    guest = await createIdentity({ firstName: 'Guest' });
    owner = await createIdentity({ firstName: 'Owner' });

    const project = await createProject({ status: 'live' });
    projectId = project.id;
    const managedOrg = await createOrganization('MC Alpha', projectId, 'management_company');
    const otherOrg = await createOrganization('MC Beta', projectId, 'management_company');
    managedOrgId = managedOrg.id;
    otherOrgId = otherOrg.id;

    const unit = await createUnit({ projectId, ownerIdentityId: owner.id, status: 'live' });
    await db.unitEngagement.create({
      data: {
        unitId: unit.id,
        ownerIdentityId: owner.id,
        engagementType: 'via_management_company',
        managementOrgId: managedOrgId,
        status: 'active',
      },
    });

    const ticket = await db.ticket.create({
      data: {
        projectId,
        unitId: unit.id,
        raisedByIdentityId: guest.id,
        raisedByRole: 'guest',
        categoryKey: 'maintenance',
        title: 'Leaking tap',
        priority: 'normal',
        status: 'open',
      },
    });
    ticketId = ticket.id;
  });

  it('allows managed MC to read and transition ticket status', async () => {
    asMcMember({ identity: operator, projectId, organizationId: managedOrgId });

    const detailResponse = await getTicket(
      new NextRequest(`http://localhost/api/tickets/${ticketId}`),
      { params: { id: ticketId } }
    );
    expect(detailResponse.status).toBe(200);

    const statusResponse = await updateStatus(
      new NextRequest(`http://localhost/api/tickets/${ticketId}/status`, {
        method: 'POST',
        body: JSON.stringify({ newStatus: 'acknowledged' }),
        headers: { 'Content-Type': 'application/json' },
      }),
      { params: { id: ticketId } }
    );
    expect(statusResponse.status).toBe(200);

    const ticket = await db.ticket.findUnique({ where: { id: ticketId } });
    expect(ticket?.status).toBe('acknowledged');
  });

  it('allows managed MC to assign ticket to self', async () => {
    asMcMember({ identity: operator, projectId, organizationId: managedOrgId });

    const response = await assign(
      new NextRequest(`http://localhost/api/tickets/${ticketId}/assign`, {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      }),
      { params: { id: ticketId } }
    );
    expect(response.status).toBe(200);

    const ticket = await db.ticket.findUnique({ where: { id: ticketId } });
    expect(ticket?.assigneeIdentityId).toBe(operator.id);
  });

  it('blocks MC from other organization', async () => {
    asMcMember({ identity: strangerMc, projectId, organizationId: otherOrgId });

    const statusResponse = await updateStatus(
      new NextRequest(`http://localhost/api/tickets/${ticketId}/status`, {
        method: 'POST',
        body: JSON.stringify({ newStatus: 'acknowledged' }),
        headers: { 'Content-Type': 'application/json' },
      }),
      { params: { id: ticketId } }
    );
    expect(statusResponse.status).toBe(404);
  });

  it('rejects assigning ticket to non-operator identity', async () => {
    asMcMember({ identity: operator, projectId, organizationId: managedOrgId });

    const response = await assign(
      new NextRequest(`http://localhost/api/tickets/${ticketId}/assign`, {
        method: 'POST',
        body: JSON.stringify({ assigneeIdentityId: guest.id }),
        headers: { 'Content-Type': 'application/json' },
      }),
      { params: { id: ticketId } }
    );
    expect(response.status).toBe(400);
  });

  it('allows reporter to read ticket but not transition status', async () => {
    mockGetCurrentUser.mockResolvedValue({
      identityId: guest.id,
      email: guest.email,
      firstName: 'Guest',
      lastName: 'Reporter',
      isAdmin: false,
      roles: [],
    });

    const detailResponse = await getTicket(
      new NextRequest(`http://localhost/api/tickets/${ticketId}`),
      { params: { id: ticketId } }
    );
    expect(detailResponse.status).toBe(200);

    const statusResponse = await updateStatus(
      new NextRequest(`http://localhost/api/tickets/${ticketId}/status`, {
        method: 'POST',
        body: JSON.stringify({ newStatus: 'acknowledged' }),
        headers: { 'Content-Type': 'application/json' },
      }),
      { params: { id: ticketId } }
    );
    expect(statusResponse.status).toBe(403);
  });

  it('allows unit owner to read ticket but not transition status', async () => {
    mockGetCurrentUser.mockResolvedValue({
      identityId: owner.id,
      email: owner.email,
      firstName: 'Owner',
      lastName: 'Unit',
      isAdmin: false,
      roles: [
        {
          role: 'owner',
          projectId,
          unitId: null,
          organizationId: null,
          providerId: null,
        },
      ],
    });

    const detailResponse = await getTicket(
      new NextRequest(`http://localhost/api/tickets/${ticketId}`),
      { params: { id: ticketId } }
    );
    expect(detailResponse.status).toBe(200);

    const statusResponse = await updateStatus(
      new NextRequest(`http://localhost/api/tickets/${ticketId}/status`, {
        method: 'POST',
        body: JSON.stringify({ newStatus: 'acknowledged' }),
        headers: { 'Content-Type': 'application/json' },
      }),
      { params: { id: ticketId } }
    );
    expect(statusResponse.status).toBe(403);
  });
});
