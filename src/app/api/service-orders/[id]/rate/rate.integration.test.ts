import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createMocks } from 'node-mocks-http';
import { POST } from './route';
import { db, resetDb, createIdentity, createProject, createProvider } from '@/test/util';
import { seedConfig, setGlobalConfig } from '@/modules/config';
import * as serviceService from '@/modules/services';

describe('POST /api/service-orders/[id]/rate — rate an order (S6)', () => {
  let orderer: Awaited<ReturnType<typeof createIdentity>>;
  let admin: Awaited<ReturnType<typeof createIdentity>>;
  let provider: Awaited<ReturnType<typeof createProvider>>;
  let project: Awaited<ReturnType<typeof createProject>>;
  let orderId: string;

  beforeEach(async () => {
    await resetDb();
    await seedConfig(db);

    orderer = await createIdentity();
    admin = await createIdentity();
    provider = await createProvider();
    project = await createProject();

    // Approve provider
    await db.provider.update({
      where: { id: provider.id },
      data: { status: 'active', vetted_at: new Date(), vetted_by_identity_id: admin.id },
    });

    await setGlobalConfig('services.require_admin_approval', false);

    // Create service
    const service = await serviceService.createService(db, {
      providerId: provider.id,
      categoryKey: 'cleaning',
      title: 'Test Service',
      priceModel: 'fixed',
      basePriceThb: 2000,
    });

    // Create order
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
        total_thb: 2000,
        take_rate_pct_snapshot: 15,
      },
    });

    orderId = orderResult.id;
  });

  afterEach(async () => {
    await resetDb();
  });

  it('creates a review for a service order (S6)', async () => {
    const { req, res } = createMocks(
      {
        method: 'POST',
        body: {
          rating: 5,
          comment: 'Excellent service!',
        },
      },
      {
        params: { id: orderId },
      }
    );

    // Mock getCurrentUser to return the orderer
    vi.mock('@/app/actions/getCurrentUser', () => ({
      getCurrentUser: vi.fn(async () => orderer),
    }));

    await POST(req as any, { params: { id: orderId } } as any);

    expect(res._getStatusCode()).toBe(200);
    const data = JSON.parse(res._getData());
    expect(data.ok).toBe(true);
    expect(data.reviewId).toBeDefined();

    // Verify review was created
    const review = await db.review.findUnique({
      where: { id: data.reviewId },
    });

    expect(review?.rating).toBe(5);
    expect(review?.comment).toBe('Excellent service!');
    expect(review?.target_type).toBe('service_order');
    expect(review?.target_id).toBe(orderId);
    expect(review?.author_identity_id).toBe(orderer.id);
  });

  it('rejects invalid ratings (S6)', async () => {
    const { req, res } = createMocks(
      {
        method: 'POST',
        body: {
          rating: 6, // Invalid
          comment: 'Too high',
        },
      },
      {
        params: { id: orderId },
      }
    );

    vi.mock('@/app/actions/getCurrentUser', () => ({
      getCurrentUser: vi.fn(async () => orderer),
    }));

    await POST(req as any, { params: { id: orderId } } as any);

    expect(res._getStatusCode()).toBe(400);
    const data = JSON.parse(res._getData());
    expect(data.error).toBeDefined();
  });
});
