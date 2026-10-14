import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { db, resetDb, createIdentity, createProject, createUnit } from '@/test/util';

const mockGetCurrentUser = vi.hoisted(() => vi.fn());
vi.mock('@/app/actions/getCurrentUser', () => ({ getCurrentUser: () => mockGetCurrentUser() }));
// Redirect the application singleton to the SAME isolated PostgreSQL client
// resetDb owns; the routes and governance/access services remain real.
vi.mock('@/lib/prisma', async () => ({ prisma: (await import('@/test/util')).db }));

import { POST } from './route';
import { PUT as putScope } from './[spaceId]/scope/route';
import { PUT as putMember } from './[spaceId]/members/route';

function request(body: unknown, method = 'POST') {
  return new NextRequest('http://localhost/api/admin/operating-spaces', {
    method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}

async function fixture() {
  const founder = await createIdentity({ isAdmin: true });
  const staff = await createIdentity();
  const project = await createProject();
  const unit = await createUnit({ projectId: project.id });
  const org = await db.organization.create({ data: {
    name: 'API operator', orgType: 'management_company', contactEmail: 'api@example.test', contactPhone: '+66000000000',
  } });
  await db.projectOrganizationRole.create({ data: { projectId: project.id, organizationId: org.id, roleKey: 'operator', provenance: 'verified' } });
  const input = { organizationId: org.id, key: 'api-space', name: 'API space', unitIds: [unit.id] };
  return { founder, staff, project, unit, org, input };
}

async function counts() {
  return { spaces: await db.operatingSpace.count(), attachments: await db.operatingSpaceUnit.count(),
    members: await db.operatingSpaceMember.count(), roles: await db.roleAssignment.count(),
    permissions: await db.projectStaffPermission.count(), audits: await db.auditLog.count() };
}

describe('Governed workspace HTTP boundary uses current server-side identity (AT27/AT28)', () => {
  beforeEach(async () => { mockGetCurrentUser.mockReset(); await resetDb(); });

  it('returns 401 for an unauthenticated request without writing', async () => {
    const f = await fixture();
    mockGetCurrentUser.mockResolvedValue(null);
    expect((await POST(request(f.input))).status).toBe(401);
    expect(await counts()).toEqual({ spaces: 0, attachments: 0, members: 0, roles: 0, permissions: 0, audits: 0 });
  });

  it('ignores a stale privileged session flag and a caller-chosen founder identity', async () => {
    const f = await fixture();
    mockGetCurrentUser.mockResolvedValue({ identityId: f.staff.id, isAdmin: true, roles: [] });
    const response = await POST(request({ ...f.input, actorId: f.founder.id, identityId: f.founder.id, isAdmin: true }));
    expect(response.status).toBe(403);
    expect(await counts()).toEqual({ spaces: 0, attachments: 0, members: 0, roles: 0, permissions: 0, audits: 0 });
  });

  it('rejects a blocked founder despite the signed-in identity and old admin flag', async () => {
    const f = await fixture();
    mockGetCurrentUser.mockResolvedValue({ identityId: f.founder.id, isAdmin: true, roles: [] });
    await db.identity.update({ where: { id: f.founder.id }, data: { status: 'blocked' } });
    expect((await POST(request(f.input))).status).toBe(403);
    expect(await db.operatingSpace.count()).toBe(0);
    expect(await db.auditLog.count()).toBe(0);
  });

  it('returns an explicit space DTO and commits both audit facts without implicit access grants', async () => {
    const f = await fixture();
    mockGetCurrentUser.mockResolvedValue({ identityId: f.founder.id, isAdmin: true, roles: [] });
    const response = await POST(request(f.input));
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(Object.keys(body.space).sort()).toEqual(['id', 'key', 'name', 'updatedAt']);
    expect(body.space).toMatchObject({ key: f.input.key, name: f.input.name });
    expect(await counts()).toEqual({ spaces: 1, attachments: 1, members: 0, roles: 0, permissions: 0, audits: 2 });
    expect((await db.auditLog.findMany()).every(a => a.actorIdentityId === f.founder.id)).toBe(true);
  });

  it('maps duplicate workspace keys to 409 with no duplicate attachment or audit', async () => {
    const f = await fixture();
    mockGetCurrentUser.mockResolvedValue({ identityId: f.founder.id, isAdmin: true, roles: [] });
    expect((await POST(request(f.input))).status).toBe(201);
    const before = await counts();
    expect((await POST(request(f.input))).status).toBe(409);
    expect(await counts()).toEqual(before);
  });

  it('returns 409 for a stale scope edit and leaves the first removal and audit intact', async () => {
    const f = await fixture();
    mockGetCurrentUser.mockResolvedValue({ identityId: f.founder.id, isAdmin: true, roles: [] });
    const { space } = await (await POST(request(f.input))).json();
    const params = { params: { spaceId: space.id } };
    expect((await putScope(request({ unitIds: [], expectedUpdatedAt: space.updatedAt }, 'PUT'), params)).status).toBe(200);
    const before = await db.operatingSpace.findUniqueOrThrow({ where: { id: space.id } });
    expect((await putScope(request({ unitIds: [f.unit.id], expectedUpdatedAt: space.updatedAt }, 'PUT'), params)).status).toBe(409);
    expect(await db.operatingSpace.findUnique({ where: { id: space.id } })).toEqual(before);
    expect(await db.operatingSpaceUnit.count({ where: { operatingSpaceId: space.id, active: true } })).toBe(0);
    expect(await db.auditLog.count({ where: { entityId: space.id, action: 'operating_space:scope' } })).toBe(2);
  });

  it('rejects a member with no legacy authority even if the body supplies role and department fields', async () => {
    const f = await fixture();
    mockGetCurrentUser.mockResolvedValue({ identityId: f.founder.id, isAdmin: true, roles: [] });
    const { space } = await (await POST(request(f.input))).json();
    const before = await counts();
    const response = await putMember(request({
      identityId: f.staff.id, active: true, capabilities: ['manage_tasks'], expectedUpdatedAt: space.updatedAt,
      role: 'staff_ops', projectId: f.project.id, departments: ['housekeeping'],
    }, 'PUT'), { params: { spaceId: space.id } });
    expect(response.status).toBe(409);
    expect(await counts()).toEqual(before);
    expect((await db.operatingSpace.findUniqueOrThrow({ where: { id: space.id } })).updatedAt.toISOString()).toBe(space.updatedAt);
  });
});
