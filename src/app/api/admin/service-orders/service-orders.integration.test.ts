import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/lib/prisma';
import { resetDb } from '@/test/util';
import { GET } from './route';

describe('GET /api/admin/service-orders', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('returns 200 with service orders', async () => {
    const provider = await prisma.identity.create({
      data: {
        firstName: 'Service',
        lastName: 'Provider',
        providerProfile: {
          create: {
            status: 'approved',
          },
        },
      },
    });

    const orderer = await prisma.identity.create({
      data: {
        firstName: 'Test',
        lastName: 'User',
      },
    });

    const service = await prisma.service.create({
      data: {
        providerId: provider.id,
        title: 'Test Service',
        description: 'A test service',
        status: 'vetted',
      },
    });

    await prisma.serviceOrder.create({
      data: {
        serviceId: service.id,
        providerId: provider.id,
        ordererId: orderer.id,
        status: 'placed',
        totalThb: 1000,
      },
    });

    const url = new URL('http://localhost:3000/api/admin/service-orders');
    url.searchParams.set('statuses', 'placed,paid,accepted');
    url.searchParams.set('limit', '100');

    const req = new Request(url, { method: 'GET' });
    const res = await GET(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it('filters by status', async () => {
    const provider = await prisma.identity.create({
      data: {
        firstName: 'Service',
        lastName: 'Provider',
        providerProfile: {
          create: {
            status: 'approved',
          },
        },
      },
    });

    const orderer = await prisma.identity.create({
      data: {
        firstName: 'Test',
        lastName: 'User',
      },
    });

    const service = await prisma.service.create({
      data: {
        providerId: provider.id,
        title: 'Test Service',
        description: 'A test service',
        status: 'vetted',
      },
    });

    // Create orders with different statuses
    await prisma.serviceOrder.create({
      data: {
        serviceId: service.id,
        providerId: provider.id,
        ordererId: orderer.id,
        status: 'placed',
        totalThb: 1000,
      },
    });

    await prisma.serviceOrder.create({
      data: {
        serviceId: service.id,
        providerId: provider.id,
        ordererId: orderer.id,
        status: 'failed',
        totalThb: 1000,
      },
    });

    const url = new URL('http://localhost:3000/api/admin/service-orders');
    url.searchParams.set('statuses', 'placed');

    const req = new Request(url, { method: 'GET' });
    const res = await GET(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.every((order: any) => order.status === 'placed')).toBe(true);
  });

  it('paginates results', async () => {
    const provider = await prisma.identity.create({
      data: {
        firstName: 'Service',
        lastName: 'Provider',
        providerProfile: {
          create: {
            status: 'approved',
          },
        },
      },
    });

    const orderer = await prisma.identity.create({
      data: {
        firstName: 'Test',
        lastName: 'User',
      },
    });

    const service = await prisma.service.create({
      data: {
        providerId: provider.id,
        title: 'Test Service',
        description: 'A test service',
        status: 'vetted',
      },
    });

    // Create multiple orders
    for (let i = 0; i < 5; i++) {
      await prisma.serviceOrder.create({
        data: {
          serviceId: service.id,
          providerId: provider.id,
          ordererId: orderer.id,
          status: 'placed',
          totalThb: 1000 + i * 100,
        },
      });
    }

    const url = new URL('http://localhost:3000/api/admin/service-orders');
    url.searchParams.set('limit', '2');
    url.searchParams.set('offset', '0');

    const req = new Request(url, { method: 'GET' });
    const res = await GET(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.length).toBeLessThanOrEqual(2);
  });

  it('includes related entity details', async () => {
    const provider = await prisma.identity.create({
      data: {
        firstName: 'Service',
        lastName: 'Provider',
        providerProfile: {
          create: {
            status: 'approved',
          },
        },
      },
    });

    const orderer = await prisma.identity.create({
      data: {
        firstName: 'Test',
        lastName: 'Orderer',
      },
    });

    const service = await prisma.service.create({
      data: {
        providerId: provider.id,
        title: 'Test Service',
        description: 'A test service',
        status: 'vetted',
      },
    });

    await prisma.serviceOrder.create({
      data: {
        serviceId: service.id,
        providerId: provider.id,
        ordererId: orderer.id,
        status: 'placed',
        totalThb: 1000,
      },
    });

    const url = new URL('http://localhost:3000/api/admin/service-orders');

    const req = new Request(url, { method: 'GET' });
    const res = await GET(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.length).toBeGreaterThan(0);

    const order = data[0];
    expect(order.service).toBeDefined();
    expect(order.provider).toBeDefined();
    expect(order.orderer).toBeDefined();
    expect(order.service.title).toBe('Test Service');
  });
});
