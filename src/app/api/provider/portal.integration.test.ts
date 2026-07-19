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
import { seedConfig } from '@/modules/config';

const mockGetCurrentUser = vi.fn();
vi.mock('@/app/actions/getCurrentUser', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

vi.mock('@/lib/prisma', async () => {
  const util = await import('@/test/util');
  return { prisma: util.db };
});

import { POST as apply } from '@/app/api/providers/apply/route';
import { GET as me } from './me/route';
import { GET as listOrders } from './orders/route';
import { GET as listServices, POST as postService } from './services/route';
import { PATCH as patchService } from './services/[id]/route';

function post(body?: unknown): NextRequest {
  return new NextRequest('http://localhost/api/provider/x', {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
    headers: { 'Content-Type': 'application/json' },
  });
}

function patch(body?: unknown): NextRequest {
  return new NextRequest('http://localhost/api/provider/x', {
    method: 'PATCH',
    body: JSON.stringify(body ?? {}),
    headers: { 'Content-Type': 'application/json' },
  });
}

function userOf(
  identity: { id: string; email: string | null },
  opts?: { providerId?: string }
) {
  return {
    identityId: identity.id,
    email: identity.email,
    firstName: 'T',
    lastName: 'U',
    isAdmin: false,
    roles: opts?.providerId
      ? [
          {
            role: 'provider_member',
            projectId: null,
            unitId: null,
            organizationId: null,
            providerId: opts.providerId,
          },
        ]
      : [],
  };
}

const APPLICATION = {
  name: 'Blue Cleaners',
  description: 'Villa cleaning crews',
  contactEmail: 'crew@example.com',
  contactPhone: '+66 81 000 0000',
  categoryKeys: ['cleaning'],
};

describe('provider portal routes (S2)', () => {
  let applicant: Awaited<ReturnType<typeof createIdentity>>;
  let member: Awaited<ReturnType<typeof createIdentity>>;

  beforeEach(async () => {
    await resetDb();
    await seedConfig(db);
    applicant = await createIdentity({ firstName: 'Applicant' });
    member = await createIdentity({ firstName: 'Member' });
  });

  describe('POST /api/providers/apply', () => {
    it('requires auth', async () => {
      mockGetCurrentUser.mockResolvedValue(null);
      expect((await apply(post(APPLICATION))).status).toBe(401);
    });

    it('creates an application linked to the applicant', async () => {
      mockGetCurrentUser.mockResolvedValue(userOf(applicant));
      const res = await apply(post(APPLICATION));
      expect(res.status).toBe(201);
      const { providerId } = await res.json();

      const provider = await db.provider.findUnique({ where: { id: providerId } });
      expect(provider?.status).toBe('applied');
      expect(provider?.applicant_identity_id).toBe(applicant.id);
      expect(provider?.categoryKeys).toEqual(['cleaning']);
    });

    it('rejects unknown categories', async () => {
      mockGetCurrentUser.mockResolvedValue(userOf(applicant));
      const res = await apply(post({ ...APPLICATION, categoryKeys: ['time_travel'] }));
      expect(res.status).toBe(400);
    });

    it('rejects missing fields', async () => {
      mockGetCurrentUser.mockResolvedValue(userOf(applicant));
      const res = await apply(post({ ...APPLICATION, name: '' }));
      expect(res.status).toBe(400);
    });

    it('rejects a second live application (409)', async () => {
      mockGetCurrentUser.mockResolvedValue(userOf(applicant));
      expect((await apply(post(APPLICATION))).status).toBe(201);
      expect((await apply(post(APPLICATION))).status).toBe(409);
    });
  });

  describe('GET /api/provider/me', () => {
    it('shows the applicant their vetting status', async () => {
      mockGetCurrentUser.mockResolvedValue(userOf(applicant));
      await apply(post(APPLICATION));

      const res = await me();
      expect(res.status).toBe(200);
      const { provider } = await res.json();
      expect(provider.status).toBe('applied');
      expect(provider.isMember).toBe(false);
    });

    it('404 when the identity has no provider at all', async () => {
      mockGetCurrentUser.mockResolvedValue(userOf(applicant));
      expect((await me()).status).toBe(404);
    });
  });

  describe('GET /api/provider/orders', () => {
    it('403 for a non-member', async () => {
      mockGetCurrentUser.mockResolvedValue(userOf(applicant));
      expect((await listOrders()).status).toBe(403);
    });

    it('lists only the member provider orders, with an accept deadline', async () => {
      const project = await createProject({ status: 'live' });
      const provider = await createProvider({ status: 'active' });
      const otherProvider = await createProvider({ status: 'active' });
      const service = await createService({
        providerId: provider.id,
        status: 'active',
        basePriceThb: 50000,
      });
      const otherService = await createService({
        providerId: otherProvider.id,
        status: 'active',
        basePriceThb: 60000,
      });

      const start = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      const orderData = (serviceRow: { id: string }, providerId: string) => ({
        service_id: serviceRow.id,
        provider_id: providerId,
        project_id: project.id,
        orderer_identity_id: applicant.id,
        orderer_role: 'guest' as const,
        scheduled_start: start,
        scheduled_end: new Date(start.getTime() + 2 * 60 * 60 * 1000),
        quantity: 1,
        price_breakdown: {},
        total_thb: 50000,
        take_rate_pct_snapshot: 15,
        status: 'placed' as const,
      });
      await db.serviceOrder.create({ data: orderData(service, provider.id) });
      await db.serviceOrder.create({
        data: orderData(otherService, otherProvider.id),
      });

      mockGetCurrentUser.mockResolvedValue(userOf(member, { providerId: provider.id }));
      const res = await listOrders();
      expect(res.status).toBe(200);
      const raw = await res.text();
      expect(raw).not.toContain('take_rate');
      const { orders } = JSON.parse(raw);
      expect(orders).toHaveLength(1);
      expect(orders[0].status).toBe('placed');
      expect(orders[0].acceptDeadline).toBeTruthy();
    });
  });

  describe('provider services CRUD', () => {
    let providerId: string;

    beforeEach(async () => {
      const provider = await createProvider({ status: 'active' });
      providerId = provider.id;
      mockGetCurrentUser.mockResolvedValue(userOf(member, { providerId }));
    });

    it('creates a draft (admin approval on by default) and lists it', async () => {
      const res = await postService(
        post({
          title: 'Deep clean',
          categoryKey: 'cleaning',
          priceModel: 'fixed',
          basePriceThb: 250000,
        })
      );
      expect(res.status).toBe(201);
      const { serviceId } = await res.json();

      const service = await db.service.findUnique({ where: { id: serviceId } });
      expect(service?.status).toBe('draft');
      expect(service?.provider_id).toBe(providerId);

      const list = await listServices();
      const { services } = await list.json();
      expect(services).toHaveLength(1);
      expect(services[0].id).toBe(serviceId);
    });

    it('requires a price unless the model is quote', async () => {
      const noPrice = await postService(
        post({ title: 'X', categoryKey: 'cleaning', priceModel: 'fixed' })
      );
      expect(noPrice.status).toBe(400);

      const quote = await postService(
        post({ title: 'Custom charter', categoryKey: 'yacht', priceModel: 'quote' })
      );
      expect(quote.status).toBe(201);
    });

    it('edits an own draft; foreign services read as 404', async () => {
      const created = await postService(
        post({
          title: 'Deep clean',
          categoryKey: 'cleaning',
          priceModel: 'fixed',
          basePriceThb: 250000,
        })
      );
      const { serviceId } = await created.json();

      const ok = await patchService(patch({ basePriceThb: 300000 }), {
        params: { id: serviceId },
      });
      expect(ok.status).toBe(200);
      const service = await db.service.findUnique({ where: { id: serviceId } });
      expect(service?.basePriceThb).toBe(300000);

      const otherProvider = await createProvider({ status: 'active' });
      const foreign = await createService({
        providerId: otherProvider.id,
        status: 'draft',
        basePriceThb: 10000,
      });
      const denied = await patchService(patch({ basePriceThb: 1 }), {
        params: { id: foreign.id },
      });
      expect(denied.status).toBe(404);
    });

    it('rejects editing a non-draft service (400)', async () => {
      const active = await createService({
        providerId,
        status: 'active',
        basePriceThb: 10000,
      });
      const res = await patchService(patch({ basePriceThb: 20000 }), {
        params: { id: active.id },
      });
      expect(res.status).toBe(400);
    });
  });
});
