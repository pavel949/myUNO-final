import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Identity, PrismaClient } from '@prisma/client';
import { validateRoleAssignmentScope } from './role-assignment-policy';
import { grantRole } from './people.service';
import { can, PERMISSIONS } from './permissions';

vi.mock('@/lib/prisma', () => ({ prisma: {} }));

const assignment = {
  identityId: 'editor', role: 'pricing_editor' as const,
  scopeType: 'unit' as const, projectId: 'complex-a', unitId: 'unit-a',
  grantedByIdentityId: 'founder',
};
function database() {
  const tx = {
    operatingSpaceMember: { findMany: vi.fn().mockResolvedValue([]) },
    identity: { findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
      where.id === 'founder' ? { id: 'founder', isAdmin: true, status: 'active' } : { id: where.id, isAdmin: false, status: 'active' }) },
    project: { findUnique: vi.fn().mockResolvedValue({ id: 'complex-a', status: 'active' }) },
    unit: { findUnique: vi.fn().mockResolvedValue({ id: 'unit-a', projectId: 'complex-a', status: 'live' }) },
    roleAssignment: {
      findFirst: vi.fn().mockResolvedValue(null),
      findUniqueOrThrow: vi.fn(), updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      findMany: vi.fn().mockResolvedValue([{ ...assignment, id: 'grant-a', unit: { projectId: 'complex-a' }, parentGrant: null, status: 'active' }]),
      create: vi.fn(async ({ data }) => ({ id: 'grant-a', ...data })),
      update: vi.fn(async ({ data }) => ({ id: 'grant-a', ...data })),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
    $queryRaw: vi.fn().mockResolvedValue([]), $executeRaw: vi.fn().mockResolvedValue(1),
  };
  return { ...tx, $transaction: vi.fn(async (callback: (value: typeof tx) => unknown) => callback(tx)) };
}

describe('pricing editor role assignment', () => {
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
    expect(mock.unit.findUnique).toHaveBeenCalledWith({ where: { id: 'unit-a' }, select: { projectId: true, status: true } });
    expect(mock.roleAssignment.create).toHaveBeenCalledWith(expect.objectContaining({ data: {
      ...assignment, organizationId: null, providerId: null, status: 'active', canDelegate: false, parentGrantId: null, expiresAt: null,
    } }));
  });

  it('grants explicit project pricing separately with no unit', async () => {
    await grantRole(db, { ...assignment, scopeType: 'project', unitId: undefined });
    expect(mock.unit.findUnique).not.toHaveBeenCalled();
    expect(mock.roleAssignment.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      role: 'pricing_editor', scopeType: 'project', projectId: 'complex-a', unitId: null,
    }) }));
  });

  it.each([null, { id: 'unit-a', projectId: 'complex-b' }])('rejects missing or cross-project units: %j', async unit => {
    mock.unit.findUnique.mockResolvedValue(unit);
    await expect(grantRole(db, assignment)).rejects.toThrow(/outside the selected active inventory/);
    expect(mock.roleAssignment.create).not.toHaveBeenCalled();
  });

  it('rejects a missing project', async () => {
    mock.project.findUnique.mockResolvedValue(null);
    await expect(grantRole(db, { ...assignment, scopeType: 'project', unitId: undefined })).rejects.toThrow(/active project/);
    expect(mock.roleAssignment.create).not.toHaveBeenCalled();
  });

  it.each(['invited', 'blocked', 'merged', 'deletion_requested'])('rejects a %s admin as granter', async status => {
    mock.identity.findUnique.mockResolvedValue({ id: 'founder', isAdmin: true, status });
    await expect(grantRole(db, assignment)).rejects.toThrow(/Active account required|current delegable capability/);
    expect(mock.roleAssignment.create).not.toHaveBeenCalled();
  });

  it('rejects self-grants and non-admin operational staff', async () => {
    await expect(grantRole(db, { ...assignment, grantedByIdentityId: 'editor' })).rejects.toThrow(/Active account required|current delegable capability/);
    expect(mock.roleAssignment.create).not.toHaveBeenCalled();
  });

  it('reactivates only a reviewed exact assignment without changing provenance', async () => {
    const updatedAt = new Date('2030-01-01T00:00:00.000Z');
    const existing = { ...assignment, id: 'existing', status: 'revoked', canDelegate: false, parentGrantId: null,
      expiresAt: null, organizationId: null, providerId: null, updatedAt };
    mock.roleAssignment.findFirst.mockResolvedValue(existing);
    mock.roleAssignment.findUniqueOrThrow.mockResolvedValue(existing);
    await grantRole(db, { ...assignment, expectedUpdatedAt: updatedAt.toISOString() });
    expect(mock.roleAssignment.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: {
      identityId: 'editor', role: 'pricing_editor', scopeType: 'unit', projectId: 'complex-a', unitId: 'unit-a',
      organizationId: null, providerId: null, parentGrantId: null,
    } }));
    expect(mock.roleAssignment.update).toHaveBeenCalledWith({ where: { id: 'existing' },
      data: { status: 'active', canDelegate: false, expiresAt: null } });
    expect(mock.roleAssignment.create).not.toHaveBeenCalled();
  });

  it('does not silently widen malformed legacy scope shapes', () => {
    expect(() => validateRoleAssignmentScope({ role: 'staff_ops', scopeType: 'platform', projectId: 'complex-a' })).toThrow();
    expect(() => validateRoleAssignmentScope({ role: 'owner', scopeType: 'project', projectId: 'complex-a', unitId: 'unit-a' })).toThrow();
  });

});

