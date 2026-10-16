import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';
const m = vi.hoisted(() => ({ guard: vi.fn(), unit: vi.fn(), count: vi.fn(), many: vi.fn(), read: vi.fn(), validate: vi.fn(),
  snapshot: vi.fn(), permissions: vi.fn(), adminSave: vi.fn(), employeeSave: vi.fn() }));
vi.mock('@/app/libs/pricingGuard', () => ({ requireUnitPricing: m.guard }));
vi.mock('@/lib/prisma', () => ({ prisma: { unit: { findUnique: m.unit, count: m.count, findMany: m.many } } }));
vi.mock('@/modules/core', () => ({ readTariffDraft: m.read, validateTariffDraft: m.validate, saveTariffDraft: m.adminSave }));
vi.mock('@/modules/core/tariff-editor', () => ({ readTariffEditorSnapshot: m.snapshot, saveEmployeeTariffDraft: m.employeeSave }));
import { GET, PUT } from './route';
const params = { params: { id: 'unit-a' } };
const draft = { includesTaxes: true, includesServiceCharge: true, includesBreakfast: false,
  daily: [{ seasonCode: 'ALL', windows: [{ start: '01-01', end: '12-31' }], amountSatang: 100000, minimumNights: 1 }], monthly: [], yearly: null };
const request = (scope: string = 'unit') => new Request('http://localhost/tariff', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ draft, scope, expectedRevision: 'a'.repeat(64) }) }) as NextRequest;
beforeEach(() => {
  vi.clearAllMocks(); m.guard.mockResolvedValue({ ok: true, isAdmin: false, actorIdentityId: 'editor' });
  m.unit.mockResolvedValue({ id: 'unit-a', inventoryCategoryId: 'category' }); m.read.mockResolvedValue(draft);
  m.validate.mockReturnValue({ errors: [], dailyGaps: [], monthlyGaps: [] });
  m.permissions.mockResolvedValue({ canSave: true, canEditMonthly: false, canEditInclusions: false, canSaveCategory: false, reason: null });
  m.snapshot.mockResolvedValue({ draft, unitRevision: 'a'.repeat(64), categoryRevision: null, categoryUnits: 1, permissions: { canSaveCategory: false } });
  m.employeeSave.mockResolvedValue({ units: 1, revision: 'b'.repeat(64) }); m.adminSave.mockResolvedValue({ units: 2, revision: 'b'.repeat(64) }); m.count.mockResolvedValue(2);
  m.many.mockResolvedValue([{ id: 'unit-a' }, { id: 'unit-b' }]);
});
describe('scoped tariff API', () => {
  it('checks the exact target before read and never exposes category counts to an editor', async () => {
    const response = await GET(request(), params);
    expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ categoryUnits: 1, permissions: { canSaveCategory: false } });
    expect(m.guard).toHaveBeenCalledWith('unit-a'); expect(m.count).not.toHaveBeenCalled();
  });
  it('uses only the transaction-guarded single-unit writer for an employee', async () => {
    expect((await PUT(request(), params)).status).toBe(200);
    expect(m.employeeSave).toHaveBeenCalledWith(expect.anything(), { unitId: 'unit-a', draft, actorIdentityId: 'editor', expectedRevision: 'a'.repeat(64) });
    expect(m.adminSave).not.toHaveBeenCalled(); expect(m.many).not.toHaveBeenCalled();
  });
  it('rejects category fan-out and unknown scopes before any unit enumeration or write', async () => {
    expect((await PUT(request('category'), params)).status).toBe(403);
    expect((await PUT(request('platform'), params)).status).toBe(400);
    expect(m.many).not.toHaveBeenCalled(); expect(m.employeeSave).not.toHaveBeenCalled(); expect(m.adminSave).not.toHaveBeenCalled();
  });
  it.each([401, 403, 404])('stops a refused %i read/save before commercial queries', async status => {
    m.guard.mockResolvedValue({ ok: false, error: new Response(null, { status }) });
    expect((await GET(request(), params)).status).toBe(status); expect((await PUT(request(), params)).status).toBe(status);
    expect(m.unit).not.toHaveBeenCalled(); expect(m.read).not.toHaveBeenCalled(); expect(m.employeeSave).not.toHaveBeenCalled();
  });
  it('retains explicit admin category saves', async () => {
    m.guard.mockResolvedValue({ ok: true, isAdmin: true, actorIdentityId: 'admin' });
    expect((await PUT(request('category'), params)).status).toBe(200);
    expect(m.adminSave).toHaveBeenCalledWith(expect.anything(), { unitIds: ['unit-a', 'unit-b'], draft, actorIdentityId: 'admin', expectedRevision: 'a'.repeat(64), categoryId: 'category' });
    expect(m.employeeSave).not.toHaveBeenCalled();
  });
});

it('rejects an unversioned save before write', async () => {
 const req = new Request('http://localhost/tariff', { method: 'PUT', body: JSON.stringify({ draft, scope: 'unit' }) }) as NextRequest;
 expect((await PUT(req, params)).status).toBe(409); expect(m.employeeSave).not.toHaveBeenCalled(); expect(m.adminSave).not.toHaveBeenCalled();
});
