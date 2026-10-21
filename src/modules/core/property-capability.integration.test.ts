import { beforeEach, describe, expect, it } from 'vitest';
import { db, resetDb, createIdentity, createProject, createUnit } from '@/test/util';
import { grantPropertyCapability, revokePropertyCapability } from './property-capability-grants';
import { assertPropertyCapabilityForUnit, listPropertyCapabilityUnits } from './property-capability-access';
import { can } from './permissions';

const url = new URL(process.env.DATABASE_URL_TEST ?? 'http://invalid');
if (!['localhost', '127.0.0.1'].includes(url.hostname) || !['/myuno_test', '/myuno_browser_test'].includes(url.pathname))
  throw new Error('Property capability integration tests require an isolated local myUNO test database');

describe('property capability delegation on real PostgreSQL', () => {
  let adminId: string, managerId: string, employeeId: string, projectId: string, unitId: string, siblingId: string, foreignId: string, parentId: string;
  const expiresAt = () => new Date(Date.now() + 86400_000).toISOString();
  beforeEach(async () => {
    await resetDb(); adminId = (await createIdentity({ isAdmin: true })).id;
    managerId = (await createIdentity()).id; employeeId = (await createIdentity()).id;
    projectId = (await createProject({ status: 'live' })).id;
    unitId = (await createUnit({ projectId, status: 'live' })).id;
    siblingId = (await createUnit({ projectId, status: 'live' })).id;
    const foreignProjectId = (await createProject({ status: 'live' })).id;
    foreignId = (await createUnit({ projectId: foreignProjectId, status: 'live' })).id;
    parentId = (await grantPropertyCapability(db, adminId, { identityId: managerId, role: 'pricing_editor', scopeType: 'project', projectId, canDelegate: true, expiresAt: expiresAt() })).grant.id;
  });
  const delegate = () => grantPropertyCapability(db, managerId, { identityId: employeeId, role: 'pricing_editor', scopeType: 'unit', projectId, unitId, parentGrantId: parentId });
  it('uses one-hop exact scope and denies independent booking/content/finance authority', async () => {
    const child = (await delegate()).grant;
    expect(child.canDelegate).toBe(false); expect(child.parentGrantId).toBe(parentId);
    expect(child.expiresAt).toEqual((await db.roleAssignment.findUniqueOrThrow({ where: { id: parentId } })).expiresAt);
    expect((await listPropertyCapabilityUnits(db, employeeId, 'pricing_editor')).map(unit => unit.id)).toEqual([unitId]);
    for (const id of [siblingId, foreignId]) await expect(assertPropertyCapabilityForUnit(db, employeeId, 'pricing_editor', id)).rejects.toMatchObject({ status: 403 });
    const identity = await db.identity.findUniqueOrThrow({ where: { id: employeeId } });
    for (const action of ['units:manage_booking_mode', 'units:view_full_record', 'units:manage_availability_and_pricing', 'people:edit', 'content:edit'])
      expect(await can({ identity, action, resource: { projectId, unitId } }, db)).toBe(false);
  });
  it('rejects capability, scope, expiry and second-hop escalation before mutation', async () => {
    const before = await db.roleAssignment.count();
    for (const change of [{ role: 'booking_mode_editor' }, { canDelegate: true }, { unitId: foreignId },
      { expiresAt: new Date(Date.now() + 7 * 86400_000).toISOString() }])
      await expect(grantPropertyCapability(db, managerId, { identityId: employeeId, role: 'pricing_editor', scopeType: 'unit', projectId, unitId, parentGrantId: parentId, ...change })).rejects.toThrow();
    expect(await db.roleAssignment.count()).toBe(before);
    const child = (await delegate()).grant; const other = await createIdentity();
    await expect(grantPropertyCapability(db, employeeId, { identityId: other.id, role: 'pricing_editor', scopeType: 'unit', projectId, unitId, parentGrantId: child.id })).rejects.toMatchObject({ status: 403 });
  });
  it('blocks malformed direct database parent links, cycles and transferable provenance', async () => {
    const child = (await delegate()).grant;
    await expect(db.roleAssignment.update({ where: { id: parentId }, data: { parentGrantId: child.id, canDelegate: false } })).rejects.toThrow();
    await expect(db.roleAssignment.update({ where: { id: child.id }, data: { canDelegate: true } })).rejects.toThrow();
    await expect(db.roleAssignment.update({ where: { id: parentId }, data: { identityId: employeeId } })).rejects.toThrow();
    await expect(db.roleAssignment.update({ where: { id: child.id }, data: { role: 'booking_mode_editor' } })).rejects.toThrow();
    await expect(db.roleAssignment.update({ where: { id: parentId }, data: { role: 'staff_ops', canDelegate: false } })).rejects.toThrow();
    expect((await db.roleAssignment.findUniqueOrThrow({ where: { id: child.id } })).role).toBe('pricing_editor');
  });
  it('immediately hides names and denies writes when manager is blocked, expired or revoked', async () => {
    await delegate();
    await db.identity.update({ where: { id: managerId }, data: { status: 'blocked' } });
    expect(await listPropertyCapabilityUnits(db, employeeId, 'pricing_editor')).toEqual([]);
    await expect(assertPropertyCapabilityForUnit(db, employeeId, 'pricing_editor', unitId)).rejects.toMatchObject({ status: 403 });
    await db.identity.update({ where: { id: managerId }, data: { status: 'active' } });
    await db.roleAssignment.update({ where: { id: parentId }, data: { expiresAt: new Date(0) } });
    expect(await listPropertyCapabilityUnits(db, employeeId, 'pricing_editor')).toEqual([]);
    await revokePropertyCapability(db, adminId, parentId);
    expect(await db.roleAssignment.count({ where: { parentGrantId: parentId, status: 'active' } })).toBe(0);
  });
  it('does not resurrect child authority when founder later restores a revoked manager grant', async () => {
    const child = (await delegate()).grant;
    await revokePropertyCapability(db, adminId, parentId);
    const parent = await db.roleAssignment.findUniqueOrThrow({ where: { id: parentId } });
    await grantPropertyCapability(db, adminId, { identityId: managerId, role: 'pricing_editor', scopeType: 'project', projectId,
      canDelegate: true, expiresAt: expiresAt(), expectedUpdatedAt: parent.updatedAt.toISOString() });
    expect((await db.roleAssignment.findUniqueOrThrow({ where: { id: child.id } })).status).toBe('revoked');
    expect(await listPropertyCapabilityUnits(db, employeeId, 'pricing_editor')).toEqual([]);
  });
  it('serializes concurrent identical grants and returns one audited assignment', async () => {
    const results = await Promise.all([delegate(), delegate()]);
    expect(results[0].grant.id).toBe(results[1].grant.id);
    expect(results.filter(result => result.alreadyGranted)).toHaveLength(1);
    expect(await db.auditLog.count({ where: { action: 'property_capability.granted', actorIdentityId: managerId } })).toBe(1);
  });
  it('rolls assignment back if its audit cannot commit', async () => {
    const failing = db.$extends({ query: { auditLog: { async create() { throw new Error('synthetic audit failure'); } } } });
    const before = await db.roleAssignment.count();
    await expect(grantPropertyCapability(failing as unknown as typeof db, managerId, {
      identityId: employeeId, role: 'pricing_editor', scopeType: 'unit', projectId, unitId, parentGrantId: parentId,
    })).rejects.toThrow('synthetic audit failure');
    expect(await db.roleAssignment.count()).toBe(before);
  });
  it('a revocation committed before the locked check prevents the write', async () => {
    await delegate();
    let locked!: () => void, release!: () => void;
    const ready = new Promise<void>(resolve => { locked = resolve; });
    const unblock = new Promise<void>(resolve => { release = resolve; });
    const revoke = db.$transaction(async tx => {
      await tx.roleAssignment.update({ where: { id: parentId }, data: { status: 'revoked' } });
      locked(); await unblock;
    });
    await ready;
    const write = db.$transaction(async tx => {
      await assertPropertyCapabilityForUnit(tx, employeeId, 'pricing_editor', unitId, true);
      await tx.unit.update({ where: { id: unitId }, data: { name: 'should-never-write' } });
    });
    release(); await revoke;
    await expect(write).rejects.toMatchObject({ status: 403 });
    expect((await db.unit.findUniqueOrThrow({ where: { id: unitId } })).name).not.toBe('should-never-write');
  });
});
