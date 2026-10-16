import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { grantPropertyCapability, parsePropertyCapabilityGrant, revokePropertyCapability } from './property-capability-grants';
const access = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock('./property-capability-access', () => ({
  PropertyCapabilityError: class extends Error { constructor(message: string, public status = 403) { super(message); } },
  readPropertyCapabilityAccess: access.read,
}));
const date = new Date('2030-01-01T00:00:00.000Z');
const input = () => ({ identityId: 'employee', role: 'pricing_editor', scopeType: 'unit', projectId: 'project-a', unitId: 'unit-a' });
const parent = () => ({ id: 'parent', identityId: 'manager', role: 'pricing_editor', scopeType: 'project', projectId: 'project-a', unitId: null,
  organizationId: null, providerId: null, status: 'active', canDelegate: true, parentGrantId: null, expiresAt: null });
const row = () => ({ ...input(), id: 'grant', status: 'active', canDelegate: false, parentGrantId: null, expiresAt: null,
  organizationId: null, providerId: null, grantedByIdentityId: 'admin', updatedAt: date });
function database() {
  const tx = { unit: { findUnique: vi.fn().mockResolvedValue({ projectId: 'project-a', status: 'live' }) },
    project: { findUnique: vi.fn().mockResolvedValue({ id: 'project-a', status: 'active' }) },
    identity: { findUnique: vi.fn().mockResolvedValue({ id: 'employee', status: 'invited' }) },
    roleAssignment: { findFirst: vi.fn().mockResolvedValue(null), findUnique: vi.fn().mockResolvedValue(row()),
      findUniqueOrThrow: vi.fn().mockResolvedValue(row()), create: vi.fn().mockImplementation(async ({ data }) => ({ ...data, id: 'grant' })),
      update: vi.fn().mockImplementation(async ({ data }) => ({ ...row(), ...data })), updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    auditLog: { create: vi.fn().mockResolvedValue({}) }, $queryRaw: vi.fn().mockResolvedValue([]), $executeRaw: vi.fn().mockResolvedValue(1) };
  return { ...tx, $transaction: vi.fn(async (callback: (value: typeof tx) => unknown) => callback(tx)) };
}
describe('property capability grant input', () => {
  it('accepts exact unit or explicit project scope', () => {
    expect(parsePropertyCapabilityGrant(input())).toEqual(input());
    expect(parsePropertyCapabilityGrant({ ...input(), scopeType: 'project', unitId: null })).toMatchObject({ scopeType: 'project' });
  });
  it.each([null, [], { ...input(), scopeType: 'platform' }, { ...input(), projectId: ' ' },
    { ...input(), unitId: '' }, { ...input(), role: 'staff_ops' }, { ...input(), role: 'content_contributor' },
    { ...input(), scopeType: 'project' }, { ...input(), canDelegate: 'true' }, { ...input(), parentGrantId: ' ' },
    { ...input(), organizationId: null }, { ...input(), isAdmin: true }, { ...input(), expiresAt: 123 }])('rejects malformed/expanded input %#', value => {
    expect(() => parsePropertyCapabilityGrant(value)).toThrow();
  });
  it('rejects accessors without executing them and rejects symbols', () => {
    const getter = vi.fn(() => 'employee'); const payload = { ...input() };
    Object.defineProperty(payload, 'identityId', { enumerable: true, get: getter });
    expect(() => parsePropertyCapabilityGrant(payload)).toThrow(); expect(getter).not.toHaveBeenCalled();
    expect(() => parsePropertyCapabilityGrant({ ...input(), [Symbol('hidden')]: true })).toThrow();
  });
});
describe('property capability transactional assignment', () => {
  let h: ReturnType<typeof database>, db: PrismaClient;
  beforeEach(() => { h = database(); db = h as unknown as PrismaClient; access.read.mockReset();
    access.read.mockResolvedValue({ actor: { id: 'admin', status: 'active', isAdmin: true }, grants: [] }); });
  it('grants founder root authority to an invited employee and audits exact scope', async () => {
    expect((await grantPropertyCapability(db, 'admin', { ...input(), canDelegate: true })).alreadyGranted).toBe(false);
    expect(access.read).toHaveBeenCalledWith(expect.anything(), 'admin', 'pricing_editor', true);
    expect(h.roleAssignment.create).toHaveBeenCalledWith({ data: expect.objectContaining({ ...input(), canDelegate: true, parentGrantId: null, grantedByIdentityId: 'admin' }) });
    expect(h.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'property_capability.granted', entityId: 'grant' }) });
    expect(h.$transaction).toHaveBeenCalledTimes(1);
  });
  it('creates only a nondelegable child with inherited bounded expiry', async () => {
    access.read.mockResolvedValue({ actor: { id: 'manager', isAdmin: false }, grants: [{ ...parent(), expiresAt: date }] });
    expect((await grantPropertyCapability(db, 'manager', { ...input(), parentGrantId: 'parent' })).grant)
      .toMatchObject({ canDelegate: false, parentGrantId: 'parent', expiresAt: date, grantedByIdentityId: 'manager' });
  });
  it.each(['missing-parent', 'self-grant', 'redelegate', 'foreign-project', 'foreign-unit', 'wrong-parent', 'late-expiry', 'unbounded-expiry'])('denies manager escalation: %s', async reason => {
    const root = parent(); const payload: Record<string, unknown> = { ...input(), parentGrantId: 'parent' };
    if (reason === 'missing-parent') delete payload.parentGrantId;
    if (reason === 'self-grant') payload.identityId = 'manager';
    if (reason === 'redelegate') payload.canDelegate = true;
    if (reason === 'foreign-project') root.projectId = 'foreign';
    if (reason === 'foreign-unit') Object.assign(root, { scopeType: 'unit', unitId: 'other' });
    if (reason === 'wrong-parent') payload.parentGrantId = 'other';
    if (reason.endsWith('expiry')) Object.assign(root, { expiresAt: date });
    if (reason === 'late-expiry') payload.expiresAt = '2031-01-01T00:00:00.000Z';
    if (reason === 'unbounded-expiry') payload.expiresAt = null;
    access.read.mockResolvedValue({ actor: { id: 'manager', isAdmin: false }, grants: [root] });
    await expect(grantPropertyCapability(db, 'manager', payload)).rejects.toMatchObject({ status: 403 });
    expect(h.roleAssignment.create).not.toHaveBeenCalled(); expect(h.auditLog.create).not.toHaveBeenCalled();
  });
  it.each(['blocked', 'deleted'])('rejects %s target', async status => {
    h.identity.findUnique.mockResolvedValue({ id: 'employee', status });
    await expect(grantPropertyCapability(db, 'admin', input())).rejects.toMatchObject({ status: 400 });
    expect(h.roleAssignment.create).not.toHaveBeenCalled();
  });
  it.each(['foreign', 'offboarded', 'missing'])('rejects %s unit', async state => {
    h.unit.findUnique.mockResolvedValue(state === 'missing' ? null : { projectId: state === 'foreign' ? 'foreign' : 'project-a', status: state });
    await expect(grantPropertyCapability(db, 'admin', input())).rejects.toMatchObject({ status: 400 });
  });
  it.each(['2020-01-01T00:00:00.000Z', 'invalid', '2030-01-01'])('rejects invalid/noncanonical/past expiry %s', async expiresAt => {
    await expect(grantPropertyCapability(db, 'admin', { ...input(), expiresAt })).rejects.toMatchObject({ status: 400 });
  });
  it('does not let admin impersonate a manager parent', async () => {
    await expect(grantPropertyCapability(db, 'admin', { ...input(), parentGrantId: 'parent' })).rejects.toMatchObject({ status: 400 });
  });
  it('deduplicates exact retry without duplicate audit or mutation', async () => {
    h.roleAssignment.findFirst.mockResolvedValue(row());
    expect((await grantPropertyCapability(db, 'admin', input())).alreadyGranted).toBe(true);
    expect(h.roleAssignment.create).not.toHaveBeenCalled(); expect(h.roleAssignment.update).not.toHaveBeenCalled();
    expect(h.auditLog.create).not.toHaveBeenCalled(); expect(h.$executeRaw).toHaveBeenCalledTimes(1);
  });
  it('requires reviewed revision before changing existing assignment', async () => {
    h.roleAssignment.findFirst.mockResolvedValue(row());
    await expect(grantPropertyCapability(db, 'admin', { ...input(), canDelegate: true })).rejects.toMatchObject({ status: 409 });
    expect(h.roleAssignment.update).not.toHaveBeenCalled();
  });
  it('preserves provenance and revokes children when delegation removed', async () => {
    h.roleAssignment.findFirst.mockResolvedValue(row()); h.roleAssignment.findUniqueOrThrow.mockResolvedValue({ ...row(), canDelegate: true });
    h.roleAssignment.updateMany.mockResolvedValue({ count: 2 });
    await grantPropertyCapability(db, 'admin', { ...input(), canDelegate: false, expectedUpdatedAt: date.toISOString() });
    expect(h.roleAssignment.update).toHaveBeenCalledWith({ where: { id: 'grant' }, data: { status: 'active', canDelegate: false, expiresAt: null } });
    expect(h.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ data: expect.objectContaining({ revokedChildren: 2 }) }) });
  });
  it('does not return success when atomic audit fails', async () => {
    h.auditLog.create.mockRejectedValue(new Error('audit failed'));
    await expect(grantPropertyCapability(db, 'admin', input())).rejects.toThrow('audit failed');
  });
  it('revokes root and children with one audit and idempotent retry', async () => {
    h.roleAssignment.updateMany.mockResolvedValueOnce({ count: 3 });
    expect((await revokePropertyCapability(db, 'admin', 'grant')).alreadyRevoked).toBe(false);
    expect(h.roleAssignment.updateMany).toHaveBeenCalledWith({ where: { parentGrantId: 'grant', status: 'active' }, data: { status: 'revoked' } });
    h.roleAssignment.findUniqueOrThrow.mockResolvedValue({ ...row(), status: 'revoked' }); h.auditLog.create.mockClear();
    expect((await revokePropertyCapability(db, 'admin', 'grant')).alreadyRevoked).toBe(true); expect(h.auditLog.create).not.toHaveBeenCalled();
  });
  it('lets current manager revoke only its direct child', async () => {
    access.read.mockResolvedValue({ actor: { id: 'manager', isAdmin: false }, grants: [parent()] });
    await expect(revokePropertyCapability(db, 'manager', 'grant')).rejects.toMatchObject({ status: 403 });
    h.roleAssignment.findUnique.mockResolvedValue({ ...row(), parentGrantId: 'parent', grantedByIdentityId: 'manager' });
    expect((await revokePropertyCapability(db, 'manager', 'grant')).alreadyRevoked).toBe(false);
  });
  it('cannot revoke unrelated operational roles', async () => {
    h.roleAssignment.findUnique.mockResolvedValue({ ...row(), role: 'staff_ops' });
    await expect(revokePropertyCapability(db, 'admin', 'grant')).rejects.toMatchObject({ status: 404 });
  });
});
