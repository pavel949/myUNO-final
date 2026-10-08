import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { createBooking, createIdentity, createProject, createProvider, createService, createUnit, db, resetDb } from '@/test/util';
import { getConfig, seedConfig, setConfigOverride } from '@/modules/config';
import { computePriceBreakdown } from '@/modules/core';
import { createCheckout } from '@/modules/finance';

const { currentUser, providerCreate } = vi.hoisted(() => ({ currentUser: vi.fn(), providerCreate: vi.fn() }));
vi.mock('@/app/actions/getCurrentUser', () => ({ getCurrentUser: currentUser }));
vi.mock('@/lib/prisma', async () => ({ prisma: (await import('@/test/util')).db }));
vi.mock('@/modules/finance/providers', () => ({
  getProviderConfig: () => ({ provider: 'opn' }),
  getPaymentProvider: () => ({ createCheckout: providerCreate }),
}));
import { POST as direct } from './route';
import { POST as resume } from './[id]/checkout/route';
import { POST as modify } from './[id]/modify/route';
import { POST as serviceCheckout } from '@/app/api/service-orders/[id]/checkout/route';

const key = 'booking.payment.methods_enabled';
const purposes = ['stay', 'stay_balance', 'service_order'] as const;
const startDate = new Date('2027-06-01');
const endDate = new Date('2027-06-03');
const request = (body: unknown = {}) => new NextRequest('http://localhost/api/bookings', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

async function baseFixture() {
  const guest = await createIdentity();
  currentUser.mockResolvedValue({ identityId: guest.id, isAdmin: false, roles: [] });
  const project = await createProject({ status: 'live' });
  const unit = await createUnit({ projectId: project.id, status: 'live', instantBook: true, baseNightlyThb: 1000, minNights: 1 });
  const setMethods = (methods: string[]) => setConfigOverride(db, key, methods, {
    scopeType: 'project', scopeId: project.id, changedByIdentityId: guest.id,
  });
  return { guest, project, unit, setMethods };
}

async function fixture(purpose: typeof purposes[number], standalone = false) {
  const f = await baseFixture();
  if (purpose === 'service_order') {
    const provider = await createProvider({ status: 'active' });
    const service = await createService({ providerId: provider.id, status: 'active' });
    const order = await db.serviceOrder.create({ data: {
      service_id: service.id, provider_id: provider.id, project_id: standalone ? null : f.project.id,
      service_context: standalone ? { area: 'Synthetic test area' } : {},
      orderer_identity_id: f.guest.id, orderer_role: 'guest', scheduled_start: startDate, scheduled_end: endDate,
      total_thb: 1000, price_breakdown: { total_thb: 1000 }, take_rate_pct_snapshot: 15, status: 'placed',
    } });
    return { ...f, sourceId: order.id, input: { purpose, serviceOrderId: order.id, payerIdentityId: f.guest.id, amountThb: order.total_thb } };
  }
  const price = await computePriceBreakdown(db, f.unit.id, startDate, endDate, 2);
  const booking = await createBooking({ unitId: f.unit.id, projectId: f.project.id, guestIdentityId: f.guest.id,
    startDate, endDate, totalThb: price.total_thb,
    status: purpose === 'stay' ? 'pending_payment' : 'confirmed', holdExpiresAt: new Date(Date.now() + 600_000) });
  if (purpose === 'stay_balance') await db.booking.update({ where: { id: booking.id }, data: { balanceDueThb: 1000 } });
  return { ...f, sourceId: booking.id, input: { purpose, bookingId: booking.id, payerIdentityId: f.guest.id,
    amountThb: purpose === 'stay' ? booking.totalThb : 1000 } };
}

async function directBody(f: Awaited<ReturnType<typeof baseFixture>>) {
  const price = await computePriceBreakdown(db, f.unit.id, startDate, endDate, 2);
  return { unitId: f.unit.id, startDate: '2027-06-01', endDate: '2027-06-03', adultsCount: 2, childrenCount: 0,
    instantBook: true, paymentMethod: 'card_provider', acceptedTotalSatang: price.total_thb, idempotencyKey: randomUUID() };
}

describe('card creation policy and existing payment recovery', () => {
  beforeEach(async () => {
    await resetDb();
    await seedConfig(db);
    vi.stubEnv('PAYMENT_PROVIDER', 'opn');
    providerCreate.mockReset().mockImplementation(async (input: { paymentId: string; amount: number }) => ({
      id: `chrg_${input.paymentId}`, url: `https://example.invalid/pay/${input.paymentId}?token=synthetic`,
      amount: input.amount, status: 'pending', expiresAt: new Date(Date.now() + 3_600_000),
    }));
  });
  afterEach(() => vi.unstubAllEnvs());

  it.each(purposes)('rejects a new %s checkout when project cards are disabled', async purpose => {
    const f = await fixture(purpose);
    await f.setMethods(['cash', 'bank_transfer']);
    await expect(createCheckout(db, f.input)).rejects.toMatchObject({ code: 'PAYMENT_METHOD_UNAVAILABLE' });
    expect(providerCreate).not.toHaveBeenCalled();
    expect(await db.payment.count()).toBe(0);
    expect(await db.ledgerEntry.count()).toBe(0);
  });

  it.each(purposes)('recovers the same %s session after disabling cards', async purpose => {
    const f = await fixture(purpose);
    await f.setMethods(['card_provider']);
    const first = await createCheckout(db, f.input);
    const before = await db.payment.findUniqueOrThrow({ where: { id: first.paymentId } });
    await f.setMethods(['cash']);
    expect(await createCheckout(db, f.input)).toEqual(first);
    expect(await db.payment.findUniqueOrThrow({ where: { id: first.paymentId } })).toEqual(before);
    expect(providerCreate).toHaveBeenCalledTimes(1);
    expect(await db.payment.count()).toBe(1);
  });

  it.each(purposes)('preserves ambiguous %s evidence and reconciliation after disabling cards', async purpose => {
    const f = await fixture(purpose);
    await f.setMethods(['card_provider']);
    providerCreate.mockRejectedValue(new Error('Synthetic lost provider response'));
    await expect(createCheckout(db, f.input)).rejects.toMatchObject({ code: 'CHECKOUT_RECONCILIATION_REQUIRED' });
    const before = await db.payment.findFirstOrThrow();
    await f.setMethods(['cash']);
    await expect(createCheckout(db, f.input)).rejects.toMatchObject({ code: 'CHECKOUT_RECONCILIATION_REQUIRED' });
    expect(await db.payment.findFirstOrThrow()).toMatchObject({ id: before.id, status: 'created',
      reconciliationReason: 'CHECKOUT_PROVIDER_OUTCOME_UNKNOWN', amountThb: f.input.amountThb });
    expect(providerCreate).toHaveBeenCalledTimes(1);
    expect(await db.payment.count()).toBe(1);
  });

  it('rejects a new guest resume without changing the held booking', async () => {
    const f = await fixture('stay');
    await f.setMethods(['cash']);
    const before = await db.booking.findUniqueOrThrow({ where: { id: f.sourceId } });
    const response = await resume(request(), { params: { id: f.sourceId } });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'PAYMENT_METHOD_UNAVAILABLE' });
    expect(await db.booking.findUniqueOrThrow({ where: { id: f.sourceId } })).toEqual(before);
    expect(providerCreate).not.toHaveBeenCalled();
    expect(await db.payment.count()).toBe(0);
  });

  it('recovers the guest resume route after disabling cards', async () => {
    const f = await fixture('stay');
    await f.setMethods(['card_provider']);
    const first = await resume(request(), { params: { id: f.sourceId } });
    expect(first.status).toBe(200);
    await f.setMethods(['cash']);
    const recovered = await resume(request(), { params: { id: f.sourceId } });
    expect(recovered.status).toBe(200);
    expect(await recovered.json()).toEqual(await first.json());
    expect(providerCreate).toHaveBeenCalledTimes(1);
    expect(await db.payment.count()).toBe(1);
  });

  it('rejects disabled direct checkout before booking creation', async () => {
    const f = await baseFixture();
    await f.setMethods(['cash']);
    const response = await direct(request(await directBody(f)));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'PAYMENT_METHOD_UNAVAILABLE' });
    expect(providerCreate).not.toHaveBeenCalled();
    expect(await db.booking.count()).toBe(0);
    expect(await db.payment.count()).toBe(0);
  });

  it.each(['direct', 'writer'] as const)('uses fresh policy for %s after another process disables cards', async path => {
    const f = path === 'direct' ? await baseFixture() : await fixture('stay');
    await f.setMethods(['card_provider']);
    expect(await getConfig(db, key, { projectId: f.project.id })).toEqual(['card_provider']);
    // A second server/process cannot invalidate this process's in-memory cache.
    await db.configOverride.update({ where: { parameterKey_scopeType_scopeId: {
      parameterKey: key, scopeType: 'project', scopeId: f.project.id,
    } }, data: { value: ['cash'] } });
    if ('input' in f) {
      await expect(createCheckout(db, f.input)).rejects.toMatchObject({ code: 'PAYMENT_METHOD_UNAVAILABLE' });
    } else {
      const response = await direct(request(await directBody(f)));
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: 'PAYMENT_METHOD_UNAVAILABLE' });
      expect(await db.booking.count()).toBe(0);
    }
    expect(providerCreate).not.toHaveBeenCalled();
    expect(await db.payment.count()).toBe(0);
  });

  it('does not borrow card permission from a different project', async () => {
    const f = await fixture('stay');
    const other = await createProject();
    await setConfigOverride(db, key, ['card_provider'], { scopeType: 'project', scopeId: other.id, changedByIdentityId: f.guest.id });
    await expect(createCheckout(db, f.input)).rejects.toMatchObject({ code: 'PAYMENT_METHOD_UNAVAILABLE' });
    expect(providerCreate).not.toHaveBeenCalled();
  });

  it('fails closed when payment configuration is absent', async () => {
    const f = await fixture('stay');
    await db.configParameter.delete({ where: { key } });
    await expect(createCheckout(db, f.input)).rejects.toMatchObject({ code: 'PAYMENT_METHOD_UNAVAILABLE' });
    expect(providerCreate).not.toHaveBeenCalled();
    expect(await db.payment.count()).toBe(0);
  });

  it('keeps an in-flight claim recoverable when cards are disabled during provider preparation', async () => {
    const f = await fixture('stay');
    await f.setMethods(['card_provider']);
    const implementation = providerCreate.getMockImplementation()!;
    let started!: () => void;
    let release!: () => void;
    const preparing = new Promise<void>(resolve => { started = resolve; });
    const released = new Promise<void>(resolve => { release = resolve; });
    providerCreate.mockImplementation(async input => { started(); await released; return implementation(input); });
    const first = resume(request(), { params: { id: f.sourceId } });
    await preparing;
    try {
      await f.setMethods(['cash']);
      const response = await resume(request(), { params: { id: f.sourceId } });
      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ code: 'CHECKOUT_PREPARING' });
      expect(providerCreate).toHaveBeenCalledTimes(1);
    } finally { release(); }
    const firstResponse = await first;
    expect(firstResponse.status).toBe(200);
    expect(await (await resume(request(), { params: { id: f.sourceId } })).json()).toEqual(await firstResponse.json());
    expect(await db.payment.count()).toBe(1);
  });

  it('rejects a new project service checkout through its authenticated route', async () => {
    const f = await fixture('service_order');
    const response = await serviceCheckout(request(), { params: { id: f.sourceId } });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'PAYMENT_METHOD_UNAVAILABLE' });
    expect(providerCreate).not.toHaveBeenCalled();
    expect(await db.payment.count()).toBe(0);
    expect((await db.serviceOrder.findUniqueOrThrow({ where: { id: f.sourceId } })).status).toBe('placed');
  });

  it('uses global policy for standalone commerce and recovers its existing session', async () => {
    const f = await fixture('service_order', true);
    await f.setMethods(['card_provider']); // Unrelated project cannot authorize this standalone order.
    let response = await serviceCheckout(request(), { params: { id: f.sourceId } });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'PAYMENT_METHOD_UNAVAILABLE' });
    expect(providerCreate).not.toHaveBeenCalled();
    await db.configOverride.create({ data: { parameterKey: key, scopeType: 'global', scopeId: 'global',
      value: ['card_provider'], updatedByIdentityId: f.guest.id } });
    response = await serviceCheckout(request(), { params: { id: f.sourceId } });
    expect(response.status).toBe(200);
    const first = await response.json();
    await db.configOverride.update({ where: { parameterKey_scopeType_scopeId: {
      parameterKey: key, scopeType: 'global', scopeId: 'global',
    } }, data: { value: ['cash'] } });
    response = await serviceCheckout(request(), { params: { id: f.sourceId } });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(first);
    expect(providerCreate).toHaveBeenCalledTimes(1);
    expect(await db.payment.count()).toBe(1);
  });

  it.each(['confirmed', 'checked_in'] as const)('reports the committed %s date change and unpaid balance when cards are disabled', async status => {
    const f = await fixture('stay_balance');
    await db.booking.update({ where: { id: f.sourceId }, data: { status, balanceDueThb: 0 } });
    const response = await modify(request({ endDate: '2027-06-04' }), { params: { id: f.sourceId } });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.pricing.checkoutUrl).toBeNull();
    expect(body.pricing.checkoutIssue).toMatchObject({ code: 'PAYMENT_METHOD_UNAVAILABLE' });
    expect(body.pricing.checkoutIssue.message).toContain('saved');
    const booking = await db.booking.findUniqueOrThrow({ where: { id: f.sourceId } });
    expect(booking).toMatchObject({ status, endDate: new Date('2027-06-04'), balanceDueThb: body.pricing.balanceThb });
    expect(booking.balanceDueThb).toBeGreaterThan(0);
    expect(providerCreate).not.toHaveBeenCalled();
    expect(await db.payment.count()).toBe(0);
    expect(await db.ledgerEntry.count()).toBe(0);
  });

  it.each(['confirmed', 'checked_in'] as const)('still creates one authorized checkout for a %s balance', async status => {
    const f = await fixture('stay_balance');
    await f.setMethods(['card_provider']);
    await db.booking.update({ where: { id: f.sourceId }, data: { status, balanceDueThb: 0 } });
    const response = await modify(request({ endDate: '2027-06-04' }), { params: { id: f.sourceId } });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.pricing.checkoutUrl).toContain('https://example.invalid/pay/');
    expect(providerCreate).toHaveBeenCalledTimes(1);
    expect(await db.payment.count()).toBe(1);
    const booking = await db.booking.findUniqueOrThrow({ where: { id: f.sourceId } });
    expect(await db.payment.findFirstOrThrow()).toMatchObject({ purpose: 'stay_balance', amountThb: booking.balanceDueThb });
  });

  it.each(['confirmed', 'checked_in'] as const)('does not request payment for a %s increase fully covered by existing refund credit', async status => {
    const f = await fixture('stay_balance');
    const nextPrice = await computePriceBreakdown(db, f.unit.id, startDate, new Date('2027-06-04'), 2);
    const booking = await db.booking.findUniqueOrThrow({ where: { id: f.sourceId } });
    const credit = nextPrice.total_thb - booking.totalThb;
    expect(credit).toBeGreaterThan(0);
    await db.booking.update({ where: { id: f.sourceId }, data: { status, balanceDueThb: 0, refundAccruedThb: credit } });
    const response = await modify(request({ endDate: '2027-06-04' }), { params: { id: f.sourceId } });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.pricing).toMatchObject({ checkoutUrl: null, checkoutIssue: null });
    expect(await db.booking.findUniqueOrThrow({ where: { id: f.sourceId } })).toMatchObject({
      endDate: new Date('2027-06-04'), balanceDueThb: 0, refundAccruedThb: 0,
    });
    expect(providerCreate).not.toHaveBeenCalled();
    expect(await db.payment.count()).toBe(0);
  });

  it('keeps saved dates and existing balance evidence when a later increase requires reconciliation', async () => {
    const f = await fixture('stay_balance');
    await f.setMethods(['card_provider']);
    const first = await createCheckout(db, f.input);
    await f.setMethods(['cash']);
    const response = await modify(request({ endDate: '2027-06-04' }), { params: { id: f.sourceId } });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.pricing).toMatchObject({ checkoutUrl: null, checkoutIssue: { code: 'CHECKOUT_RECONCILIATION_REQUIRED' } });
    const booking = await db.booking.findUniqueOrThrow({ where: { id: f.sourceId } });
    expect(booking.balanceDueThb).toBe(f.input.amountThb + body.pricing.balanceThb);
    expect(booking.endDate).toEqual(new Date('2027-06-04'));
    expect(await db.payment.findUniqueOrThrow({ where: { id: first.paymentId } })).toMatchObject({
      amountThb: f.input.amountThb, status: 'pending', reconciliationReason: 'CHECKOUT_DETAILS_CHANGED',
    });
    expect(providerCreate).toHaveBeenCalledTimes(1);
    expect(await db.payment.count()).toBe(1);
  });
});
