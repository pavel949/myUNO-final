import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  db,
  resetDb,
  createIdentity,
  createProject,
  createProvider,
} from '@/test/util';
import { seedConfig } from '@/modules/config';
import * as serviceService from '@/modules/services';

const mockGetCurrentUser = vi.fn();
vi.mock('@/app/actions/getCurrentUser', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

vi.mock('@/lib/prisma', async () => {
  const util = await import('@/test/util');
  return { prisma: util.db };
});

import { GET } from './route';

describe('GET /api/service-orders/[id]/detail — the rating affordance (S6)', () => {
  let orderer: Awaited<ReturnType<typeof createIdentity>>;
  let orderId: string;

  beforeEach(async () => {
    await resetDb();
    mockGetCurrentUser.mockReset();
    await seedConfig(db);

    orderer = await createIdentity();
    const admin = await createIdentity();
    const provider = await createProvider();
    const project = await createProject();

    await db.provider.update({
      where: { id: provider.id },
      data: { status: 'active', vetted_at: new Date(), vetted_by_identity_id: admin.id },
    });

    const service = await serviceService.createService(db, {
      providerId: provider.id,
      categoryKey: 'cleaning',
      title: 'Test Service',
      priceModel: 'fixed',
      basePriceThb: 2000,
    });
    await db.service.update({ where: { id: service.id }, data: { status: 'active' } });

    const order = await db.serviceOrder.create({
      data: {
        service_id: service.id,
        provider_id: provider.id,
        project_id: project.id,
        orderer_identity_id: orderer.id,
        orderer_role: 'owner',
        status: 'fulfilled',
        scheduled_start: new Date('2026-08-01'),
        scheduled_end: new Date('2026-08-02'),
        quantity: 1,
        price_breakdown: { base: 2000 },
        total_thb: 2000,
        take_rate_pct_snapshot: 15,
      },
    });
    orderId = order.id;
  });

  function detailReq() {
    return new NextRequest(`http://localhost/api/service-orders/${orderId}/detail`);
  }

  function asOrderer() {
    mockGetCurrentUser.mockResolvedValue({
      identityId: orderer.id,
      email: orderer.email,
      firstName: 'T',
      lastName: 'U',
      isAdmin: false,
      roles: [],
    });
  }

  it('reports the order as rated once it has been, so the surface stops offering a second review', async () => {
    asOrderer();

    const before = await (await GET(detailReq(), { params: { id: orderId } })).json();
    expect(before.rated).toBe(false);

    await serviceService.rateServiceOrder(db, orderId, orderer.id, 4);

    const after = await (await GET(detailReq(), { params: { id: orderId } })).json();
    expect(after.rated).toBe(true);

    // The route the surface would have called refuses a second review, which is
    // why `rated` has to gate the button rather than the user discovering it.
    await expect(
      serviceService.rateServiceOrder(db, orderId, orderer.id, 1)
    ).rejects.toThrow();
  });

  it("does not report another identity's rating as this viewer's", async () => {
    const other = await createIdentity();
    await db.review.create({
      data: {
        target_type: 'service_order',
        target_id: orderId,
        author_identity_id: other.id,
        rating: 5,
        status: 'published',
      },
    });

    asOrderer();
    const detail = await (await GET(detailReq(), { params: { id: orderId } })).json();
    expect(detail.rated).toBe(false);
  });
});
