import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Identity, IdentityStatus, Prisma, RoleAssignment, RoleType } from '@prisma/client';

const singletonQuery = vi.hoisted(() => vi.fn());
vi.mock('@/lib/prisma', () => ({ prisma: { roleAssignment: { findMany: singletonQuery } } }));
import { can, PERMISSIONS } from './permissions';

const roles: Array<RoleType | 'admin'> = ['admin', ...new Set(PERMISSIONS.map(permission => permission.role))];
const statuses: IdentityStatus[] = ['active', 'invited', 'blocked', 'merged', 'deletion_requested'];
const cases = statuses.flatMap(status => roles.flatMap(role => ['read', 'allow'].flatMap(access => ['default', 'transaction'].map(client => ({ status, role, access, client })))));
beforeEach(() => { singletonQuery.mockReset(); });

function identity(status: IdentityStatus, isAdmin = false) {
  return { id: 'permission-fixture', status, isAdmin } as Identity;
}
function assignment(role: RoleType, status: 'active' | 'revoked' = 'active') {
  return { identityId: 'permission-fixture', role, status, scopeType: 'project', projectId: 'project-fixture', unitId: null } as RoleAssignment;
}

describe('PR242 active-identity guard reconciled with optional transaction client', () => {
  it.each(cases)('$status $role $access via $client', async ({ status, role, access, client }) => {
    const permission = role === 'admin' ? { action: 'admin:view_audit_log' } : PERMISSIONS.find(item => item.role === role && item.access === 'allow')!;
    const rows = role === 'admin' ? [] : [assignment(role)];
    singletonQuery.mockResolvedValue(rows);
    const query = vi.fn().mockResolvedValue(rows);
    const tx = { roleAssignment: { findMany: query } } as unknown as Prisma.TransactionClient;
    const context = { identity: identity(status, role === 'admin'), action: permission.action, requiredAccess: access as 'read' | 'allow', resource: { projectId: 'project-fixture' } };
    expect(await (client === 'transaction' ? can(context, tx) : can(context))).toBe(status === 'active');
    if (status !== 'active' || role === 'admin') {
      expect(singletonQuery).not.toHaveBeenCalled();
      expect(query).not.toHaveBeenCalled();
    } else {
      expect(client === 'transaction' ? query : singletonQuery).toHaveBeenCalledWith({ where: { identityId: 'permission-fixture', status: 'active' } });
      expect(client === 'transaction' ? singletonQuery : query).not.toHaveBeenCalled();
    }
  });

  it.each(['default', 'transaction'])('preserves read-only and foreign-scope denial with %s client', async client => {
    const query = vi.fn().mockResolvedValue([assignment('owner')]);
    singletonQuery.mockResolvedValue([assignment('owner')]);
    const tx = { roleAssignment: { findMany: query } } as unknown as Prisma.TransactionClient;
    const check = (resource: { projectId: string }, requiredAccess: 'read' | 'allow') => {
      const context = { identity: identity('active'), action: 'units:edit_listing', resource, requiredAccess };
      return client === 'transaction' ? can(context, tx) : can(context);
    };
    expect(await check({ projectId: 'project-fixture' }, 'read')).toBe(true);
    expect(await check({ projectId: 'project-fixture' }, 'allow')).toBe(false);
    expect(await check({ projectId: 'foreign-project' }, 'read')).toBe(false);
  });
});
