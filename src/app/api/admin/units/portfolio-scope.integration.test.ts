import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { db, resetDb, createIdentity, createProject, createUnit } from '@/test/util';

const session = { identityId: '' };
vi.mock('@/lib/prisma', async () => ({ prisma: (await import('@/test/util')).db }));
vi.mock('@/app/actions/getCurrentUser', () => ({
  getCurrentUser: async () => session.identityId ? { identityId: session.identityId } : null,
}));

import { GET, POST } from './route';

const createRequest = (body: object) => new NextRequest('http://localhost/api/admin/units', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});
const listRequest = (projectId: string) => new NextRequest(`http://localhost/api/admin/units?projectId=${projectId}`);
const draft = (projectId: string, name = 'F705') => ({
  projectId, name, unitType: 'condo', bedrooms: 1, bathrooms: 1, maxGuests: 2,
  addressSupplement: 'Building F', baseNightlyThb: 300000, status: 'live',
});

describe('scoped canonical inventory API', () => {
  let projectId: string, otherProjectId: string, staffId: string, mcId: string;
  beforeEach(async () => {
    await resetDb();
    projectId = (await createProject()).id;
    otherProjectId = (await createProject()).id;
    staffId = (await createIdentity()).id;
    mcId = (await createIdentity()).id;
    await db.roleAssignment.create({ data: {
      identityId: staffId, role: 'staff_ops', scopeType: 'project', projectId, status: 'active',
    } });
    session.identityId = staffId;
  });

  it('allows only assigned project and always creates draft', async () => {
    expect((await POST(createRequest(draft(otherProjectId)))).status).toBe(403);
    const response = await POST(createRequest(draft(projectId)));
    expect(response.status).toBe(201);
    const unit = await response.json();
    expect(unit.status).toBe('draft');
    expect(unit.projectId).toBe(projectId);
    expect(await db.unit.count({ where: { projectId } })).toBe(1);
  });

  it('does not treat a unit-scoped staff grant as permission to add inventory', async () => {
    const existing = await createUnit({ projectId });
    await db.roleAssignment.updateMany({ where: { identityId: staffId }, data: { status: 'revoked' } });
    await db.roleAssignment.create({ data: {
      identityId: staffId, role: 'staff_ops', scopeType: 'unit',
      projectId, unitId: existing.id, status: 'active',
    } });
    expect((await POST(createRequest(draft(projectId, 'new home')))).status).toBe(403);
  });

  it('requires engagement, not just a project role, for external MC list', async () => {
    const org = await db.organization.create({ data: {
      name: 'Managed condo portfolio', orgType: 'management_company',
      contactEmail: 'mc@example.com', contactPhone: '123', projectId,
    } });
    const owner = await createIdentity();
    const mine = await createUnit({ projectId, ownerIdentityId: owner.id });
    const other = await createUnit({ projectId });
    await db.roleAssignment.create({ data: {
      identityId: mcId, role: 'mc_member', scopeType: 'project',
      projectId, organizationId: org.id, status: 'active',
    } });
    await db.unitEngagement.create({ data: {
      unitId: mine.id, ownerIdentityId: owner.id, engagementType: 'via_management_company',
      managementOrgId: org.id, status: 'active',
    } });
    session.identityId = mcId;
    expect((await POST(createRequest(draft(projectId, 'unmandated')))).status).toBe(403);
    const response = await GET(listRequest(projectId));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.items.map((unit: { id: string }) => unit.id)).toEqual([mine.id]);
    expect(data.items.map((unit: { id: string }) => unit.id)).not.toContain(other.id);
  });
});
