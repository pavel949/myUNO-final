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

import { POST } from './route';

function ratePost(orderId: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/service-orders/${orderId}/rate`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/service-orders/[id]/rate — rate an order (S6)', () => {
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

    // Approve provider
    await db.provider.update({
      where: { id: provider.id },
      data: { status: 'active', vetted_at: new Date(), vetted_by_identity_id: admin.id },
    });

    // Create service (created as draft, then activated for the order)
    const service = await serviceService.createService(db, {
      providerId: provider.id,
      categoryKey: 'cleaning',
      title: 'Test Service',
      priceModel: 'fixed',
      basePriceThb: 2000,
    });
    await db.service.update({ where: { id: service.id }, data: { status: 'active' } });

    // Create fulfilled order
    const orderResult = await db.serviceOrder.create({
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

    orderId = orderResult.id;
  });

  it('creates a review for a fulfilled service order (S6)', async () => {
    mockGetCurrentUser.mockResolvedValue({
      identityId: orderer.id,
      email: orderer.email,
      firstName: 'T',
      lastName: 'U',
      isAdmin: false,
      roles: [],
    });

    const res = await POST(ratePost(orderId, { rating: 5, comment: 'Excellent service!' }), {
      params: { id: orderId },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.reviewId).toBeDefined();

    const review = await db.review.findUnique({ where: { id: data.reviewId } });
    expect(review?.rating).toBe(5);
    expect(review?.comment).toBe('Excellent service!');
    expect(review?.target_type).toBe('service_order');
    expect(review?.target_id).toBe(orderId);
    expect(review?.author_identity_id).toBe(orderer.id);
  });

  it('rejects invalid ratings (S6)', async () => {
    mockGetCurrentUser.mockResolvedValue({
      identityId: orderer.id,
      email: orderer.email,
      firstName: 'T',
      lastName: 'U',
      isAdmin: false,
      roles: [],
    });

    const res = await POST(ratePost(orderId, { rating: 6, comment: 'Too high' }), {
      params: { id: orderId },
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const res = await POST(ratePost(orderId, { rating: 5 }), {
      params: { id: orderId },
    });

    expect(res.status).toBe(401);
  });
});
