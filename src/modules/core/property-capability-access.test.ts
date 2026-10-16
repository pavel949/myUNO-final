import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { assertPropertyCapabilityForUnit, listPropertyCapabilityUnits, readPropertyCapabilityAccess } from './property-capability-access';

const parent = () => ({ id: 'parent', identityId: 'manager', role: 'pricing_editor', status: 'active',
  scopeType: 'project', projectId: 'project-a', unitId: null, unit: null,
  organizationId: null, providerId: null, canDelegate: true, parentGrantId: null,
  expiresAt: null, identity: { status: 'active' } });
const leaf = () => ({ id: 'leaf', identityId: 'employee', role: 'pricing_editor', status: 'active',
  scopeType: 'unit', projectId: 'project-a', unitId: 'unit-a', unit: { projectId: 'project-a' },
  organizationId: null, providerId: null, canDelegate: false, parentGrantId: 'parent',
  grantedByIdentityId: 'manager', expiresAt: null, parentGrant: parent() });
const actor = { id: 'employee', status: 'active', isAdmin: false };
function database() {
  return {
    identity: { findUnique: vi.fn().mockResolvedValue(actor) },
    roleAssignment: { findMany: vi.fn().mockImplementation(async () => [leaf()]) },
    unit: { findUnique: vi.fn().mockResolvedValue({ id: 'unit-a', projectId: 'project-a', name: 'Unit A', status: 'live', inventoryCategoryId: 'category', updatedAt: new Date(), instantBook: false }),
      findMany: vi.fn().mockResolvedValue([{ id: 'unit-a', name: 'Unit A', projectId: 'project-a', project: { name: 'Project A' } }]) },
    $queryRaw: vi.fn().mockResolvedValue([]),
  };
}
describe('current delegated property capability reads', () => {
  let h: ReturnType<typeof database>, db: PrismaClient;
  beforeEach(() => { h = database(); db = h as unknown as PrismaClient; });
  it('returns only safe picker fields after current parent checks', async () => {
    expect(await listPropertyCapabilityUnits(db, 'employee', 'pricing_editor')).toHaveLength(1);
    expect(h.unit.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: { not: 'offboarded' }, OR: [{ id: 'unit-a', projectId: 'project-a' }] },
      select: { id: true, name: true, projectId: true, project: { select: { name: true } } },
    }));
  });
  it.each(['revoked-parent', 'blocked-parent', 'expired-parent', 'changed-parent', 'missing-parent', 'expired-leaf', 'moved-unit', 'moved-parent-unit'])('removes listing and write authority for %s', async reason => {
    const row = leaf();
    if (reason === 'revoked-parent') row.parentGrant.status = 'revoked';
    if (reason === 'blocked-parent') row.parentGrant.identity.status = 'blocked';
    if (reason === 'expired-parent') Object.assign(row.parentGrant, { expiresAt: new Date(0) });
    if (reason === 'changed-parent') row.parentGrant.identityId = 'other-manager';
    if (reason === 'missing-parent') Object.assign(row, { parentGrant: null });
    if (reason === 'expired-leaf') Object.assign(row, { expiresAt: new Date(0) });
    if (reason === 'moved-unit') row.unit.projectId = 'foreign';
    if (reason === 'moved-parent-unit') Object.assign(row.parentGrant, { scopeType: 'unit', unitId: 'unit-a', unit: { projectId: 'foreign' } });
    h.roleAssignment.findMany.mockResolvedValue([row]);
    expect(await listPropertyCapabilityUnits(db, 'employee', 'pricing_editor')).toEqual([]);
    expect(h.unit.findMany).not.toHaveBeenCalled();
    await expect(assertPropertyCapabilityForUnit(db, 'employee', 'pricing_editor', 'unit-a')).rejects.toMatchObject({ status: 403 });
  });
  it('denies a stale active session when current identity is blocked', async () => {
    h.identity.findUnique.mockResolvedValue({ ...actor, status: 'blocked' });
    await expect(readPropertyCapabilityAccess(db, 'employee', 'pricing_editor')).rejects.toMatchObject({ status: 403 });
    expect(h.roleAssignment.findMany).not.toHaveBeenCalled();
  });
  it('uses the actual target project, not caller-supplied scope', async () => {
    h.unit.findUnique.mockResolvedValue({ id: 'unit-a', projectId: 'foreign', status: 'live' });
    await expect(assertPropertyCapabilityForUnit(db, 'employee', 'pricing_editor', 'unit-a')).rejects.toMatchObject({ status: 403 });
  });
  it('denies booking-mode authority when only pricing is granted', async () => {
    expect((await readPropertyCapabilityAccess(db, 'employee', 'booking_mode_editor')).grants).toEqual([]);
  });
  it('locks and rereads the actual current ancestor before a canonical write', async () => {
    h.roleAssignment.findMany.mockResolvedValueOnce([leaf()]).mockResolvedValueOnce([{ ...leaf(), parentGrant: { ...parent(), status: 'revoked' } }]);
    await expect(assertPropertyCapabilityForUnit(db, 'employee', 'pricing_editor', 'unit-a', true)).rejects.toMatchObject({ status: 403 });
    expect(h.$queryRaw.mock.calls.map(call => call[0].join('?'))).toEqual([
      'SELECT id FROM unit WHERE id = ? FOR UPDATE',
      'SELECT id FROM identity WHERE id = ANY(?::text[]) ORDER BY id FOR SHARE',
      'SELECT id FROM role_assignment WHERE id = ANY(?::text[]) ORDER BY id FOR SHARE',
    ]);
    expect(h.$queryRaw.mock.calls[1][1]).toEqual(['employee', 'manager']);
    expect(h.$queryRaw.mock.calls[2][1]).toEqual(['leaf', 'parent']);
  });
  it('never authorizes a newly inserted grant that was not in the locked row set', async () => {
    h.roleAssignment.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([leaf()]);
    expect((await readPropertyCapabilityAccess(db, 'employee', 'pricing_editor', true)).grants).toEqual([]);
  });
  it('preserves an independent valid grant when another parent is revoked', async () => {
    h.roleAssignment.findMany.mockResolvedValue([{ ...leaf(), parentGrant: { ...parent(), status: 'revoked' } },
      { ...leaf(), id: 'direct', parentGrantId: null, parentGrant: null }]);
    expect((await readPropertyCapabilityAccess(db, 'employee', 'pricing_editor')).grants.map(row => row.id)).toEqual(['direct']);
  });
});
