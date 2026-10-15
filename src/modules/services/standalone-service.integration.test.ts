import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { db, resetDb, createIdentity, createProvider, createService, createOrganization, createProject } from '@/test/util';
import { clearConfigCache } from '@/modules/config';
import { fulfillServiceOrder } from './service-order.service';
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
  await db.configParameter.create({ data: { key: 'services.standalone_offers', valueType: 'json', defaultValue: offers, scopeableTo: 'global', groupKey: 'services', description: 'Integration test reviewed offer' } });
  user.current = { identityId: customer.id, firstName: 'Test', lastName: 'Guest', email: customer.email, isAdmin: false, roles: [] };
  return { customer, stranger, organization, provider, service };
}
const scheduledStart = new Date(Date.now() + 72 * 3600000).toISOString();
function request(serviceId: string, location = context, requestKey?: string) {
  return new NextRequest('http://localhost/api/service-orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ serviceId, scheduledStart, requestKey, quantity: 2, totalThb: 1, responsibleOrganizationId: 'forged', serviceContext: location }) });
}
beforeEach(async () => { await resetDb(); clearConfigCache(); });
afterEach(async () => { await resetDb(); clearConfigCache(); });
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
