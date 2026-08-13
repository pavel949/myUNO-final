import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  db,
  resetDb,
  createIdentity,
  createProvider,
  createService,
} from '@/test/util';

const mockGetCurrentUser = vi.fn();
vi.mock('@/app/actions/getCurrentUser', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

vi.mock('@/lib/prisma', async () => {
  const util = await import('@/test/util');
  return { prisma: util.db };
});

import { GET } from './route';
import { PATCH } from './[id]/route';

function adminUser(identity: { id: string; email: string | null }) {
  return {
    identityId: identity.id,
    email: identity.email,
    firstName: 'Admin',
    lastName: 'User',
    isAdmin: true,
    roles: [],
  };
}

function get(url: string): NextRequest {
  return new NextRequest(url, { method: 'GET' });
}

function patch(url: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('GET /api/admin/services', () => {
  beforeEach(async () => {
    await resetDb();
    mockGetCurrentUser.mockReset();
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET(get('http://localhost/api/admin/services'));
    expect(res.status).toBe(401);
  });

  it('returns draft services to an admin', async () => {
    const admin = await createIdentity({ isAdmin: true });
    mockGetCurrentUser.mockResolvedValue(adminUser(admin));

    const provider = await createProvider({ status: 'active' });
    await createService({ providerId: provider.id, status: 'draft' });

    const res = await GET(
      get('http://localhost/api/admin/services?status=draft&limit=50')
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data).toHaveLength(1);
    expect(data[0].provider.name).toBe(provider.name);
  });

  it('paginates services with limit and offset', async () => {
    const admin = await createIdentity({ isAdmin: true });
    mockGetCurrentUser.mockResolvedValue(adminUser(admin));

    const provider = await createProvider({ status: 'active' });
    for (let i = 0; i < 5; i++) {
      await createService({ providerId: provider.id, status: 'draft' });
    }

    const res = await GET(
      get('http://localhost/api/admin/services?status=draft&limit=2&offset=0')
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.length).toBeLessThanOrEqual(2);
  });
});

describe('PATCH /api/admin/services/[id]', () => {
  beforeEach(async () => {
    await resetDb();
    mockGetCurrentUser.mockReset();
  });

  it('approves a draft service', async () => {
    const admin = await createIdentity({ isAdmin: true });
    mockGetCurrentUser.mockResolvedValue(adminUser(admin));

    const provider = await createProvider({ status: 'active' });
    const service = await createService({ providerId: provider.id, status: 'draft' });

    const res = await PATCH(
      patch(`http://localhost/api/admin/services/${service.id}`, { action: 'approve' }),
      { params: { id: service.id } }
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.message).toBe('Service approved');

    const updated = await db.service.findUnique({ where: { id: service.id } });
    expect(updated!.status).toBe('active');
  });

  it('rejects a draft service with a reason', async () => {
    const admin = await createIdentity({ isAdmin: true });
    mockGetCurrentUser.mockResolvedValue(adminUser(admin));

    const provider = await createProvider({ status: 'active' });
    const service = await createService({ providerId: provider.id, status: 'draft' });

    const res = await PATCH(
      patch(`http://localhost/api/admin/services/${service.id}`, {
        action: 'reject',
        reason: 'Insufficient detail',
      }),
      { params: { id: service.id } }
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.message).toBe('Service rejected');

    const updated = await db.service.findUnique({ where: { id: service.id } });
    expect(updated!.status).toBe('paused');
  });

  it('returns 400 for an invalid action', async () => {
    const admin = await createIdentity({ isAdmin: true });
    mockGetCurrentUser.mockResolvedValue(adminUser(admin));

    const provider = await createProvider({ status: 'active' });
    const service = await createService({ providerId: provider.id, status: 'draft' });

    const res = await PATCH(
      patch(`http://localhost/api/admin/services/${service.id}`, { action: 'invalid' }),
      { params: { id: service.id } }
    );
    expect(res.status).toBe(400);
  });
});
