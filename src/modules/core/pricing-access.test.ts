import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { assertUnitPricingAccess, listPricingUnits } from './pricing-access';
import { can } from './permissions';

const units = [
  { id: 'a', name: 'A', projectId: 'p1', status: 'live', inventoryCategoryId: 'cat' },
  { id: 'b', name: 'B', projectId: 'p1', status: 'live', inventoryCategoryId: 'cat' },
  { id: 'c', name: 'C', projectId: 'p2', status: 'live', inventoryCategoryId: 'foreign-cat' },
];
const assignment = (over = {}) => ({ id: 'grant', unit: { projectId: 'p1' }, parentGrant: null, parentGrantId: null, identityId: 'editor', role: 'pricing_editor', status: 'active',
  scopeType: 'unit', projectId: 'p1', unitId: 'a', organizationId: null, providerId: null, ...over });
function fixture(assignments = [assignment()], actor = { id: 'editor', status: 'active', isAdmin: false }) {
  const db = { identity: { findUnique: vi.fn(async () => actor) },
    operatingSpaceMember: { findMany: vi.fn(async () => []) },
    roleAssignment: { findMany: vi.fn(async ({ where }) => assignments.filter(a => a.status === where.status && (!where.role || a.role === where.role))) },
    unit: { findUnique: vi.fn(async ({ where }) => units.find(u => u.id === where.id) ?? null),
      findMany: vi.fn(async ({ where }) => units.filter(u => !where.OR || where.OR.some((scope: { id?: string; projectId: string }) =>
        u.projectId === scope.projectId && (!scope.id || u.id === scope.id))).map(u => ({ id: u.id, name: u.name, projectId: u.projectId, project: { name: u.projectId } }))) },
  };
  return { db: db as unknown as PrismaClient, raw: db };
}
describe('independent pricing authority', () => {
  it('allows one exact unit and denies its same-category sibling and foreign project', async () => {
    const { db } = fixture();
    expect((await assertUnitPricingAccess(db, 'editor', 'a')).unit.id).toBe('a');
    for (const id of ['b', 'c']) await expect(assertUnitPricingAccess(db, 'editor', id)).rejects.toMatchObject({ status: 403 });
    expect((await listPricingUnits(db, 'editor')).map(u => u.id)).toEqual(['a']);
  });
  it('explicit project scope covers its child units only', async () => {
    const { db } = fixture([assignment({ scopeType: 'project', unitId: null })]);
    for (const id of ['a', 'b']) expect((await assertUnitPricingAccess(db, 'editor', id)).unit.id).toBe(id);
    await expect(assertUnitPricingAccess(db, 'editor', 'c')).rejects.toMatchObject({ status: 403 });
    expect((await listPricingUnits(db, 'editor')).map(u => u.id)).toEqual(['a', 'b']);
  });
  it.each(['content_contributor', 'staff_ops', 'onsite_host', 'owner', 'mc_member'])('does not inherit pricing editor authority from %s', async role => {
    const { db } = fixture([assignment({ role })]);
    await expect(assertUnitPricingAccess(db, 'editor', 'a')).rejects.toMatchObject({ status: 403 });
    expect(await listPricingUnits(db, 'editor')).toEqual([]);
  });
  it.each([
    { scopeType: 'platform', projectId: null, unitId: null }, { projectId: 'p2' },
    { scopeType: 'project', unitId: 'a' }, { organizationId: 'org' }, { providerId: 'provider' }, { status: 'revoked' }, { scopeType: 'project', unitId: '' }, { organizationId: '' }, { projectId: ' p1' },
  ])('rejects invalid or revoked grant %j', async change => {
    const { db } = fixture([assignment(change)]);
    await expect(assertUnitPricingAccess(db, 'editor', 'a')).rejects.toMatchObject({ status: 403 });
    expect((await listPricingUnits(db, 'editor')).some(unit => unit.id === 'a')).toBe(false);
  });
  it.each(['blocked', 'invited', 'inactive'])('refuses a %s identity even with administrator flag', async status => {
    const { db } = fixture([], { id: 'admin', status, isAdmin: true });
    await expect(assertUnitPricingAccess(db, 'admin', 'a')).rejects.toMatchObject({ status: 403 });
  });
  it('active admin remains allowed and missing units fail closed', async () => {
    const { db } = fixture([], { id: 'admin', status: 'active', isAdmin: true });
    expect((await assertUnitPricingAccess(db, 'admin', 'c')).isAdmin).toBe(true);
    await expect(assertUnitPricingAccess(db, 'admin', 'missing')).rejects.toMatchObject({ status: 404 });
  });
  it('cannot read finance, availability, bookings, full unit records or grant roles', async () => {
    const { db, raw } = fixture();
    const identity = await raw.identity.findUnique();
    for (const action of ['units:view_full_record', 'units:manage_availability_and_pricing', 'stays:view_booking',
      'money:view_own_statements_and_payouts', 'money:record_costs_on_units', 'admin:grant_revoke_roles', 'people:edit']) {
      expect(await can({ identity: identity as never, action, resource: { projectId: 'p1', unitId: 'a' } }, db)).toBe(false);
    }
  });
  it('list DTO selects no bookings, owner identity, financial data or category counts', async () => {
    const { db, raw } = fixture(); await listPricingUnits(db, 'editor');
    expect(raw.unit.findMany).toHaveBeenCalledWith(expect.objectContaining({ select: {
      id: true, name: true, projectId: true, project: { select: { name: true } },
    } }));
  });
});
