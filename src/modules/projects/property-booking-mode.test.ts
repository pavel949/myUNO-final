import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { previewPropertyBookingMode, applyPropertyBookingMode } from './property-booking-mode';
const readiness = vi.hoisted(() => vi.fn());
vi.mock('./property-readiness', () => ({ getPropertyReadiness: readiness }));
const version = new Date('2026-01-01T00:00:00Z');
function fixture() {
  const actor = { id: 'employee', status: 'active', isAdmin: false };
  const grant = { id: 'grant', identityId: 'employee', role: 'booking_mode_editor', status: 'active', scopeType: 'project',
    projectId: 'p', unitId: null, unit: null, parentGrant: null, parentGrantId: null, canDelegate: false, expiresAt: null,
    organizationId: null, providerId: null };
  const units = ['a', 'b'].map(id => ({ id, name: `Unit ${id}`, projectId: 'p', inventoryCategoryId: 'category', status: 'live',
    instantBook: false, updatedAt: version, permittedUseConfirmedAt: version, project: { status: 'live' } }));
  let receipt: null | { data: Record<string, unknown> } = null;
  const tx = { identity: { findUnique: vi.fn(async () => actor) },
    roleAssignment: { findMany: vi.fn(async () => [grant]) },
    unit: { findUnique: vi.fn(async ({ where }) => units.find(unit => unit.id === where.id) ?? null),
      findUniqueOrThrow: vi.fn(async ({ where }) => { const unit = units.find(row => row.id === where.id); if (!unit) throw Error('missing'); return unit; }),
      findMany: vi.fn(async ({ where }) => units.filter(unit => (!where.id?.in || where.id.in.includes(unit.id)) &&
        (!where.inventoryCategoryId || unit.inventoryCategoryId === where.inventoryCategoryId))),
      updateMany: vi.fn(async ({ where, data }) => { const unit = units.find(row => row.id === where.id && row.updatedAt === where.updatedAt);
        if (!unit) return { count: 0 }; Object.assign(unit, data, { updatedAt: new Date() }); return { count: 1 }; }) },
    auditLog: { findFirst: vi.fn(async () => receipt), create: vi.fn(async ({ data }) => { receipt = data; return data; }) },
    $queryRaw: vi.fn().mockResolvedValue([]), $executeRaw: vi.fn().mockResolvedValue(1) };
  const db = { ...tx, $transaction: vi.fn(async (run: (value: typeof tx) => unknown) => run(tx)) } as unknown as PrismaClient;
  return { db, tx, actor, grant, units };
}
const input = { actorIdentityId: 'employee', unitId: 'a', scope: 'unit' as const, instantBook: true };
describe('scoped canonical booking-mode writer', () => {
  beforeEach(() => { readiness.mockReset(); readiness.mockResolvedValue({ blockers: [] }); });
  it('previews exact affected names and modes without mutation', async () => {
    const f = fixture(); const preview = await previewPropertyBookingMode(f.db, input);
    expect(preview.units).toEqual([{ id: 'a', name: 'Unit a', instantBook: false }]);
    expect(preview.baseline).toMatch(/^[a-f0-9]{64}$/); expect(preview.blocked).toEqual([]);
    expect(f.tx.unit.updateMany).not.toHaveBeenCalled(); expect(f.tx.auditLog.create).not.toHaveBeenCalled();
  });
  it('writes only instantBook, atomically audits, and retries exactly once without touching occupancy or bookings', async () => {
    const f = fixture(); const preview = await previewPropertyBookingMode(f.db, input);
    const apply = { ...input, baseline: preview.baseline, requestId: 'synthetic-request-1' };
    expect(await applyPropertyBookingMode(f.db, apply)).toMatchObject({ updated: 1, alreadyApplied: false });
    expect(f.tx.unit.updateMany).toHaveBeenCalledWith({ where: { id: 'a', updatedAt: version }, data: { instantBook: true } });
    expect(f.units[1].instantBook).toBe(false);
    expect(await applyPropertyBookingMode(f.db, apply)).toMatchObject({ updated: 1, alreadyApplied: true });
    expect(f.tx.unit.updateMany).toHaveBeenCalledTimes(1); expect(f.tx.auditLog.create).toHaveBeenCalledTimes(1);
  });
  it('requires authority for every category member before returning any preview', async () => {
    const f = fixture(); Object.assign(f.grant, { scopeType: 'unit', unitId: 'a', unit: { projectId: 'p' } });
    await expect(previewPropertyBookingMode(f.db, { ...input, scope: 'category' })).rejects.toMatchObject({ status: 403 });
    expect(f.tx.unit.updateMany).not.toHaveBeenCalled();
  });
  it('locks category membership and all unit rows before an all-or-nothing apply', async () => {
    const f = fixture(); const preview = await previewPropertyBookingMode(f.db, { ...input, scope: 'category' });
    expect((await applyPropertyBookingMode(f.db, { ...input, scope: 'category', baseline: preview.baseline, requestId: 'category-request' })).updated).toBe(2);
    expect(f.tx.$queryRaw.mock.calls.map(call => call[0].join('?'))).toContain('SELECT id FROM inventory_category WHERE id = ? FOR UPDATE');
    expect(f.tx.$queryRaw.mock.calls.map(call => call[0].join('?'))).toContain('SELECT id FROM unit WHERE id = ANY(?::text[]) ORDER BY id FOR UPDATE');
    expect(f.units.every(unit => unit.instantBook)).toBe(true);
  });
  it.each(['new-member', 'removed-member', 'changed-mode', 'changed-version', 'moved-unit'])('rejects stale preview: %s', async reason => {
    const f = fixture(); const preview = await previewPropertyBookingMode(f.db, { ...input, scope: 'category' });
    if (reason === 'new-member') f.units.push({ ...f.units[0], id: 'c', name: 'Unit c' });
    if (reason === 'removed-member') f.units.pop();
    if (reason === 'changed-mode') f.units[0].instantBook = true;
    if (reason === 'changed-version') f.units[0].updatedAt = new Date();
    if (reason === 'moved-unit') f.units[1].projectId = 'foreign';
    await expect(applyPropertyBookingMode(f.db, { ...input, scope: 'category', baseline: preview.baseline, requestId: 'stale-request' })).rejects.toMatchObject({ status: 409 });
    expect(f.tx.unit.updateMany).not.toHaveBeenCalled(); expect(f.tx.auditLog.create).not.toHaveBeenCalled();
  });
  it.each(['revoked', 'blocked', 'pricing-only'])('rejects %s authority at apply time', async reason => {
    const f = fixture(); const preview = await previewPropertyBookingMode(f.db, input);
    if (reason === 'revoked') f.grant.status = 'revoked';
    if (reason === 'blocked') f.actor.status = 'blocked';
    if (reason === 'pricing-only') f.grant.role = 'pricing_editor';
    await expect(applyPropertyBookingMode(f.db, { ...input, baseline: preview.baseline, requestId: 'denied-request' })).rejects.toMatchObject({ status: 403 });
    expect(f.tx.unit.updateMany).not.toHaveBeenCalled();
  });
  it('returns only safe readiness codes and refuses incomplete instant booking server-side', async () => {
    const f = fixture(); readiness.mockResolvedValue({ blockers: [{ scope: 'unit', unitId: 'a', key: 'unit.source_authority', message: 'private source detail' }] });
    const preview = await previewPropertyBookingMode(f.db, input);
    expect(preview.blocked).toEqual([{ unitId: 'a', name: 'Unit a', codes: ['unit.source_authority'] }]);
    expect(JSON.stringify(preview)).not.toContain('private source detail');
    await expect(applyPropertyBookingMode(f.db, { ...input, baseline: preview.baseline, requestId: 'blocked-readiness' })).rejects.toMatchObject({ status: 409 });
  });
  it('allows request-to-book without turning missing prerequisites into publication or availability changes', async () => {
    const f = fixture(); f.units[0].instantBook = true; f.units[0].status = 'draft';
    readiness.mockResolvedValue({ blockers: [{ scope: 'project', key: 'project.area' }] });
    const change = { ...input, instantBook: false }; const preview = await previewPropertyBookingMode(f.db, change);
    await applyPropertyBookingMode(f.db, { ...change, baseline: preview.baseline, requestId: 'request-only-change' });
    expect(f.units[0].status).toBe('draft'); expect(f.tx.unit.updateMany).toHaveBeenCalledWith({ where: { id: 'a', updatedAt: version }, data: { instantBook: false } });
    expect(readiness).not.toHaveBeenCalled();
  });
  it('does not claim a retry is current after another actor changed the mode', async () => {
    const f = fixture(); const preview = await previewPropertyBookingMode(f.db, input);
    const change = { ...input, baseline: preview.baseline, requestId: 'retry-after-change' };
    await applyPropertyBookingMode(f.db, change); f.units[0].instantBook = false;
    await expect(applyPropertyBookingMode(f.db, change)).rejects.toMatchObject({ status: 409 });
    expect(f.tx.unit.updateMany).toHaveBeenCalledTimes(1);
  });
  it('rejects unknown scope and missing reviewed baseline instead of falling back to unit', async () => {
    const f = fixture(); await expect(previewPropertyBookingMode(f.db, { ...input, scope: 'platform' as 'unit' })).rejects.toMatchObject({ status: 400 });
    await expect(applyPropertyBookingMode(f.db, { ...input, baseline: '', requestId: 'valid-request' })).rejects.toMatchObject({ status: 400 });
  });
});
