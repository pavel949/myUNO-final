import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { db, resetDb, createIdentity, createProject } from '@/test/util';
const session = { identityId: '' };
vi.mock('@/lib/prisma', async () => ({ prisma: (await import('@/test/util')).db }));
vi.mock('@/app/actions/getCurrentUser', () => ({ getCurrentUser: async () => session.identityId ? { identityId: session.identityId } : null }));
import { GET, POST, DELETE } from './route';
const req = (method: string, body: object) => new NextRequest('http://localhost/api/ops/team', {
  method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});
describe('legacy project team: admin-only mutations', () => {
  let projectId: string, otherProjectId: string, managerId: string, targetId: string;
  beforeEach(async () => {
    await resetDb(); projectId = (await createProject()).id; otherProjectId = (await createProject()).id;
    managerId = (await createIdentity()).id; targetId = (await createIdentity()).id; session.identityId = managerId;
    await db.roleAssignment.create({ data: { identityId: managerId, role: 'staff_ops', scopeType: 'project', projectId, status: 'active' } });
  });
  const email = () => db.identity.findUniqueOrThrow({ where: { id: targetId } }).then(target => target.email);
  it('retains scoped read-only rosters but rejects foreign scope and project role delegation', async () => {
    expect((await GET(new NextRequest('http://localhost/api/ops/team?projectId=' + projectId))).status).toBe(200);
    expect((await GET(new NextRequest('http://localhost/api/ops/team?projectId=' + otherProjectId))).status).toBe(403);
    expect((await POST(req('POST', { projectId, email: await email() }))).status).toBe(403);
    expect(await db.roleAssignment.count({ where: { identityId: targetId } })).toBe(0);
  });
  it('admin creates an explicit restrictive department policy and atomic grant/revoke audit', async () => {
    await db.identity.update({ where: { id: managerId }, data: { isAdmin: true } });
    const created = await POST(req('POST', { projectId, email: await email(), role: 'staff_ops', scopeType: 'platform' }));
    expect(created.status).toBe(201);
    const { id } = await created.json();
    expect(await db.roleAssignment.findUnique({ where: { id } })).toMatchObject({ role: 'onsite_host', scopeType: 'project', projectId });
    expect(await db.projectStaffPermission.findUnique({ where: { projectId_identityId: { projectId, identityId: targetId } } })).toMatchObject({ departments: [] });
    expect(await db.auditLog.count({ where: { entityId: id, action: 'roles:grant' } })).toBe(1);
    expect((await DELETE(req('DELETE', { projectId, assignmentId: id }))).status).toBe(200);
    expect(await db.auditLog.count({ where: { entityId: id, action: 'roles:revoke' } })).toBe(1);
  });
  it('admin regrant preserves an existing explicit department restriction', async () => {
    await db.identity.update({ where: { id: managerId }, data: { isAdmin: true } });
    await db.projectStaffPermission.create({ data: { projectId, identityId: targetId, departments: ['housekeeping'] } });
    await POST(req('POST', { projectId, email: await email() }));
    expect(await db.projectStaffPermission.findUnique({ where: { projectId_identityId: { projectId, identityId: targetId } } })).toMatchObject({ departments: ['housekeeping'] });
  });
  it('cannot steal provenance through POST followed by DELETE', async () => {
    const original = await createIdentity({ isAdmin: true });
    const assignment = await db.roleAssignment.create({ data: { identityId: targetId, role: 'onsite_host', scopeType: 'project', projectId, status: 'active', grantedByIdentityId: original.id } });
    expect((await POST(req('POST', { projectId, email: await email() }))).status).toBe(403);
    expect((await DELETE(req('DELETE', { projectId, assignmentId: assignment.id }))).status).toBe(403);
    expect(await db.roleAssignment.findUnique({ where: { id: assignment.id } })).toMatchObject({ status: 'active', grantedByIdentityId: original.id });
  });
  it('does not advertise revoke permission to a non-admin original granter', async () => {
    await db.roleAssignment.create({ data: { identityId: targetId, role: 'onsite_host', scopeType: 'project', projectId, status: 'active', grantedByIdentityId: managerId } });
    const response = await GET(new NextRequest('http://localhost/api/ops/team?projectId=' + projectId));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.assignments).toHaveLength(1);
    expect(body.assignments[0]).toMatchObject({ identityId: targetId, canRevoke: false });
  });

  it('revoked project staff cannot read the roster', async () => {
    await db.roleAssignment.updateMany({ where: { identityId: managerId }, data: { status: 'revoked' } });
    expect((await GET(new NextRequest('http://localhost/api/ops/team?projectId=' + projectId))).status).toBe(403);
  });
});
