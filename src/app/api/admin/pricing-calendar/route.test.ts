import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { db, resetDb, createIdentity, createProject, createUnit } from '@/test/util';
import { datedPricingRevision } from '@/modules/core/dated-pricing';
const current = vi.hoisted(() => ({ user: null as null | { identityId: string } }));
vi.mock('@/app/actions/getCurrentUser', () => ({ getCurrentUser: async () => current.user }));
import { GET, POST } from './route';
const req = (query: Record<string, string> = {}) =>
  new NextRequest('http://localhost/api/admin/pricing-calendar?' + new URLSearchParams(query));
describe('pricing calendar access and canonical projection', () => {
  beforeEach(async () => {
    await resetDb();
    current.user = null;
  });
  it('rejects unauthenticated and non-admin reads and writes', async () => {
    expect((await GET(req())).status).toBe(401);
    expect((await POST(req())).status).toBe(401);
    current.user = { identityId: (await createIdentity()).id };
    expect((await GET(req())).status).toBe(403);
    expect((await POST(req())).status).toBe(403);
  });
  it('does not widen an invalid scope and returns private canonical rates', async () => {
    current.user = { identityId: (await createIdentity({ isAdmin: true })).id };
    const project = await createProject({ status: 'live' });
    const unit = await createUnit({
      projectId: project.id,
      status: 'live',
      baseNightlyThb: 800000,
    });
    expect(
      (await GET(req({ unitId: unit.id, start: '2026-10-21', scope: 'platform' }))).status
    ).toBe(400);
    const response = await GET(req({ unitId: unit.id, start: '2026-10-21', scope: 'unit' }));
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    const data = await response.json();
    expect(data.units.map((row: { id: string }) => row.id)).toEqual([unit.id]);
    expect(data.rates[unit.id].lines).toHaveLength(14);
    expect(data.cells[unit.id]).toHaveLength(14);
    expect(data.revision).toBe(await datedPricingRevision(db, [unit.id]));
  });
  it('saves half-open dated prices and rejects a stale replay', async () => {
    current.user = { identityId: (await createIdentity({ isAdmin: true })).id };
    const project = await createProject({ status: 'live' });
    const unit = await createUnit({
      projectId: project.id,
      status: 'live',
      baseNightlyThb: 800000,
    });
    const payload = {
      unitId: unit.id,
      scope: 'unit',
      start: '2026-10-23',
      end: '2026-10-26',
      amountSatang: 850000,
      expectedRevision: await datedPricingRevision(db, [unit.id]),
    };
    const request = () =>
      new NextRequest('http://localhost/api/admin/pricing-calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    expect((await POST(request())).status).toBe(201);
    expect((await POST(request())).status).toBe(409);
    expect(await db.pricingRule.count()).toBe(1);
  });
});
