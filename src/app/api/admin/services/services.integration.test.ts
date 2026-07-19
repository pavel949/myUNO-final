import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/lib/prisma';
import { resetDb } from '@/test/util';
import { GET, PATCH } from './[id]/route';

describe('GET /api/admin/services', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('returns 200 when fetching draft services', async () => {
    const provider = await prisma.identity.create({
      data: {
        firstName: 'Test',
        lastName: 'Provider',
        providerProfile: {
          create: {
            status: 'approved',
          },
        },
      },
    });

    await prisma.service.create({
      data: {
        providerId: provider.id,
        title: 'Cleaning Service',
        description: 'Professional cleaning',
        status: 'draft',
      },
    });

    const url = new URL('http://localhost:3000/api/admin/services');
    url.searchParams.set('status', 'draft');
    url.searchParams.set('limit', '50');

    const req = new Request(url, { method: 'GET' });
    const res = await GET(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it('paginates services with limit and offset', async () => {
    const provider = await prisma.identity.create({
      data: {
        firstName: 'Test',
        lastName: 'Provider',
        providerProfile: {
          create: {
            status: 'approved',
          },
        },
      },
    });

    for (let i = 0; i < 5; i++) {
      await prisma.service.create({
        data: {
          providerId: provider.id,
          title: `Service ${i}`,
          description: 'Test',
          status: 'draft',
        },
      });
    }

    const url = new URL('http://localhost:3000/api/admin/services');
    url.searchParams.set('limit', '2');
    url.searchParams.set('offset', '0');

    const req = new Request(url, { method: 'GET' });
    const res = await GET(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.length).toBeLessThanOrEqual(2);
  });
});

describe('PATCH /api/admin/services/[id]', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('approves a service submission', async () => {
    const provider = await prisma.identity.create({
      data: {
        firstName: 'Test',
        lastName: 'Provider',
        providerProfile: {
          create: {
            status: 'approved',
          },
        },
      },
    });

    const service = await prisma.service.create({
      data: {
        providerId: provider.id,
        title: 'Cleaning Service',
        description: 'Professional cleaning',
        status: 'draft',
      },
    });

    const req = new Request('http://localhost:3000/api/admin/services/' + service.id, {
      method: 'PATCH',
      body: JSON.stringify({ action: 'approve' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await PATCH(req, { params: { id: service.id } });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.message).toBe('Service approved');
  });

  it('rejects a service with reason', async () => {
    const provider = await prisma.identity.create({
      data: {
        firstName: 'Test',
        lastName: 'Provider',
        providerProfile: {
          create: {
            status: 'approved',
          },
        },
      },
    });

    const service = await prisma.service.create({
      data: {
        providerId: provider.id,
        title: 'Cleaning Service',
        description: 'Professional cleaning',
        status: 'draft',
      },
    });

    const req = new Request('http://localhost:3000/api/admin/services/' + service.id, {
      method: 'PATCH',
      body: JSON.stringify({ action: 'reject', reason: 'Insufficient detail' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await PATCH(req, { params: { id: service.id } });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.message).toBe('Service rejected');
  });

  it('returns 400 for invalid action', async () => {
    const provider = await prisma.identity.create({
      data: {
        firstName: 'Test',
        lastName: 'Provider',
        providerProfile: {
          create: {
            status: 'approved',
          },
        },
      },
    });

    const service = await prisma.service.create({
      data: {
        providerId: provider.id,
        title: 'Cleaning Service',
        description: 'Professional cleaning',
        status: 'draft',
      },
    });

    const req = new Request('http://localhost:3000/api/admin/services/' + service.id, {
      method: 'PATCH',
      body: JSON.stringify({ action: 'invalid' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await PATCH(req, { params: { id: service.id } });
    expect(res.status).toBe(400);
  });
});
