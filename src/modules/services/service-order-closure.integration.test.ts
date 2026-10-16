import { beforeEach, describe, expect, it } from 'vitest';
import { db, resetDb, createIdentity, createProject, createProvider, createService } from '@/test/util';
import { seedConfig, setConfigOverride, updateConfigParameter } from '@/modules/config';
import { raiseDispute } from '@/modules/comms/dispute.service';
import { closeFulfilledServiceOrders, confirmServiceOrder, FULFILMENT_WINDOW_KEY } from './service-order-closure';
import { getServiceOrderCustomerView } from './service-order-customer-view';
import { rateServiceOrder } from './service-order.service';

beforeEach(async () => { await resetDb(); });
async function fixture(hoursAgo = 1) {
  const orderer = await createIdentity();
  const providerIdentity = await createIdentity();
  const provider = await createProvider();
  const project = await createProject();
  const service = await createService({ providerId: provider.id });
  const order = await db.serviceOrder.create({ data: {
    service_id: service.id, provider_id: provider.id, project_id: project.id,
    orderer_identity_id: orderer.id, orderer_role: 'guest',
    scheduled_start: new Date(Date.now() - 5 * 86_400_000), scheduled_end: new Date(Date.now() - 4 * 86_400_000),
    status: 'fulfilled', fulfilled_at: new Date(Date.now() - hoursAgo * 3_600_000),
    quantity: 1, price_breakdown: { total_thb: 10000 }, total_thb: 10000, take_rate_pct_snapshot: 15,
  } });
  const dispute = () => raiseDispute(db, { subjectType: 'service_order', subjectId: order.id, raisedByIdentityId: orderer.id, raisedByRole: 'guest', title: 'Service incomplete', description: 'The agreed work was not completed.' });
  return { order, orderer, providerIdentity, project, dispute };
}

describe('service fulfilment confirmation and disputes', () => {
  it('permits only the orderer, retries safely and never creates a second commission or payment', async () => {
    const { order, orderer, providerIdentity } = await fixture();
    await expect(confirmServiceOrder(db, order.id, providerIdentity.id)).rejects.toMatchObject({ code: 'forbidden' });
    expect(await confirmServiceOrder(db, order.id, orderer.id)).toEqual({ closed: true, status: 'closed' });
    expect(await confirmServiceOrder(db, order.id, orderer.id)).toEqual({ closed: false, status: 'closed' });
    const saved = await db.serviceOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect(saved.closed_by_identity_id).toBe(orderer.id);
    expect(saved.fulfilled_at).toEqual(order.fulfilled_at);
    expect(saved.closed_at).not.toBeNull();
    expect(await db.ledgerEntry.count()).toBe(0);
    expect(await db.payment.count()).toBe(0);
    await expect(rateServiceOrder(db, order.id, orderer.id, 5)).resolves.toHaveProperty('id');
  });

  it('serializes confirmation against dispute creation without contradictory states or orphan tickets', async () => {
    const { order, orderer, dispute } = await fixture();
    const results = await Promise.allSettled([confirmServiceOrder(db, order.id, orderer.id), dispute()]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const saved = await db.serviceOrder.findUniqueOrThrow({ where: { id: order.id } });
    const disputes = await db.dispute.count();
    expect(saved.status === 'closed' ? disputes === 0 : saved.status === 'fulfilled' && disputes === 1).toBe(true);
    expect(await db.ticket.count()).toBe(disputes);
    expect(await db.thread.count()).toBe(disputes);
  });

  it('creates exactly one ticket and dispute under duplicate submissions', async () => {
    const { dispute } = await fixture();
    const results = await Promise.allSettled([dispute(), dispute()]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(await db.dispute.count()).toBe(1);
    expect(await db.ticket.count()).toBe(1);
    expect(await db.thread.count()).toBe(1);
  });

  it('blocks confirmation and auto-close for an undecided dispute; allows sweep after decision', async () => {
    const { order, orderer, dispute } = await fixture();
    const raised = await dispute();
    await expect(confirmServiceOrder(db, order.id, orderer.id)).rejects.toMatchObject({ code: 'disputed' });
    // Advance the authoritative fulfilment date in a synthetic fixture only.
    await db.serviceOrder.update({ where: { id: order.id }, data: { fulfilled_at: new Date(Date.now() - 49 * 3_600_000) } });
    expect(await closeFulfilledServiceOrders(db)).toBe(0);
    await db.dispute.update({ where: { id: raised.id }, data: { decidedAt: new Date(), decidedByIdentityId: orderer.id } });
    expect(await closeFulfilledServiceOrders(db)).toBe(1);
    expect(await closeFulfilledServiceOrders(db)).toBe(0);
    expect((await db.serviceOrder.findUniqueOrThrow({ where: { id: order.id } })).closed_by_identity_id).toBeNull();
  });

  it('enforces expiry on the server and UI, including custom project scope', async () => {
    const { order, orderer, project, dispute } = await fixture(3);
    await seedConfig(db);
    await setConfigOverride(db, FULFILMENT_WINDOW_KEY, 2, { scopeType: 'project', scopeId: project.id, changedByIdentityId: orderer.id });
    await expect(dispute()).rejects.toMatchObject({ code: 'window_expired' });
    await expect(confirmServiceOrder(db, order.id, orderer.id)).rejects.toMatchObject({ code: 'window_expired' });
    const view = await getServiceOrderCustomerView(db, order.id, orderer.id);
    expect(view.kind === 'ok' && view.order.canConfirm).toBe(false);
    expect(view.kind === 'ok' && view.order.canDispute).toBe(false);
    expect(view.kind === 'ok' && view.order.confirmationDeadline).toBe(new Date(order.fulfilled_at!.getTime() + 2 * 3_600_000).toISOString());
    expect(await closeFulfilledServiceOrders(db)).toBe(1);
    await expect(dispute()).rejects.toMatchObject({ code: 'state' });
    expect(await db.ticket.count()).toBe(0);
  });

  it('does not invent fulfilment time for legacy rows or close other lifecycle states', async () => {
    const { order, orderer } = await fixture();
    await db.serviceOrder.update({ where: { id: order.id }, data: { fulfilled_at: null } });
    expect(await closeFulfilledServiceOrders(db)).toBe(0);
    await expect(confirmServiceOrder(db, order.id, orderer.id)).rejects.toMatchObject({ code: 'state' });
    await db.serviceOrder.update({ where: { id: order.id }, data: { status: 'accepted' } });
    await expect(confirmServiceOrder(db, order.id, orderer.id)).rejects.toMatchObject({ code: 'state' });
  });

  it('rejects invalid commercial window edits', async () => {
    const { orderer } = await fixture();
    await seedConfig(db);
    for (const value of [0, -1, 0.5]) {
      await expect(updateConfigParameter(db, { identityId: orderer.id, paramKey: FULFILMENT_WINDOW_KEY, newValue: value })).rejects.toThrow(/positive whole/);
    }
  });
});
