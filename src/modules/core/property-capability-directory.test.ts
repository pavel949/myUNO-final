import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { propertyDelegationUnits, propertyDelegationWorkspace, resolvePropertyDelegationRecipient } from './property-capability-directory';
const h = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock('./property-capability-access', () => ({ PropertyCapabilityError: class extends Error { constructor(message: string, public status = 403) { super(message); } }, readPropertyCapabilityAccess: h.read }));
const root = () => ({ id: 'root', role: 'pricing_editor', identityId: 'manager', status: 'active', scopeType: 'project', projectId: 'p', unitId: null,
  canDelegate: true, parentGrantId: null, expiresAt: null, organizationId: null, providerId: null });
function fixture() {
  const row = { ...root(), id: 'child', identityId: 'employee', grantedByIdentityId: 'manager', parentGrantId: 'root', canDelegate: false,
    scopeType: 'unit', unitId: 'a', updatedAt: new Date('2026-01-01'), project: { name: 'Assigned project' }, unit: { name: 'Assigned unit', projectId: 'p' },
    identity: { firstName: 'Synthetic', lastName: 'Employee', email: 'employee@example.test', status: 'active' } };
  const raw = { identity: { findUnique: vi.fn().mockResolvedValue({ id: 'employee', status: 'active' }) },
    unit: { findMany: vi.fn().mockResolvedValue([{ id: 'a', name: 'Assigned unit' }]) },
    roleAssignment: { findMany: vi.fn().mockImplementation(async ({ where }) => where.id ? [{ ...root(), project: { name: 'Assigned project' }, unit: null }] : [row]) } };
  return { db: raw as unknown as PrismaClient, raw, row };
}
beforeEach(() => { h.read.mockReset(); h.read.mockImplementation(async (_db, _id, role) => ({ actor: { id: 'manager', isAdmin: false }, grants: role === 'pricing_editor' ? [root()] : [] })); });
describe('scoped delegation directory', () => {
  it('returns only own delegable roots and direct employee assignment projections', async () => {
    const f = fixture(); const result = await propertyDelegationWorkspace(f.db, 'manager');
    expect(result.grants).toHaveLength(1); expect(result.assignments).toHaveLength(1);
    expect(result.assignments[0]).toMatchObject({ name: 'Synthetic Employee', email: 'employee@example.test', unitId: 'a', parentGrantId: 'root' });
    expect(f.raw.roleAssignment.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: { parentGrantId: { in: ['root'] }, grantedByIdentityId: 'manager' } }));
  });
  it.each(['foreign-project', 'moved-unit', 'different-capability'])('does not disclose malformed %s child', async reason => {
    const f = fixture(); if (reason === 'foreign-project') f.row.projectId = 'foreign';
    if (reason === 'moved-unit') f.row.unit.projectId = 'foreign'; if (reason === 'different-capability') f.row.role = 'booking_mode_editor';
    expect((await propertyDelegationWorkspace(f.db, 'manager')).assignments).toEqual([]);
  });
  it('requires current delegation before any global recipient lookup', async () => {
    const f = fixture(); h.read.mockResolvedValue({ actor: { id: 'manager', isAdmin: false }, grants: [] });
    await expect(resolvePropertyDelegationRecipient(f.db, 'manager', 'pricing_editor', 'root', 'employee@example.test')).rejects.toMatchObject({ status: 403 });
    expect(f.raw.identity.findUnique).not.toHaveBeenCalled(); expect(f.raw.roleAssignment.findMany).not.toHaveBeenCalled();
  });
  it('looks up only the exact normalized email and exposes no private account columns', async () => {
    const f = fixture(); expect(await resolvePropertyDelegationRecipient(f.db, 'manager', 'pricing_editor', 'root', ' Employee@Example.test ')).toBe('employee');
    expect(f.raw.identity.findUnique).toHaveBeenCalledWith({ where: { email: 'employee@example.test' }, select: { id: true, status: true } });
  });
  it.each([null, { id: 'employee', status: 'blocked' }, { id: 'employee', status: 'merged' }])('rejects unavailable recipient %j', async row => {
    const f = fixture(); f.raw.identity.findUnique.mockResolvedValue(row);
    await expect(resolvePropertyDelegationRecipient(f.db, 'manager', 'pricing_editor', 'root', 'employee@example.test')).rejects.toMatchObject({ status: 400 });
  });
  it('filters unit search within current parent scope and caps projection to fifty', async () => {
    const f = fixture(); f.raw.unit.findMany.mockResolvedValue(Array.from({ length: 51 }, (_, i) => ({ id: String(i), name: 'Unit' })));
    const result = await propertyDelegationUnits(f.db, 'manager', { role: 'pricing_editor', parentGrantId: 'root', query: ' A ' });
    expect(result.units).toHaveLength(50); expect(result.hasMore).toBe(true);
    expect(f.raw.unit.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { projectId: 'p', status: { not: 'offboarded' },
      OR: [{ name: { contains: 'A', mode: 'insensitive' } }, { id: 'A' }] }, select: { id: true, name: true }, take: 51 }));
  });
  it('does not widen an exact-unit parent during unit search', async () => {
    const f = fixture(); h.read.mockResolvedValue({ actor: { isAdmin: false }, grants: [{ ...root(), scopeType: 'unit', unitId: 'a' }] });
    await propertyDelegationUnits(f.db, 'manager', { role: 'pricing_editor', parentGrantId: 'root', query: '' });
    expect(f.raw.unit.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { projectId: 'p', id: 'a', status: { not: 'offboarded' } } }));
  });
  it.each([{ role: 'content_contributor' }, { parentGrantId: 'other' }, { query: 'x'.repeat(201) }])('rejects invalid or unowned search %j', async changes => {
    const f = fixture(); await expect(propertyDelegationUnits(f.db, 'manager', { role: 'pricing_editor', parentGrantId: 'root', query: '', ...changes })).rejects.toThrow();
    expect(f.raw.unit.findMany).not.toHaveBeenCalled();
  });
});
