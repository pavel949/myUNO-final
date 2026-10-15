import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Identity, PrismaClient } from '@prisma/client';
import { validateRoleAssignmentScope } from './role-assignment-policy';
import { grantRole } from './people.service';
import { can, PERMISSIONS } from './permissions';

vi.mock('@/lib/prisma', () => ({ prisma: {} }));

const assignment = {
  identityId: 'contributor', role: 'content_contributor' as const,
  scopeType: 'unit' as const, projectId: 'complex-a', unitId: 'unit-a',
  grantedByIdentityId: 'founder',
};
function database() {
  return {
    identity: { findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
      where.id === 'founder' ? { id: 'founder', isAdmin: true, status: 'active' } : { id: where.id, isAdmin: false, status: 'active' }) },
    project: { findUnique: vi.fn().mockResolvedValue({ id: 'complex-a' }) },
    unit: { findUnique: vi.fn().mockResolvedValue({ id: 'unit-a', projectId: 'complex-a' }) },
    roleAssignment: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([{ ...assignment, status: 'active' }]),
      create: vi.fn(async ({ data }) => ({ id: 'grant-a', ...data })),
      update: vi.fn(async ({ data }) => ({ id: 'grant-a', ...data })),
    },
  };
}

describe('content contributor role assignment', () => {
  let mock: ReturnType<typeof database>;
  let db: PrismaClient;
  beforeEach(() => { mock = database(); db = mock as unknown as PrismaClient; });

  it.each([
    { scopeType: 'platform', projectId: undefined, unitId: undefined },
    { scopeType: 'project', unitId: 'unit-a' },
    { scopeType: 'unit', unitId: undefined },
    { projectId: undefined },
    { organizationId: 'management-company' },
    { providerId: 'provider' },
    { role: 'admin' },
    { scopeType: 'organization' },
    { projectId: 123 },
    { projectId: '  complex-a' },
    { unitId: '' },
  ])('rejects illegal scope before writes: %j', async changes => {
    await expect(grantRole(db, { ...assignment, ...changes } as any)).rejects.toThrow();
    expect(mock.roleAssignment.create).not.toHaveBeenCalled();
    expect(mock.roleAssignment.update).not.toHaveBeenCalled();
    expect(mock.identity.findUnique).not.toHaveBeenCalled();
  });

  it('grants only the selected existing unit in its actual project', async () => {
    await grantRole(db, assignment);
    expect(mock.unit.findUnique).toHaveBeenCalledWith({ where: { id: 'unit-a' }, select: { id: true, projectId: true } });
    expect(mock.roleAssignment.create).toHaveBeenCalledWith(expect.objectContaining({ data: {
      ...assignment, organizationId: null, providerId: null, status: 'active',
    } }));
  });

  it('grants shared-complex content separately with no unit', async () => {
    await grantRole(db, { ...assignment, scopeType: 'project', unitId: undefined });
    expect(mock.unit.findUnique).not.toHaveBeenCalled();
    expect(mock.roleAssignment.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      role: 'content_contributor', scopeType: 'project', projectId: 'complex-a', unitId: null,
    }) }));
  });

  it.each([null, { id: 'unit-a', projectId: 'complex-b' }])('rejects missing or cross-project units: %j', async unit => {
    mock.unit.findUnique.mockResolvedValue(unit);
    await expect(grantRole(db, assignment)).rejects.toThrow(/not found|does not belong/);
    expect(mock.roleAssignment.create).not.toHaveBeenCalled();
  });

  it('rejects a missing project', async () => {
    mock.project.findUnique.mockResolvedValue(null);
    await expect(grantRole(db, assignment)).rejects.toThrow(/Project .* not found/);
    expect(mock.roleAssignment.create).not.toHaveBeenCalled();
  });

  it.each(['invited', 'blocked', 'merged', 'deletion_requested'])('rejects a %s admin as granter', async status => {
    mock.identity.findUnique.mockResolvedValue({ id: 'founder', isAdmin: true, status });
    await expect(grantRole(db, assignment)).rejects.toThrow(/Only active admins/);
    expect(mock.roleAssignment.create).not.toHaveBeenCalled();
  });

  it('rejects self-grants and non-admin operational staff', async () => {
    await expect(grantRole(db, { ...assignment, grantedByIdentityId: 'contributor' })).rejects.toThrow(/Only active admins/);
    expect(mock.roleAssignment.create).not.toHaveBeenCalled();
  });

  it('reactivates only an exact matching assignment and records the granter', async () => {
    mock.roleAssignment.findFirst.mockResolvedValue({ id: 'existing', status: 'revoked' });
    await grantRole(db, assignment);
    expect(mock.roleAssignment.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: {
      identityId: 'contributor', role: 'content_contributor', scopeType: 'unit',
      projectId: 'complex-a', unitId: 'unit-a', organizationId: null, providerId: null,
    } }));
    expect(mock.roleAssignment.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'existing' }, data: { status: 'active', grantedByIdentityId: 'founder' },
    }));
    expect(mock.roleAssignment.create).not.toHaveBeenCalled();
  });

  it('does not silently widen malformed legacy scope shapes', () => {
    expect(() => validateRoleAssignmentScope({ role: 'staff_ops', scopeType: 'platform', projectId: 'complex-a' })).toThrow();
    expect(() => validateRoleAssignmentScope({ role: 'owner', scopeType: 'project', projectId: 'complex-a', unitId: 'unit-a' })).toThrow();
  });

  it('never gives the contributor any operational can() permission', async () => {
    expect(PERMISSIONS.filter(entry => entry.role === 'content_contributor')).toEqual([]);
    const identity = { id: 'contributor', status: 'active', isAdmin: false } as Identity;
    const actions = new Set([...PERMISSIONS.map(entry => entry.action),
      'units:list', 'units:view', 'units:update', 'projects:create', 'projects:view',
      'people:view', 'people:edit', 'content:edit', 'config:edit', 'admin:modify',
      'projects:edit_and_set_live', 'money:record_payouts_and_reconcile',
    ]);
    for (const scopeType of ['project', 'unit', 'platform']) {
      mock.roleAssignment.findMany.mockResolvedValue([{ ...assignment, scopeType, status: 'active' }]);
      for (const action of actions) for (const requiredAccess of ['read', 'allow'] as const) {
        expect(await can({ identity, action, requiredAccess, resource: { projectId: 'complex-a', unitId: 'unit-a' } }, db), `${scopeType}:${action}:${requiredAccess}`).toBe(false);
      }
    }
  });
});
