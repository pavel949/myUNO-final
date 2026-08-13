import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  db,
  resetDb,
  createIdentity,
  createProject,
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

async function makeOrder(status: 'placed' | 'accepted' | 'fulfilled') {
  const project = await createProject({ status: 'live' });
  const provider = await createProvider({ status: 'active' });
  const service = await createService({ providerId: provider.id, status: 'active' });
  const orderer = await createIdentity();
  return db.serviceOrder.create({
    data: {
      service_id: service.id,
      provider_id: provider.id,
      project_id: project.id,
      orderer_identity_id: orderer.id,
      orderer_role: 'guest',
      status,
      scheduled_start: new Date('2026-08-01T10:00:00Z'),
      scheduled_end: new Date('2026-08-01T12:00:00Z'),
      quantity: 1,
      price_breakdown: { base: 1000 },
      total_thb: 1000,
      take_rate_pct_snapshot: 15,
    },
  });
}

describe('GET /api/admin/service-orders', () => {
  beforeEach(async () => {
    await resetDb();
    mockGetCurrentUser.mockReset();
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET(
      new NextRequest('http://localhost/api/admin/service-orders', { method: 'GET' })
    );
    expect(res.status).toBe(401);
  });

  it('returns service orders with service, provider, and orderer', async () => {
    const admin = await createIdentity({ isAdmin: true });
    mockGetCurrentUser.mockResolvedValue(adminUser(admin));
    await makeOrder('placed');

    const res = await GET(
      new NextRequest(
        'http://localhost/api/admin/service-orders?statuses=placed,paid,accepted&limit=100',
        { method: 'GET' }
      )
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data).toHaveLength(1);
    expect(data[0].service.title).toBeTruthy();
    expect(data[0].provider.name).toBeTruthy();
    expect(data[0].orderer.firstName).toBeTruthy();
  });

  it('filters by the statuses parameter', async () => {
    const admin = await createIdentity({ isAdmin: true });
    mockGetCurrentUser.mockResolvedValue(adminUser(admin));
    await makeOrder('placed');
    await makeOrder('fulfilled');

    const res = await GET(
      new NextRequest('http://localhost/api/admin/service-orders?statuses=placed', {
        method: 'GET',
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].status).toBe('placed');
  });

  it('paginates with limit and offset', async () => {
    const admin = await createIdentity({ isAdmin: true });
    mockGetCurrentUser.mockResolvedValue(adminUser(admin));
    await makeOrder('placed');
    await makeOrder('placed');
    await makeOrder('placed');

    const res = await GET(
      new NextRequest(
        'http://localhost/api/admin/service-orders?statuses=placed&limit=2&offset=0',
        { method: 'GET' }
      )
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.length).toBeLessThanOrEqual(2);
  });
});
