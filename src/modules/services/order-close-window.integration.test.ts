import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db, resetDb, createIdentity, createProject, createProvider, createService } from '@/test/util';
import { seedConfig, setConfigOverride } from '@/modules/config';
import * as serviceOrderService from './service-order.service';
import { raiseDispute } from '@/modules/comms/dispute.service';

/**
 * The confirm/dispute window (doc 07 F-PROV-3).
 *
 * `fulfilled` is not the end of a service order. These tests pin the rule
 * that makes `closed` mean something: the orderer gets
 * `[cfg] service.fulfilment_confirm_window_hours` to confirm or dispute, and
 * after that the order is finished and no longer disputable.
 */

/** A fulfilled order with everything the lifecycle needs behind it. */
async function fulfilledOrder(options: { fulfilledAt?: Date } = {}) {
  const orderer = await createIdentity();
  const admin = await createIdentity();
  const provider = await createProvider();
  const project = await createProject();

  await db.provider.update({
    where: { id: provider.id },
    data: { status: 'active', vetted_at: new Date(), vetted_by_identity_id: admin.id },
  });

  const service = await createService({
    providerId: provider.id,
    categoryKey: 'cleaning',
    status: 'active',
  });

  const order = await serviceOrderService.createServiceOrder(db, {
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

  await serviceOrderService.acceptServiceOrder(db, order.id, provider.id);
  await serviceOrderService.fulfillServiceOrder(db, order.id, provider.id);

  // Backdating the fulfilment is how we move time: the deadline is derived
  // from `fulfilled_at`, never stored, so this is the only lever needed.
  if (options.fulfilledAt) {
    await db.serviceOrder.update({
      where: { id: order.id },
      data: { fulfilled_at: options.fulfilledAt },
    });
  }

  return { orderId: order.id, orderer, provider, project };
}

function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

describe('service-order confirm/dispute window (F-PROV-3)', () => {
  beforeEach(async () => {
    await resetDb();
    await seedConfig(db);
  });

  afterEach(async () => {
    await resetDb();
  });

  describe('confirmServiceOrderFulfilment', () => {
    it('closes the order and records who confirmed', async () => {
      const { orderId, orderer } = await fulfilledOrder();

      await serviceOrderService.confirmServiceOrderFulfilment(db, orderId, orderer.id);

      const order = await db.serviceOrder.findUnique({ where: { id: orderId } });
      expect(order?.status).toBe('closed');
      expect(order?.closed_at).not.toBeNull();
      expect(order?.closed_by_identity_id).toBe(orderer.id);
    });

    it('refuses anyone but the orderer — confirming waives the orderer’s own recourse', async () => {
      const { orderId } = await fulfilledOrder();
      const someoneElse = await createIdentity();

      await expect(
        serviceOrderService.confirmServiceOrderFulfilment(db, orderId, someoneElse.id)
      ).rejects.toThrow('Only the orderer');

      const order = await db.serviceOrder.findUnique({ where: { id: orderId } });
      expect(order?.status).toBe('fulfilled');
    });

    it('refuses an order that is not fulfilled', async () => {
      const { orderId, orderer } = await fulfilledOrder();
      await serviceOrderService.confirmServiceOrderFulfilment(db, orderId, orderer.id);

      await expect(
        serviceOrderService.confirmServiceOrderFulfilment(db, orderId, orderer.id)
      ).rejects.toThrow('Cannot confirm an order in closed status');
    });

    it('refuses a confirmation once the window has passed, before the sweep runs', async () => {
      // The gap this closes: the order is still `fulfilled` because the nightly
      // sweep has not run yet, but the orderer's window is over. Confirming
      // here would stamp `closed_by_identity_id` on a late confirmation and
      // contradict the dispute path, which already refuses at this point.
      const { orderId, orderer } = await fulfilledOrder({ fulfilledAt: hoursAgo(49) });

      await expect(
        serviceOrderService.confirmServiceOrderFulfilment(db, orderId, orderer.id)
      ).rejects.toThrow('48-hour window');

      const order = await db.serviceOrder.findUnique({ where: { id: orderId } });
      expect(order?.status).toBe('fulfilled');
      expect(order?.closed_by_identity_id).toBeNull();
    });

    it('emits service_order_closed', async () => {
      const { orderId, orderer } = await fulfilledOrder();
      await serviceOrderService.confirmServiceOrderFulfilment(db, orderId, orderer.id);

      const event = await db.analyticsEvent.findFirst({
        where: { eventKey: 'service_order_closed', serviceOrderId: orderId },
      });
      expect(event).not.toBeNull();
    });
  });

  describe('closeSettledServiceOrders (the nightly sweep)', () => {
    it('closes an order whose window has lapsed, with no confirming identity', async () => {
      const { orderId } = await fulfilledOrder({ fulfilledAt: hoursAgo(49) });

      const result = await serviceOrderService.closeSettledServiceOrders(db);
      expect(result.closed).toBe(1);

      const order = await db.serviceOrder.findUnique({ where: { id: orderId } });
      expect(order?.status).toBe('closed');
      expect(order?.closed_at).not.toBeNull();
      // Nobody confirmed — the window simply ran out.
      expect(order?.closed_by_identity_id).toBeNull();
    });

    it('leaves an order still inside its window alone', async () => {
      const { orderId } = await fulfilledOrder({ fulfilledAt: hoursAgo(47) });

      const result = await serviceOrderService.closeSettledServiceOrders(db);
      expect(result.closed).toBe(0);

      const order = await db.serviceOrder.findUnique({ where: { id: orderId } });
      expect(order?.status).toBe('fulfilled');
    });

    it('honours a per-project override that shortens the window', async () => {
      const { orderId, project } = await fulfilledOrder({ fulfilledAt: hoursAgo(7) });
      const admin = await createIdentity();

      // Untouched, 7 hours in is well inside the 48-hour default.
      expect((await serviceOrderService.closeSettledServiceOrders(db)).closed).toBe(0);

      await setConfigOverride(db, 'service.fulfilment_confirm_window_hours', 6, {
        scopeType: 'project',
        scopeId: project.id,
        changedByIdentityId: admin.id,
      });

      expect((await serviceOrderService.closeSettledServiceOrders(db)).closed).toBe(1);
      const order = await db.serviceOrder.findUnique({ where: { id: orderId } });
      expect(order?.status).toBe('closed');
    });

    it('leaves an order carrying an open dispute open', async () => {
      const { orderId, orderer } = await fulfilledOrder({ fulfilledAt: hoursAgo(49) });

      // Raised while still inside the window, then time moved on.
      await db.serviceOrder.update({
        where: { id: orderId },
        data: { fulfilled_at: hoursAgo(1) },
      });
      await raiseDispute(db, {
        subjectType: 'service_order',
        subjectId: orderId,
        raisedByIdentityId: orderer.id,
        raisedByRole: 'owner',
        title: 'Work not done',
        description: 'The cleaner never arrived.',
      });
      await db.serviceOrder.update({
        where: { id: orderId },
        data: { fulfilled_at: hoursAgo(49) },
      });

      const result = await serviceOrderService.closeSettledServiceOrders(db);
      expect(result.closed).toBe(0);

      const order = await db.serviceOrder.findUnique({ where: { id: orderId } });
      expect(order?.status).toBe('fulfilled');
    });

    it('never leaves a closed order carrying an open dispute, under concurrency', async () => {
      // The race CodeRabbit found: the sweep reads open disputes up front, then
      // updates by id. A dispute committing between those two steps produced a
      // `closed` order under an open dispute — the exact state the window
      // exists to prevent.
      //
      // Interleaving cannot be forced deterministically from here, so this
      // asserts the invariant instead of one ordering: whoever wins, the end
      // state must be one of the two coherent pairs. The row lock in both
      // paths is what makes the third pair unreachable.
      const { orderId, orderer } = await fulfilledOrder({ fulfilledAt: hoursAgo(49) });

      const [sweep, dispute] = await Promise.allSettled([
        serviceOrderService.closeSettledServiceOrders(db),
        raiseDispute(db, {
          subjectType: 'service_order',
          subjectId: orderId,
          raisedByIdentityId: orderer.id,
          raisedByRole: 'owner',
          title: 'Racing the sweep',
          description: 'Filed as the window lapsed.',
        }),
      ]);

      const order = await db.serviceOrder.findUnique({ where: { id: orderId } });
      const openDispute = await db.dispute.findFirst({
        where: { subjectType: 'service_order', subjectId: orderId, decidedAt: null },
      });

      // The forbidden pair, stated directly.
      expect(order?.status === 'closed' && openDispute !== null).toBe(false);

      if (order?.status === 'closed') {
        expect(openDispute).toBeNull();
        expect(dispute.status).toBe('rejected');
      } else {
        expect(order?.status).toBe('fulfilled');
        expect(openDispute).not.toBeNull();
        expect(sweep.status === 'fulfilled' && sweep.value.closed).toBe(0);
      }
    });

    it('leaves no orphan ticket when a dispute cannot be created', async () => {
      // raiseTicket and dispute.create now share one transaction. A second
      // dispute on the same order is refused before any writing, so the
      // ticket count must not move.
      const { orderId, orderer } = await fulfilledOrder({ fulfilledAt: hoursAgo(1) });

      await raiseDispute(db, {
        subjectType: 'service_order',
        subjectId: orderId,
        raisedByIdentityId: orderer.id,
        raisedByRole: 'owner',
        title: 'First',
        description: 'The only dispute this order may carry.',
      });
      const ticketsAfterFirst = await db.ticket.count();

      await expect(
        raiseDispute(db, {
          subjectType: 'service_order',
          subjectId: orderId,
          raisedByIdentityId: orderer.id,
          raisedByRole: 'owner',
          title: 'Second',
          description: 'Should be refused.',
        })
      ).rejects.toThrow('already been raised');

      expect(await db.ticket.count()).toBe(ticketsAfterFirst);
    });

    it('ignores orders that were never fulfilled', async () => {
      await fulfilledOrder({ fulfilledAt: hoursAgo(49) });
      const { orderId } = await fulfilledOrder();
      await db.serviceOrder.update({
        where: { id: orderId },
        data: { status: 'cancelled' },
      });

      const result = await serviceOrderService.closeSettledServiceOrders(db);
      expect(result.closed).toBe(1);
    });
  });

  describe('the window bounds disputes', () => {
    it('accepts a dispute raised inside the window', async () => {
      const { orderId, orderer } = await fulfilledOrder({ fulfilledAt: hoursAgo(2) });

      const dispute = await raiseDispute(db, {
        subjectType: 'service_order',
        subjectId: orderId,
        raisedByIdentityId: orderer.id,
        raisedByRole: 'owner',
        title: 'Work incomplete',
        description: 'Only half the flat was cleaned.',
      });

      expect(dispute.subjectId).toBe(orderId);
    });

    it('refuses a dispute once the window has passed, even before the sweep runs', async () => {
      const { orderId, orderer } = await fulfilledOrder({ fulfilledAt: hoursAgo(49) });

      await expect(
        raiseDispute(db, {
          subjectType: 'service_order',
          subjectId: orderId,
          raisedByIdentityId: orderer.id,
          raisedByRole: 'owner',
          title: 'Too late',
          description: 'Raised after the window closed.',
        })
      ).rejects.toThrow('48-hour window');
    });

    it('refuses a dispute against an order that is already closed', async () => {
      const { orderId, orderer } = await fulfilledOrder();
      await serviceOrderService.confirmServiceOrderFulfilment(db, orderId, orderer.id);

      await expect(
        raiseDispute(db, {
          subjectType: 'service_order',
          subjectId: orderId,
          raisedByIdentityId: orderer.id,
          raisedByRole: 'owner',
          title: 'Changed my mind',
          description: 'Confirmed, then wanted to dispute.',
        })
      ).rejects.toThrow('closed');
    });

    it('still accepts a dispute against an order that was never fulfilled', async () => {
      // A cancelled or failed order has no fulfilment window to run out; the
      // window must not become a blanket bar on disputing service orders.
      const { orderId, orderer } = await fulfilledOrder();
      await db.serviceOrder.update({
        where: { id: orderId },
        data: { status: 'cancelled', fulfilled_at: null },
      });

      const dispute = await raiseDispute(db, {
        subjectType: 'service_order',
        subjectId: orderId,
        raisedByIdentityId: orderer.id,
        raisedByRole: 'owner',
        title: 'Charged for a cancelled order',
        description: 'Refund never arrived.',
      });

      expect(dispute.subjectId).toBe(orderId);
    });
  });
});
