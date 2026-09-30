import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { db, resetDb, createIdentity, createProject } from '@/test/util';

const session = { identityId: '' };
vi.mock('@/lib/prisma', async () => ({ prisma: (await import('@/test/util')).db }));
vi.mock('@/app/actions/getCurrentUser', () => ({
  getCurrentUser: async () => session.identityId ? { identityId: session.identityId } : null,
}));
import { GET, POST, DELETE } from './route';

const req = (method: string, body: object) => new NextRequest('http://localhost/api/ops/team', {
  method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

describe('delegated project team: no privilege escalation', () => {
  let projectId: string, otherProjectId: string, managerId: string, targetId: string;
  beforeEach(async () => {
    await resetDb();
    projectId = (await createProject()).id;
    otherProjectId = (await createProject()).id;
    managerId = (await createIdentity()).id;
    targetId = (await createIdentity()).id;
    session.identityId = managerId;
    await db.roleAssignment.create({ data: {
      identityId: managerId, role: 'staff_ops', scopeType: 'project',
      projectId, status: 'active',
    } });
  });

  it('denies a project manager access to another project even when posting an arbitrary ID', async () => {
    expect((await POST(req('POST', { projectId: otherProjectId, email: (await db.identity.findUniqueOrThrow({ where: { id: targetId } })).email }))).status).toBe(403);
    expect((await GET(new NextRequest('http://localhost/api/ops/team?projectId=' + otherProjectId))).status).toBe(403);
    expect(await db.roleAssignment.count({ where: { identityId: targetId } })).toBe(0);
  });

  it('only grants onsite_host in its own project and can revoke its own assignment', async () => {
    const email = (await db.identity.findUniqueOrThrow({ where: { id: targetId } })).email;
    const created = await POST(req('POST', { projectId, email, role: 'staff_ops', scopeType: 'platform', organizationId: 'spoof' }));
    expect(created.status).toBe(201);
    const { id } = await created.json();
    const grant = await db.roleAssignment.findUniqueOrThrow({ where: { id } });
    expect([grant.role, grant.scopeType, grant.projectId, grant.grantedByIdentityId]).toEqual(['onsite_host', 'project', projectId, managerId]);
    expect(grant.organizationId).toBeNull();
    expect((await DELETE(req('DELETE', { projectId, assignmentId: id }))).status).toBe(200);
    expect((await db.roleAssignment.findUniqueOrThrow({ where: { id } })).status).toBe('revoked');
  });

  it('does not revoke a role created by another manager or a platform role', async () => {
    const another = await createIdentity();
    const assignment = await db.roleAssignment.create({ data: {
      identityId: targetId, role: 'onsite_host', scopeType: 'project', projectId,
      status: 'active', grantedByIdentityId: another.id,
    } });
    expect((await DELETE(req('DELETE', { projectId, assignmentId: assignment.id }))).status).toBe(403);
    expect((await db.roleAssignment.findUniqueOrThrow({ where: { id: assignment.id } })).status).toBe('active');
    const platformRole = await db.roleAssignment.create({ data: {
      identityId: targetId, role: 'onsite_host', scopeType: 'platform', status: 'active', grantedByIdentityId: managerId,
    } });
    expect((await DELETE(req('DELETE', { projectId, assignmentId: platformRole.id }))).status).toBe(404);
  });

  it('revoked manager access is checked in DB on every request', async () => {
    await db.roleAssignment.updateMany({ where: { identityId: managerId }, data: { status: 'revoked' } });
    expect((await GET(new NextRequest('http://localhost/api/ops/team?projectId=' + projectId))).status).toBe(403);
  });
});
