import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  db,
  resetDb,
  createProject,
  createProvider,
  createService,
} from '@/test/util';

vi.mock('@/lib/prisma', async () => {
  const util = await import('@/test/util');
  return { prisma: util.db };
});

vi.mock('@/app/actions/getCurrentUser', () => ({
  getCurrentUser: vi.fn(async () => null),
}));

import { GET } from './route';

function makeRequest(url: string) {
  return new NextRequest(url, { method: 'GET' });
}

describe('GET /api/services', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('returns only active services from active vetted providers', async () => {
    const vetted = await createProvider({ status: 'active' });
    await db.provider.update({
      where: { id: vetted.id },
      data: { vetted_at: new Date() },
    });
    const unvetted = await createProvider({ status: 'active' });

    const visible = await createService({
      providerId: vetted.id,
      status: 'active',
      title: 'Visible service',
    });
    await createService({
      providerId: vetted.id,
      status: 'draft',
      title: 'Draft service',
    });
    await createService({
      providerId: unvetted.id,
      status: 'active',
      title: 'Unvetted service',
    });

    const response = await GET(makeRequest('http://localhost/api/services'));
    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.services).toHaveLength(1);
    expect(body.services[0].id).toBe(visible.id);
    expect(body.services[0].providerVetted).toBe(true);
  });

  it('respects optional projectId scope for restricted services', async () => {
    const p1 = await createProject({ status: 'live' });
    const p2 = await createProject({ status: 'live' });
    const provider = await createProvider({ status: 'active' });
    await db.provider.update({
      where: { id: provider.id },
      data: { vetted_at: new Date() },
    });

    const global = await createService({
      providerId: provider.id,
      status: 'active',
      title: 'Global service',
    });

    const scoped = await createService({
      providerId: provider.id,
      status: 'active',
      title: 'P2-only service',
    });
    await db.serviceProject.create({
      data: {
        service_id: scoped.id,
        project_id: p2.id,
      },
    });

    const forP1 = await GET(
      makeRequest(`http://localhost/api/services?projectId=${encodeURIComponent(p1.id)}`)
    );
    const p1Body = await forP1.json();
    expect(forP1.status).toBe(200);
    expect(p1Body.services.map((s: { id: string }) => s.id)).toEqual([global.id]);

    const forP2 = await GET(
      makeRequest(`http://localhost/api/services?projectId=${encodeURIComponent(p2.id)}`)
    );
    const p2Body = await forP2.json();
    expect(forP2.status).toBe(200);
    expect(p2Body.services.map((s: { id: string }) => s.id).sort()).toEqual(
      [global.id, scoped.id].sort()
    );
  });
});
