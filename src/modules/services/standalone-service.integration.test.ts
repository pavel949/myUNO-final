import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { db, resetDb, createIdentity, createProvider, createService, createOrganization, createProject } from '@/test/util';
import { verifyAndConfirm, markRefundSucceeded } from '@/modules/finance';
import { clearConfigCache, seedConfig } from '@/modules/config';
import { acceptServiceOrder, cancelServiceOrder, reportProviderNoShow, expireStaleServiceOrders, fulfillServiceOrder } from './service-order.service';
import { getServiceOrderCustomerView } from './service-order-customer-view';
const user = vi.hoisted(() => ({ current: null as unknown }));
vi.mock('@/app/actions/getCurrentUser', () => ({ getCurrentUser: async () => user.current }));
vi.mock('@/lib/prisma', async () => ({ prisma: (await import('@/test/util')).db }));
import { POST, GET } from '@/app/api/service-orders/route';
import { POST as ACCEPT_ORDER } from '@/app/api/service-orders/[id]/accept/route';
import { POST as FULFILL_ORDER } from '@/app/api/service-orders/[id]/fulfil/route';
import { GET as GET_ORDER } from '@/app/api/service-orders/[id]/route';

const context = { kind: 'standalone', destinationKey: 'phuket', areaKey: 'bang-tao', address: '10 Example Road, Phuket', recipientName: 'Test Recipient', recipientPhone: '+66000000000' };
async function setup() {
  const customer = await createIdentity();
  const stranger = await createIdentity();
  const organization = await createOrganization();
  const provider = await createProvider({ status: 'active' });
  await db.provider.update({ where: { id: provider.id }, data: { vetted_at: new Date() } });
  const service = await createService({ providerId: provider.id, status: 'active', basePriceThb: 50000 });
  await db.area.create({ data: { slug: 'bang-tao', nameKey: 'test.area', status: 'live' } });
  const offers = [{ serviceId: service.id, responsibleOrganizationId: organization.id, destinationKey: 'phuket', areaKeys: ['bang-tao'], termsVersion: 1, takeRatePct: 12, enabled: true }];
  await db.configParameter.upsert({ where: { key: 'services.standalone_offers' }, create: { key: 'services.standalone_offers', valueType: 'json', defaultValue: offers, scopeableTo: 'global', groupKey: 'services', description: 'Integration test reviewed offer' }, update: { defaultValue: offers } });
  user.current = { identityId: customer.id, firstName: 'Test', lastName: 'Guest', email: customer.email, isAdmin: false, roles: [] };
  return { customer, stranger, organization, provider, service };
}
const scheduledStart = new Date(Date.now() + 72 * 3600000).toISOString();
function request(serviceId: string, location = context, requestKey?: string) {
  return new NextRequest('http://localhost/api/service-orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ serviceId, scheduledStart, requestKey, quantity: 2, totalThb: 1, responsibleOrganizationId: 'forged', serviceContext: location }) });
}
beforeEach(async () => { await resetDb(); await seedConfig(db); clearConfigCache(); });
afterEach(async () => { await resetDb(); clearConfigCache(); vi.unstubAllEnvs(); });
describe('standalone service lifecycle on real schema', () => {
  it('orders without a project role, pays, fulfils and attributes commission to the real order', async () => {
    const { customer, stranger, organization, provider, service } = await setup();
    const project = await createProject();
    await db.serviceProject.create({ data: { service_id: service.id, project_id: project.id, public: false, enabled: true, price_override_thb: 9000000, take_rate_pct: 90, lead_time_hours: 99999, terms_version: 99 } });
    const result = await POST(request(service.id));
    expect(result.status).toBe(201);
    const { order: created } = await result.json();
    const order = await db.serviceOrder.findUniqueOrThrow({ where: { id: created.id } });
    expect(order.project_id).toBeNull(); expect(order.unit_id).toBeNull();
    expect(order.total_thb).toBe(100000);
    expect(order.service_context).toMatchObject({ ...context, responsibleOrganizationId: organization.id });
    expect(order.terms_snapshot).toMatchObject({ collector: 'myuno', responsibleOrganizationId: organization.id, totalThb: 100000, takeRatePct: 12 });
    expect((await GET(new NextRequest('http://localhost/api/service-orders'))).status).toBe(200);
    expect((await getServiceOrderCustomerView(db, order.id, customer.id)).kind).toBe('ok');
    expect((await getServiceOrderCustomerView(db, order.id, stranger.id)).kind).toBe('forbidden');
    user.current = { identityId: stranger.id, isAdmin: false, roles: [] };
    expect((await GET_ORDER(new NextRequest('http://localhost'), { params: { id: order.id } })).status).toBe(404);
    const strangerList = await GET(new NextRequest('http://localhost/api/service-orders'));
    expect((await strangerList.json()).orders).toHaveLength(0);
    await db.payment.create({ data: { purpose: 'service_order', serviceOrderId: order.id, payerIdentityId: customer.id, method: 'cash', provider: 'cash', amountThb: order.total_thb, status: 'succeeded', succeededAt: new Date() } });
    await db.serviceOrder.update({ where: { id: order.id }, data: { status: 'paid' } });
    const member = await createIdentity();
    user.current = { identityId: member.id, isAdmin: false, roles: [{ role: 'provider_member', providerId: provider.id, projectId: null, unitId: null, organizationId: null }] };
    expect((await ACCEPT_ORDER(new NextRequest('http://localhost', { method: 'POST' }), { params: { id: order.id } })).status).toBe(200);
    const fulfilments = await Promise.all([FULFILL_ORDER(new NextRequest('http://localhost', { method: 'POST' }), { params: { id: order.id } }), FULFILL_ORDER(new NextRequest('http://localhost', { method: 'POST' }), { params: { id: order.id } })]);
    expect(fulfilments.map(response => response.status).sort()).toEqual([200, 409]);
    const commission = await db.ledgerEntry.findFirstOrThrow({ where: { serviceOrderId: order.id, entryType: 'service_commission' } });
    expect(commission.projectId).toBeNull(); expect(commission.unitId).toBeNull(); expect(commission.amountThb).toBe(12000);
    await expect(fulfillServiceOrder(db, order.id, provider.id)).rejects.toThrow(/Cannot fulfill/);
    expect(await db.ledgerEntry.count({ where: { serviceOrderId: order.id, entryType: 'service_commission' } })).toBe(1);
  });
  it('serializes concurrent replay of one intent and refuses changed details with the same key', async () => {
    const { service } = await setup();
    const key = randomUUID();
    const responses = await Promise.all([POST(request(service.id, context, key)), POST(request(service.id, context, key))]);
    expect(responses.map(response => response.status)).toEqual([201, 201]);
    const results = await Promise.all(responses.map(response => response.json()));
    expect(results[0].order.id).toBe(results[1].order.id);
    expect(await db.serviceOrder.count()).toBe(1);
    const changed = await POST(request(service.id, { ...context, recipientName: 'Different recipient' }, key));
    expect(changed.status).toBe(409);
    expect(await db.serviceOrder.count()).toBe(1);
    expect(await db.payment.count()).toBe(0);
  });
  it.each(['cancel', 'no-show'] as const)('serializes fulfillment against %s so commission and refund cannot both win', async kind => {
    const { customer, provider, service } = await setup();
    const response = await POST(request(service.id));
    const { order: created } = await response.json();
    const order = await db.serviceOrder.findUniqueOrThrow({ where: { id: created.id } });
    await db.payment.create({ data: { purpose: 'service_order', serviceOrderId: order.id, payerIdentityId: customer.id, method: 'cash', provider: 'cash', amountThb: order.total_thb, status: 'succeeded', succeededAt: new Date() } });
    await db.serviceOrder.update({ where: { id: order.id }, data: { status: 'paid', ...(kind === 'no-show' ? { scheduled_start: new Date(Date.now() - 3600000) } : {}) } });
    await acceptServiceOrder(db, order.id, provider.id);
    const results = await Promise.allSettled([fulfillServiceOrder(db, order.id, provider.id), kind === 'cancel' ? cancelServiceOrder(db, order.id, customer.id) : reportProviderNoShow(db, order.id, customer.id)]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const final = await db.serviceOrder.findUniqueOrThrow({ where: { id: order.id } });
    const commission = await db.ledgerEntry.count({ where: { serviceOrderId: order.id, entryType: 'service_commission' } });
    const refunds = await db.refund.aggregate({ where: { payment: { serviceOrderId: order.id } }, _sum: { amountThb: true } });
    if (final.status === 'fulfilled') { expect(commission).toBe(1); expect(refunds._sum.amountThb ?? 0).toBe(0); }
    else { expect(['cancelled', 'failed']).toContain(final.status); expect(commission).toBe(0); expect(refunds._sum.amountThb).toBe(order.total_thb); }
  });
  it('recovers a committed cancellation obligation once after interruption, even with two sweeps', async () => {
    const { customer, service } = await setup();
    const response = await POST(request(service.id));
    const { order: created } = await response.json();
    const order = await db.serviceOrder.findUniqueOrThrow({ where: { id: created.id } });
    await db.payment.create({ data: { purpose: 'service_order', serviceOrderId: order.id, payerIdentityId: customer.id, method: 'cash', provider: 'cash', amountThb: order.total_thb, status: 'succeeded', succeededAt: new Date() } });
    // Exact durable state if the process stops after terminal claim and before refund reservation.
    await db.serviceOrder.update({ where: { id: order.id }, data: { status: 'cancelled', cancelled_by_identity_id: customer.id, cancelled_at: new Date(), refund_accrued_thb: order.total_thb } });
    await Promise.all([expireStaleServiceOrders(db, 12), expireStaleServiceOrders(db, 12)]);
    expect(await db.refund.count({ where: { payment: { serviceOrderId: order.id } } })).toBe(1);
    expect(await db.ledgerEntry.count({ where: { serviceOrderId: order.id, entryType: 'refund_out' } })).toBe(1);
    expect(await db.ledgerEntry.count({ where: { serviceOrderId: order.id, entryType: 'service_commission' } })).toBe(0);
  });
  it('keeps a late verified receipt traceable without resurrecting a cancelled order', async () => {
    vi.stubEnv('PAYMENT_PROVIDER', 'mock');
    const { customer, service } = await setup();
    const response = await POST(request(service.id));
    const { order: created } = await response.json();
    const order = await db.serviceOrder.findUniqueOrThrow({ where: { id: created.id } });
    const payment = await db.payment.create({ data: { purpose: 'service_order', serviceOrderId: order.id, payerIdentityId: customer.id, method: 'card_provider', provider: 'mock', amountThb: order.total_thb, status: 'pending' } });
    await cancelServiceOrder(db, order.id, customer.id);
    const verified = await verifyAndConfirm(db, payment.id);
    expect(verified.confirmed).toBe(false); expect(verified.reconciliationRequired).toBe(true);
    const receipt = await db.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(receipt.status).toBe('succeeded'); expect(receipt.reconciliationReason).toBe('SERVICE_ORDER_NO_LONGER_PAYABLE');
    expect((await db.serviceOrder.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('cancelled');
    const unallocated = await db.ledgerEntry.findFirstOrThrow({ where: { paymentId: payment.id, entryType: 'payment_unallocated' } });
    expect(unallocated.serviceOrderId).toBe(order.id); expect(unallocated.amountThb).toBe(order.total_thb);
    await verifyAndConfirm(db, payment.id);
    expect(await db.ledgerEntry.count({ where: { paymentId: payment.id, entryType: 'payment_unallocated' } })).toBe(1);
  });
  it('links a verified card refund to the actual service order once', async () => {
    const { customer, service } = await setup();
    const response = await POST(request(service.id)); const { order: created } = await response.json();
    const payment = await db.payment.create({ data: { purpose: 'service_order', serviceOrderId: created.id, payerIdentityId: customer.id, method: 'card_provider', provider: 'opn', amountThb: 100000, status: 'succeeded' } });
    const refund = await db.refund.create({ data: { paymentId: payment.id, method: 'card_provider', amountThb: 100000, reason: 'cancellation', status: 'processing', initiatedByIdentityId: customer.id } });
    await markRefundSucceeded(db, refund.id); await markRefundSucceeded(db, refund.id);
    const ledger = await db.ledgerEntry.findFirstOrThrow({ where: { refundId: refund.id, entryType: 'refund_out' } });
    expect(ledger.serviceOrderId).toBe(created.id); expect(ledger.projectId).toBeNull();
    expect(await db.ledgerEntry.count({ where: { refundId: refund.id, entryType: 'refund_out' } })).toBe(1);
  });
  it('rejects uncovered addresses without creating an order, payment or ledger effect', async () => {
    const { service } = await setup();
    const result = await POST(request(service.id, { ...context, areaKey: 'uncovered' }));
    expect(result.status).toBe(400);
    expect(await db.serviceOrder.count()).toBe(0);
    expect(await db.payment.count()).toBe(0);
    expect(await db.ledgerEntry.count()).toBe(0);
  });
  it('protects the accepted recipient/organization/price snapshot from later mutation', async () => {
    const { service } = await setup();
    const response = await POST(request(service.id));
    const { order } = await response.json();
    await expect(db.serviceOrder.update({ where: { id: order.id }, data: { service_context: { ...context, address: 'Changed after acceptance' } } })).rejects.toThrow(/immutable/);
  });
});