const identity = { id: 'editor', status: 'active', isAdmin: false } as Identity;
const resource = { projectId: 'complex-a', unitId: 'unit-a' };
describe('pricing editor permission boundary', () => {
  let mock: ReturnType<typeof database>;
  let db: PrismaClient;
  beforeEach(() => { mock = database(); db = mock as unknown as PrismaClient; });
  const check = (db: PrismaClient, context: Record<string, unknown> = {}) => can({ identity, action: 'units:manage_pricing', requiredAccess: 'allow', resource, ...context }, db);

  it('registers exactly one independent permission', () => {
    expect(PERMISSIONS.filter(row => row.role === 'pricing_editor')).toEqual([
      { action: 'units:manage_pricing', role: 'pricing_editor', access: 'allow', scope: 'assigned_pricing' },
    ]);
  });
  it('allows only the exact assigned unit and verifies its persisted project', async () => {
    expect(await check(db)).toBe(true);
    expect(mock.unit.findUnique).toHaveBeenCalledWith({ where: { id: 'unit-a' }, select: { projectId: true, status: true } });
    expect(await check(db, {resource: {...resource, unitId: 'sibling'}})).toBe(false);
    expect(await check(db, {resource: {projectId: 'complex-a'}})).toBe(false);
  });
  it('allows an explicit project grant for its units and project listing only', async () => {
    mock.roleAssignment.findMany.mockResolvedValue([{...assignment, id: 'grant-a', unit: { projectId: 'complex-a' }, parentGrant: null, scopeType: 'project', unitId: null, status: 'active'}]);
    expect(await check(db)).toBe(true);
    expect(await check(db, {resource: {projectId: 'complex-a'}})).toBe(true);
    expect(await check(db, {resource: {projectId: 'foreign'}})).toBe(false);
    expect(await check(db, {resource: {...resource, projectId: 'foreign'}})).toBe(false);
  });
  it.each([null, {projectId: 'moved-project'}])('denies missing/moved persisted unit even when caller claims project: %j', async unit => {
    mock.unit.findUnique.mockResolvedValue(unit);
    expect(await check(db)).toBe(false);
    mock.roleAssignment.findMany.mockResolvedValue([{...assignment, id: 'grant-a', unit: { projectId: 'complex-a' }, parentGrant: null, scopeType: 'project', unitId: null, status: 'active'}]);
    expect(await check(db)).toBe(false);
  });
  it.each([
    {scopeType: 'platform', projectId: null, unitId: null},
    {scopeType: 'project'}, {scopeType: 'unit', unitId: null}, {projectId: null},
    {organizationId: 'org'}, {providerId: 'provider'}, {projectId: ''},
    {unitId: ''}, {projectId: ' complex-a'}, {unitId: 'unit-a '},
    {scopeType: 'organization'}, {scopeType: 'provider'},
    {status: 'revoked'}, {identityId: 'other-person'},
  ])('denies malformed or unrelated stored grants: %j', async changes => {
    mock.roleAssignment.findMany.mockResolvedValue([{...assignment, id: 'grant-a', unit: { projectId: 'complex-a' }, parentGrant: null, status: 'active', ...changes}]);
    expect(await check(db)).toBe(false);
  });
  it.each([undefined, {}, {unitId: 'unit-a'}, {projectId: ''}, {projectId: 123, unitId: 'unit-a'},
    {projectId: 'complex-a', unitId: null}, {projectId: 'complex-a', unitId: ''},
    {projectId: 'complex-a', unitId: ' unit-a'}])('denies absent or malformed resource: %j', async resource => {
    expect(await check(db, {resource})).toBe(false);
  });
  it.each(['invited', 'blocked', 'merged', 'deletion_requested'])('denies %s actor and stale active caller snapshots', async status => {
    expect(await check(db, {identity: {...identity, status}})).toBe(false);
    mock.identity.findUnique.mockResolvedValue({...identity, status});
    expect(await check(db)).toBe(false);
  });
  it('denies nonexistent actor, no grant, and stale admin claims', async () => {
    mock.identity.findUnique.mockResolvedValue(null);
    expect(await check(db)).toBe(false);
    mock.identity.findUnique.mockResolvedValue(identity);
    mock.roleAssignment.findMany.mockResolvedValue([]);
    expect(await check(db, {identity: {...identity, isAdmin: true}})).toBe(false);
  });
  it('preserves active admin pricing access', async () => {
    mock.identity.findUnique.mockResolvedValue({...identity, isAdmin: true});
    expect(await check(db)).toBe(true);
  });
  it('denies every other permission and legacy alias, including content and private access', async () => {
    const actions = new Set([...PERMISSIONS.map(row => row.action),
      'units:list', 'units:view', 'units:update', 'projects:create', 'projects:view',
      'people:view', 'people:edit', 'content:edit', 'config:edit', 'admin:modify',
      'projects:edit_and_set_live', 'money:record_payouts_and_reconcile',
      'units:edit_private_access', 'property:propose_content',
    ]);
    actions.delete('units:manage_pricing');
    for (const action of actions) for (const requiredAccess of ['read', 'allow'] as const) {
      expect(await can({ identity, action, requiredAccess, resource }, db), action).toBe(false);
    }
  });
  it('preserves separately assigned content behavior: contributor alone still has no can permission', async () => {
    mock.roleAssignment.findMany.mockResolvedValue([{...assignment, id: 'grant-a', unit: { projectId: 'complex-a' }, parentGrant: null, role: 'content_contributor', status: 'active'}]);
    expect(await check(db)).toBe(false);
    expect(PERMISSIONS.filter(row => row.role === 'content_contributor')).toEqual([]);
  });
});
