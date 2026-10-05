import { describe, it, expect, beforeEach } from 'vitest';
import {
  db,
  resetDb,
  createIdentity,
  createProject,
  createProvider,
} from '@/test/util';
import { seedConfig } from '@/modules/config';
import * as serviceService from '@/modules/services';
import { getServiceOrderCustomerView } from './service-order-customer-view';

/**
 * The orderer's view of a service order, shared by the order page. These
 * tests moved here from the retired /api/service-orders/[id]/detail route:
 * the page reads the module directly (a server-side relative fetch of its own
 * API could not resolve and left the page permanently 404).
 */
describe('getServiceOrderCustomerView — the rating affordance (S6) and scoping', () => {
  let orderer: Awaited<ReturnType<typeof createIdentity>>;
  let orderId: string;

  beforeEach(async () => {
    await resetDb();
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

  async function view(identityId = orderer.id) {
    const result = await getServiceOrderCustomerView(db, orderId, identityId);
    if (result.kind !== 'ok') throw new Error('expected the order view, got ' + result.kind);
    return result.order;
  }

  it('reports the order as rated once it has been, so the surface stops offering a second review', async () => {
    const before = await view();
    expect(before.rated).toBe(false);

    await serviceService.rateServiceOrder(db, orderId, orderer.id, 4);

    const after = await view();
    expect(after.rated).toBe(true);

    // The rating route refuses a second review, which is
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

    const detail = await view();
    expect(detail.rated).toBe(false);
  });

  it("refuses another identity's order and reports a missing one as not found", async () => {
    const other = await createIdentity();
    expect((await getServiceOrderCustomerView(db, orderId, other.id)).kind).toBe('forbidden');
    expect((await getServiceOrderCustomerView(db, 'missing-order', orderer.id)).kind).toBe('not_found');
  });
});
