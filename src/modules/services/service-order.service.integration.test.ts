import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db, resetDb, createIdentity, createProject, createProvider, createService } from '@/test/util';
import * as serviceOrderService from './service-order.service';

describe('service-order.service — integration tests', () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterEach(async () => {
    await resetDb();
  });

  describe('createServiceOrder', () => {
    it('creates a new service order in placed status', async () => {
      const orderer = await createIdentity();
      const provider = await createProvider();
      const project = await createProject();

      // Approve provider first
      const admin = await createIdentity();
      await db.provider.update({
        where: { id: provider.id },
        data: { status: 'active', vetted_at: new Date(), vetted_by_identity_id: admin.id },
      });

      // Create active service
      const service = await createService({
        providerId: provider.id,
        categoryKey: 'cleaning',
        status: 'active',
      });

      const scheduledStart = new Date('2026-08-01');
      const scheduledEnd = new Date('2026-08-02');

      const result = await serviceOrderService.createServiceOrder(db, {
        serviceId: service.id,
        projectId: project.id,
        ordererIdentityId: orderer.id,
        ordererRole: 'owner',
        scheduledStart,
        scheduledEnd,
        quantity: 2,
        priceBreakdown: { base: 2000, commission: 300 },
        totalThb: 2300,
        tookRatePctSnapshot: 15,
        noteToProvider: 'Please bring supplies',
      });

      expect(result.id).toBeDefined();

      const order = await db.serviceOrder.findUnique({
        where: { id: result.id },
      });

      expect(order?.status).toBe('placed');
      expect(order?.service_id).toBe(service.id);
      expect(order?.orderer_identity_id).toBe(orderer.id);
      expect(order?.quantity).toBe(2);
      expect(order?.total_thb).toBe(2300);
      expect(order?.note_to_provider).toBe('Please bring supplies');
    });

    it('rejects order for inactive service', async () => {
      const orderer = await createIdentity();
      const provider = await createProvider();
      const project = await createProject();

      const service = await createService({
        providerId: provider.id,
        categoryKey: 'cleaning',
        status: 'draft',
      });

      await expect(
        serviceOrderService.createServiceOrder(db, {
          serviceId: service.id,
          projectId: project.id,
          ordererIdentityId: orderer.id,
          ordererRole: 'owner',
          scheduledStart: new Date('2026-08-01'),
          scheduledEnd: new Date('2026-08-02'),
          quantity: 1,
          priceBreakdown: {},
          totalThb: 1000,
          tookRatePctSnapshot: 15,
        })
      ).rejects.toThrow('Service is not available for ordering');
    });

    it('rejects order for unvetted provider', async () => {
      const orderer = await createIdentity();
      const provider = await createProvider();
      const project = await createProject();

      // Don't approve provider
      const service = await createService({
        providerId: provider.id,
        categoryKey: 'cleaning',
        status: 'active',
      });

      await expect(
        serviceOrderService.createServiceOrder(db, {
          serviceId: service.id,
          projectId: project.id,
          ordererIdentityId: orderer.id,
          ordererRole: 'owner',
          scheduledStart: new Date('2026-08-01'),
          scheduledEnd: new Date('2026-08-02'),
          quantity: 1,
          priceBreakdown: {},
          totalThb: 1000,
          tookRatePctSnapshot: 15,
        })
      ).rejects.toThrow('Provider is not vetted');
    });
  });

  describe('acceptServiceOrder', () => {
    it('transitions placed order to accepted', async () => {
      const orderer = await createIdentity();
      const admin = await createIdentity();
      const provider = await createProvider();
      const project = await createProject();

      // Approve provider
      await db.provider.update({
        where: { id: provider.id },
        data: { status: 'active', vetted_at: new Date(), vetted_by_identity_id: admin.id },
      });

      const service = await createService({
        providerId: provider.id,
        categoryKey: 'cleaning',
        status: 'active',
      });

      const orderResult = await serviceOrderService.createServiceOrder(db, {
        serviceId: service.id,
        projectId: project.id,
        ordererIdentityId: orderer.id,
        ordererRole: 'owner',
        scheduledStart: new Date('2026-08-01'),
        scheduledEnd: new Date('2026-08-02'),
        quantity: 1,
        priceBreakdown: {},
        totalThb: 1000,
        tookRatePctSnapshot: 15,
      });

      // Get provider identity to accept order
      const providerIdentity = await db.roleAssignment.findFirst({
        where: { providerId: provider.id, role: 'provider_member', status: 'active' },
        select: { identityId: true },
      });

      if (!providerIdentity) {
        throw new Error('No provider member role found');
      }

      await serviceOrderService.acceptServiceOrder(db, orderResult.id, provider.id);

      const order = await db.serviceOrder.findUnique({
        where: { id: orderResult.id },
      });

      expect(order?.status).toBe('accepted');
    });

    it('prevents non-provider from accepting order', async () => {
      const orderer = await createIdentity();
      const otherProvider = await createIdentity();
      const admin = await createIdentity();
      const provider = await createProvider();
      const project = await createProject();

      // Approve provider
      await db.provider.update({
        where: { id: provider.id },
        data: { status: 'active', vetted_at: new Date(), vetted_by_identity_id: admin.id },
      });

      const service = await createService({
        providerId: provider.id,
        categoryKey: 'cleaning',
        status: 'active',
      });

      const orderResult = await serviceOrderService.createServiceOrder(db, {
        serviceId: service.id,
        projectId: project.id,
        ordererIdentityId: orderer.id,
        ordererRole: 'owner',
        scheduledStart: new Date('2026-08-01'),
        scheduledEnd: new Date('2026-08-02'),
        quantity: 1,
        priceBreakdown: {},
        totalThb: 1000,
        tookRatePctSnapshot: 15,
      });

      await expect(
        serviceOrderService.acceptServiceOrder(db, orderResult.id, otherProvider.id)
      ).rejects.toThrow('Only the service provider can accept an order');
    });
  });

  describe('declineServiceOrder', () => {
    it('declines placed order and notifies orderer', async () => {
      const orderer = await createIdentity();
      const admin = await createIdentity();
      const provider = await createProvider();
      const project = await createProject();

      // Approve provider
      await db.provider.update({
        where: { id: provider.id },
        data: { status: 'active', vetted_at: new Date(), vetted_by_identity_id: admin.id },
      });

      const service = await createService({
        providerId: provider.id,
        categoryKey: 'cleaning',
        status: 'active',
      });

      const orderResult = await serviceOrderService.createServiceOrder(db, {
        serviceId: service.id,
        projectId: project.id,
        ordererIdentityId: orderer.id,
        ordererRole: 'owner',
        scheduledStart: new Date('2026-08-01'),
        scheduledEnd: new Date('2026-08-02'),
        quantity: 1,
        priceBreakdown: {},
        totalThb: 1000,
        tookRatePctSnapshot: 15,
      });

      await serviceOrderService.declineServiceOrder(db, orderResult.id, provider.id);

      const order = await db.serviceOrder.findUnique({
        where: { id: orderResult.id },
      });

      expect(order?.status).toBe('declined');
    });

    it('refunds paid order on decline', async () => {
      const orderer = await createIdentity();
      const admin = await createIdentity();
      const provider = await createProvider();
      const project = await createProject();

      // Approve provider
      await db.provider.update({
        where: { id: provider.id },
        data: { status: 'active', vetted_at: new Date(), vetted_by_identity_id: admin.id },
      });

      const service = await createService({
        providerId: provider.id,
        categoryKey: 'cleaning',
        status: 'active',
      });

      const orderResult = await serviceOrderService.createServiceOrder(db, {
        serviceId: service.id,
        projectId: project.id,
        ordererIdentityId: orderer.id,
        ordererRole: 'owner',
        scheduledStart: new Date('2026-08-01'),
        scheduledEnd: new Date('2026-08-02'),
        quantity: 1,
        priceBreakdown: {},
        totalThb: 1000,
        tookRatePctSnapshot: 15,
      });

      // Record cash payment
      await db.payment.create({
        data: {
          purpose: 'service_order',
          serviceOrderId: orderResult.id,
          payerIdentityId: orderer.id,
          method: 'cash',
          provider: 'cash',
          amountThb: 1000,
          receivedByIdentityId: admin.id,
          receivedAt: new Date(),
          receiptRef: 'REC-001',
          status: 'succeeded',
          succeededAt: new Date(),
        },
      });

      await serviceOrderService.declineServiceOrder(db, orderResult.id, provider.id);

      const refunds = await db.refund.findMany({
        where: { paymentId: { in: (await db.payment.findMany({
          where: { serviceOrderId: orderResult.id },
          select: { id: true },
        })).map(p => p.id) },
        },
      });

      expect(refunds.length).toBeGreaterThan(0);
      expect(refunds[0]?.amountThb).toBe(1000);
    });
  });

  describe('fulfillServiceOrder', () => {
    it('transitions accepted order to fulfilled', async () => {
      const orderer = await createIdentity();
      const admin = await createIdentity();
      const provider = await createProvider();
      const project = await createProject();

      // Approve provider
      await db.provider.update({
        where: { id: provider.id },
        data: { status: 'active', vetted_at: new Date(), vetted_by_identity_id: admin.id },
      });

      const service = await createService({
        providerId: provider.id,
        categoryKey: 'cleaning',
        status: 'active',
      });

      const orderResult = await serviceOrderService.createServiceOrder(db, {
        serviceId: service.id,
        projectId: project.id,
        ordererIdentityId: orderer.id,
        ordererRole: 'owner',
        scheduledStart: new Date('2026-08-01'),
        scheduledEnd: new Date('2026-08-02'),
        quantity: 1,
        priceBreakdown: {},
        totalThb: 1000,
        tookRatePctSnapshot: 15,
      });

      await serviceOrderService.acceptServiceOrder(db, orderResult.id, provider.id);
      await serviceOrderService.fulfillServiceOrder(db, orderResult.id, provider.id);

      const order = await db.serviceOrder.findUnique({
        where: { id: orderResult.id },
      });

      expect(order?.status).toBe('fulfilled');
    });

    it('prevents fulfilling non-accepted order', async () => {
      const orderer = await createIdentity();
      const admin = await createIdentity();
      const provider = await createProvider();
      const project = await createProject();

      // Approve provider
      await db.provider.update({
        where: { id: provider.id },
        data: { status: 'active', vetted_at: new Date(), vetted_by_identity_id: admin.id },
      });

      const service = await createService({
        providerId: provider.id,
        categoryKey: 'cleaning',
        status: 'active',
      });

      const orderResult = await serviceOrderService.createServiceOrder(db, {
        serviceId: service.id,
        projectId: project.id,
        ordererIdentityId: orderer.id,
        ordererRole: 'owner',
        scheduledStart: new Date('2026-08-01'),
        scheduledEnd: new Date('2026-08-02'),
        quantity: 1,
        priceBreakdown: {},
        totalThb: 1000,
        tookRatePctSnapshot: 15,
      });

      await expect(
        serviceOrderService.fulfillServiceOrder(db, orderResult.id, provider.id)
      ).rejects.toThrow('Cannot fulfill order in placed status');
    });
  });

  describe('cancelServiceOrder', () => {
    it('cancels placed order with full refund window', async () => {
      const orderer = await createIdentity();
      const admin = await createIdentity();
      const provider = await createProvider();
      const project = await createProject();

      // Approve provider
      await db.provider.update({
        where: { id: provider.id },
        data: { status: 'active', vetted_at: new Date(), vetted_by_identity_id: admin.id },
      });

      const service = await createService({
        providerId: provider.id,
        categoryKey: 'cleaning',
        status: 'active',
      });

      // Schedule 48 hours in future (within refund window)
      const now = new Date();
      const scheduledStart = new Date(now.getTime() + 48 * 60 * 60 * 1000);
      const scheduledEnd = new Date(scheduledStart.getTime() + 2 * 60 * 60 * 1000);

      const orderResult = await serviceOrderService.createServiceOrder(db, {
        serviceId: service.id,
        projectId: project.id,
        ordererIdentityId: orderer.id,
        ordererRole: 'owner',
        scheduledStart,
        scheduledEnd,
        quantity: 1,
        priceBreakdown: {},
        totalThb: 1000,
        tookRatePctSnapshot: 15,
      });

      // Record cash payment
      await db.payment.create({
        data: {
          purpose: 'service_order',
          serviceOrderId: orderResult.id,
          payerIdentityId: orderer.id,
          method: 'cash',
          provider: 'cash',
          amountThb: 1000,
          receivedByIdentityId: admin.id,
          receivedAt: new Date(),
          receiptRef: 'REC-001',
          status: 'succeeded',
          succeededAt: new Date(),
        },
      });

      await serviceOrderService.cancelServiceOrder(db, orderResult.id, orderer.id);

      const order = await db.serviceOrder.findUnique({
        where: { id: orderResult.id },
      });

      expect(order?.status).toBe('cancelled');
      expect(order?.refund_accrued_thb).toBe(1000); // Full refund
    });

    it('cancels after window with zero refund', async () => {
      const orderer = await createIdentity();
      const admin = await createIdentity();
      const provider = await createProvider();
      const project = await createProject();

      // Approve provider
      await db.provider.update({
        where: { id: provider.id },
        data: { status: 'active', vetted_at: new Date(), vetted_by_identity_id: admin.id },
      });

      const service = await createService({
        providerId: provider.id,
        categoryKey: 'cleaning',
        status: 'active',
      });

      // Schedule 12 hours in future (outside refund window, default 24h)
      const now = new Date();
      const scheduledStart = new Date(now.getTime() + 12 * 60 * 60 * 1000);
      const scheduledEnd = new Date(scheduledStart.getTime() + 2 * 60 * 60 * 1000);

      const orderResult = await serviceOrderService.createServiceOrder(db, {
        serviceId: service.id,
        projectId: project.id,
        ordererIdentityId: orderer.id,
        ordererRole: 'owner',
        scheduledStart,
        scheduledEnd,
        quantity: 1,
        priceBreakdown: {},
        totalThb: 1000,
        tookRatePctSnapshot: 15,
      });

      // Record cash payment
      await db.payment.create({
        data: {
          purpose: 'service_order',
          serviceOrderId: orderResult.id,
          payerIdentityId: orderer.id,
          method: 'cash',
          provider: 'cash',
          amountThb: 1000,
          receivedByIdentityId: admin.id,
          receivedAt: new Date(),
          receiptRef: 'REC-001',
          status: 'succeeded',
          succeededAt: new Date(),
        },
      });

      await serviceOrderService.cancelServiceOrder(db, orderResult.id, orderer.id);

      const order = await db.serviceOrder.findUnique({
        where: { id: orderResult.id },
      });

      expect(order?.status).toBe('cancelled');
      expect(order?.refund_accrued_thb).toBe(0); // No refund after window
    });
  });

  describe('rateServiceOrder', () => {
    it('creates a review for a service order', async () => {
      const orderer = await createIdentity();
      const admin = await createIdentity();
      const provider = await createProvider();
      const project = await createProject();

      // Approve provider
      await db.provider.update({
        where: { id: provider.id },
        data: { status: 'active', vetted_at: new Date(), vetted_by_identity_id: admin.id },
      });

      const service = await createService({
        providerId: provider.id,
        categoryKey: 'cleaning',
        status: 'active',
      });

      const orderResult = await serviceOrderService.createServiceOrder(db, {
        serviceId: service.id,
        projectId: project.id,
        ordererIdentityId: orderer.id,
        ordererRole: 'owner',
        scheduledStart: new Date('2026-08-01'),
        scheduledEnd: new Date('2026-08-02'),
        quantity: 1,
        priceBreakdown: {},
        totalThb: 1000,
        tookRatePctSnapshot: 15,
      });

      const reviewResult = await serviceOrderService.rateServiceOrder(
        db,
        orderResult.id,
        orderer.id,
        5,
        'Excellent service!'
      );

      expect(reviewResult.id).toBeDefined();

      const review = await db.review.findUnique({
        where: { id: reviewResult.id },
      });

      expect(review?.target_type).toBe('service_order');
      expect(review?.target_id).toBe(orderResult.id);
      expect(review?.rating).toBe(5);
      expect(review?.comment).toBe('Excellent service!');
    });

    it('prevents duplicate reviews for same order', async () => {
      const orderer = await createIdentity();
      const admin = await createIdentity();
      const provider = await createProvider();
      const project = await createProject();

      // Approve provider
      await db.provider.update({
        where: { id: provider.id },
        data: { status: 'active', vetted_at: new Date(), vetted_by_identity_id: admin.id },
      });

      const service = await createService({
        providerId: provider.id,
        categoryKey: 'cleaning',
        status: 'active',
      });

      const orderResult = await serviceOrderService.createServiceOrder(db, {
        serviceId: service.id,
        projectId: project.id,
        ordererIdentityId: orderer.id,
        ordererRole: 'owner',
        scheduledStart: new Date('2026-08-01'),
        scheduledEnd: new Date('2026-08-02'),
        quantity: 1,
        priceBreakdown: {},
        totalThb: 1000,
        tookRatePctSnapshot: 15,
      });

      await serviceOrderService.rateServiceOrder(db, orderResult.id, orderer.id, 5);

      await expect(
        serviceOrderService.rateServiceOrder(db, orderResult.id, orderer.id, 4)
      ).rejects.toThrow('You have already reviewed this service order');
    });

    it('rejects invalid ratings', async () => {
      const orderer = await createIdentity();
      const admin = await createIdentity();
      const provider = await createProvider();
      const project = await createProject();

      // Approve provider
      await db.provider.update({
        where: { id: provider.id },
        data: { status: 'active', vetted_at: new Date(), vetted_by_identity_id: admin.id },
      });

      const service = await createService({
        providerId: provider.id,
        categoryKey: 'cleaning',
        status: 'active',
      });

      const orderResult = await serviceOrderService.createServiceOrder(db, {
        serviceId: service.id,
        projectId: project.id,
        ordererIdentityId: orderer.id,
        ordererRole: 'owner',
        scheduledStart: new Date('2026-08-01'),
        scheduledEnd: new Date('2026-08-02'),
        quantity: 1,
        priceBreakdown: {},
        totalThb: 1000,
        tookRatePctSnapshot: 15,
      });

      await expect(
        serviceOrderService.rateServiceOrder(db, orderResult.id, orderer.id, 6)
      ).rejects.toThrow('Rating must be 1-5');

      await expect(
        serviceOrderService.rateServiceOrder(db, orderResult.id, orderer.id, 0)
      ).rejects.toThrow('Rating must be 1-5');
    });
  });

  describe('e2e — full lifecycle: placed → accepted → fulfilled → rated', () => {
    it('walks through complete service order lifecycle', async () => {
      const orderer = await createIdentity();
      const admin = await createIdentity();
      const provider = await createProvider();
      const project = await createProject();

      // Approve provider
      await db.provider.update({
        where: { id: provider.id },
        data: { status: 'active', vetted_at: new Date(), vetted_by_identity_id: admin.id },
      });

      const service = await createService({
        providerId: provider.id,
        categoryKey: 'cleaning',
        status: 'active',
      });

      // Step 1: Order is placed
      const orderResult = await serviceOrderService.createServiceOrder(db, {
        serviceId: service.id,
        projectId: project.id,
        ordererIdentityId: orderer.id,
        ordererRole: 'owner',
        scheduledStart: new Date('2026-08-01'),
        scheduledEnd: new Date('2026-08-02'),
        quantity: 1,
        priceBreakdown: { base: 1000 },
        totalThb: 1000,
        tookRatePctSnapshot: 15,
      });

      let order = await db.serviceOrder.findUnique({
        where: { id: orderResult.id },
      });
      expect(order?.status).toBe('placed');

      // Step 2: Provider accepts
      await serviceOrderService.acceptServiceOrder(db, orderResult.id, provider.id);
      order = await db.serviceOrder.findUnique({
        where: { id: orderResult.id },
      });
      expect(order?.status).toBe('accepted');

      // Step 3: Provider fulfills
      await serviceOrderService.fulfillServiceOrder(db, orderResult.id, provider.id);
      order = await db.serviceOrder.findUnique({
        where: { id: orderResult.id },
      });
      expect(order?.status).toBe('fulfilled');

      // Step 4: Orderer rates
      const reviewResult = await serviceOrderService.rateServiceOrder(
        db,
        orderResult.id,
        orderer.id,
        5,
        'Great service!'
      );

      const review = await db.review.findUnique({
        where: { id: reviewResult.id },
      });

      expect(review?.target_type).toBe('service_order');
      expect(review?.target_id).toBe(orderResult.id);
      expect(review?.rating).toBe(5);
    });
  });
});
