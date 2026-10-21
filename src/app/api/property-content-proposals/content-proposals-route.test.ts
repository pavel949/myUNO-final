import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { harness } from '@/modules/onboarding/content-proposal.service.test-support';

const session = vi.hoisted(() => ({ identityId: 'author' }));
const state = vi.hoisted(() => ({ db: null as any }));
vi.mock('@/app/actions/getCurrentUser', () => ({ getCurrentUser: async () => session.identityId ? { identityId: session.identityId, isAdmin: false } : null }));
vi.mock('@/lib/prisma', () => ({ prisma: new Proxy({}, { get: (_object, key) => state.db[key] }) }));
// Exercise the real service without importing unrelated onboarding domains.
vi.mock('@/modules/onboarding', async () => import('@/modules/onboarding/content-proposal.service'));
import { GET as list, POST as create } from './route';
import { GET as target } from './target/route';
import { GET as get, PATCH as patch } from './[id]/route';
import { POST as review } from '@/app/api/admin/property-content-proposals/[id]/review/route';
const req = (method: string, body?: unknown, url = 'http://localhost/api/property-content-proposals') => new NextRequest(url, {
  method, ...(body === undefined ? {} : { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }),
});

describe('content proposal endpoints with the real service', () => {
  let h: ReturnType<typeof harness>;
  beforeEach(() => { h = harness(); state.db = h.db; session.identityId = 'author'; });
  const current = () => target(req('GET', undefined, 'http://localhost/api/property-content-proposals/target?scope=unit&id=managed-legendary-d201'));
  const submit = async () => {
    const data = await (await current()).json();
    return create(req('POST', { scope: 'unit', targetId: data.target.id, baselineVersion: data.baselineVersion, proposal: h.payload(), status: 'submitted' }));
  };
  it('requires authentication on every route', async () => {
    session.identityId = '';
    const params = { params: { id: 'missing' } };
    const responses = await Promise.all([list(), current(), create(req('POST', {})), get(req('GET'), params), patch(req('PATCH', {}), params), review(req('POST', {}), params)]);
    expect(responses.map(r => r.status)).toEqual([401, 401, 401, 401, 401, 401]);
  });
  it('supports contributor discovery, creation, admin detail, and review with safe DTOs', async () => {
    const targets = await list(); expect(targets.headers.get('Cache-Control')).toBe('private, no-store');
    expect((await targets.json()).targets).toHaveLength(1);
    const response = await submit(); expect(response.status).toBe(201);
    const created = await response.json();
    expect((await get(req('GET'), { params: { id: created.id } })).status).toBe(200);
    session.identityId = 'admin';
    const approved = await review(req('POST', { action: 'approve', expectedRevision: 1 }), { params: { id: created.id } });
    expect(approved.status).toBe(200); expect((await approved.json()).status).toBe('approved');
  });
  it('denies stale session admin flags by checking the database', async () => {
    const created = await (await submit()).json();
    const response = await review(req('POST', { action: 'approve', expectedRevision: 1 }), { params: { id: created.id } });
    expect(response.status).toBe(403); expect(h.db.unit.update).not.toHaveBeenCalled();
  });
  it('returns 400 for malformed JSON and extra root fields', async () => {
    const response = await create(new NextRequest('http://localhost/api/property-content-proposals', { method: 'POST', body: '{' }));
    expect(response.status).toBe(400);
    const created = await h.create('draft');
    const patchResponse = await patch(req('PATCH', { expectedRevision: 1, action: 'rebase', targetId: 'foreign' }), { params: { id: created.id } });
    expect(patchResponse.status).toBe(400);
  });
  it('returns 404 for foreign-author detail and 403 for an unassigned target', async () => {
    const created = await (await submit()).json(); session.identityId = 'other';
    expect((await get(req('GET'), { params: { id: created.id } })).status).toBe(404);
    expect((await current()).status).toBe(403);
  });
  it('returns 409 for stale approval and does not leak raw database exceptions', async () => {
    const created = await (await submit()).json(); session.identityId = 'admin'; h.state().units[0].bedrooms = 9;
    expect((await review(req('POST', { action: 'approve', expectedRevision: 1 }), { params: { id: created.id } })).status).toBe(409);
    h.db.identity.findUnique.mockRejectedValueOnce(new Error('SQL secret credential'));
    const response = await list(); expect(response.status).toBe(500); expect(await response.text()).not.toContain('secret');
  });
});
