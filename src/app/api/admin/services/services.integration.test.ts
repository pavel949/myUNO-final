import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  db,
  resetDb,
  createIdentity,
  createProvider,
  createService,
} from '@/test/util';
import { seedConfig } from '@/modules/config';

const mockGetCurrentUser = vi.fn();
vi.mock('@/app/actions/getCurrentUser', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

vi.mock('@/lib/prisma', async () => {
  const util = await import('@/test/util');
  return { prisma: util.db };
});

import { GET, POST } from './route';
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

function post(url: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
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

describe('POST /api/admin/services', () => {
  beforeEach(async () => {
    await resetDb();
    await seedConfig(db);
    mockGetCurrentUser.mockReset();
  });

  function validBody(providerId: string, overrides: Record<string, unknown> = {}) {
    return {
      providerId,
      categoryKey: 'cleaning',
      titleEn: 'Villa deep clean',
      titleRu: 'Генеральная уборка виллы',
      priceModel: 'fixed',
      basePriceThb: 150000,
      ...overrides,
    };
  }

  it('returns 401 when unauthenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await POST(post('http://localhost/api/admin/services', validBody('anything')));
    expect(res.status).toBe(401);
  });

  it('returns 403 for a non-admin', async () => {
    const nonAdmin = await createIdentity({ isAdmin: false });
    mockGetCurrentUser.mockResolvedValue({
      identityId: nonAdmin.id,
      email: nonAdmin.email,
      firstName: 'Not',
      lastName: 'Admin',
      isAdmin: false,
      roles: [],
    });

    const provider = await createProvider({ status: 'active' });
    const res = await POST(post('http://localhost/api/admin/services', validBody(provider.id)));
    expect(res.status).toBe(403);
  });

  it('creates a service live immediately, skipping the draft queue', async () => {
    const admin = await createIdentity({ isAdmin: true });
    mockGetCurrentUser.mockResolvedValue(adminUser(admin));
    const provider = await createProvider({ status: 'active' });

    const res = await POST(post('http://localhost/api/admin/services', validBody(provider.id)));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.status).toBe('active');

    const created = await db.service.findUnique({ where: { id: data.serviceId } });
    expect(created!.status).toBe('active');
    expect(created!.provider_id).toBe(provider.id);
    expect(created!.titleEn).toBe('Villa deep clean');
    expect(created!.titleRu).toBe('Генеральная уборка виллы');
    expect(created!.title).toBe('Villa deep clean');
    expect(created!.approved_by_identity_id).toBe(admin.id);
  });

  it('refuses a provider that is not active', async () => {
    const admin = await createIdentity({ isAdmin: true });
    mockGetCurrentUser.mockResolvedValue(adminUser(admin));
    const provider = await createProvider({ status: 'applied' });

    const res = await POST(post('http://localhost/api/admin/services', validBody(provider.id)));
    expect(res.status).toBe(400);
  });

  it('refuses an unknown provider', async () => {
    const admin = await createIdentity({ isAdmin: true });
    mockGetCurrentUser.mockResolvedValue(adminUser(admin));

    const res = await POST(
      post('http://localhost/api/admin/services', validBody('00000000-0000-0000-0000-000000000000'))
    );
    expect(res.status).toBe(404);
  });

  it('refuses an unknown category', async () => {
    const admin = await createIdentity({ isAdmin: true });
    mockGetCurrentUser.mockResolvedValue(adminUser(admin));
    const provider = await createProvider({ status: 'active' });

    const res = await POST(
      post(
        'http://localhost/api/admin/services',
        validBody(provider.id, { categoryKey: 'not-a-real-category' })
      )
    );
    expect(res.status).toBe(400);
  });

  it('requires both an English and a Russian title', async () => {
    const admin = await createIdentity({ isAdmin: true });
    mockGetCurrentUser.mockResolvedValue(adminUser(admin));
    const provider = await createProvider({ status: 'active' });

    const res = await POST(
      post('http://localhost/api/admin/services', validBody(provider.id, { titleRu: undefined }))
    );
    expect(res.status).toBe(400);
  });

  it('requires a positive price unless the price model is quote', async () => {
    const admin = await createIdentity({ isAdmin: true });
    mockGetCurrentUser.mockResolvedValue(adminUser(admin));
    const provider = await createProvider({ status: 'active' });

    const res = await POST(
      post(
        'http://localhost/api/admin/services',
        validBody(provider.id, { basePriceThb: undefined })
      )
    );
    expect(res.status).toBe(400);
  });

  it('allows a quote price model with no basePriceThb', async () => {
    const admin = await createIdentity({ isAdmin: true });
    mockGetCurrentUser.mockResolvedValue(adminUser(admin));
    const provider = await createProvider({ status: 'active' });

    const res = await POST(
      post(
        'http://localhost/api/admin/services',
        validBody(provider.id, { priceModel: 'quote', basePriceThb: undefined })
      )
    );
    expect(res.status).toBe(201);
  });
});
