import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { createBooking, createIdentity, createProject, createUnit, db, resetDb } from '@/test/util';
import { computePriceBreakdown } from '@/modules/core';
import { seedConfig, setConfigOverride } from '@/modules/config';
import { createCheckout } from '@/modules/finance';
import { decrypt } from '@/lib/encryption';
import { getReconciliationData } from '@/modules/finance/payout.service';

const { currentUser, providerCreate } = vi.hoisted(() => ({ currentUser: vi.fn(), providerCreate: vi.fn() }));
vi.mock('@/app/actions/getCurrentUser', () => ({ getCurrentUser: currentUser }));
vi.mock('@/lib/prisma', async () => ({ prisma: (await import('@/test/util')).db }));
vi.mock('@/modules/finance/providers', () => ({
  getProviderConfig: () => ({ provider: 'opn' }),
  getPaymentProvider: () => ({ createCheckout: providerCreate }),
}));
import { POST as create, GET as recover } from './route';
import { POST as resume } from './[id]/checkout/route';
import { GET as detail } from './[id]/route';

// A real Prisma middleware barrier, just before the first Payment insert.
// This exposes the booking-committed/payment-not-yet-visible window exactly.
let insertGate: { count: number; entered: () => void; released: Promise<void> } | null = null;
db.$use(async (params, next) => {
  if (insertGate && params.model === 'Payment' && params.action === 'create') {
    const gate = insertGate;
    gate.count++;
    if (gate.count === 1) { gate.entered(); await gate.released; }
  }
  return next(params);
});

const stay = { startDate: '2027-06-01', endDate: '2027-06-04', adultsCount: 2, childrenCount: 0 };
const request = (body: unknown) => new NextRequest('http://localhost/api/bookings', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});
const resumeBooking = (id: string) => resume(request({}), { params: { id } });

async function fixture(withBooking = false) {
  const guest = await createIdentity();
  currentUser.mockResolvedValue({ identityId: guest.id, isAdmin: false, roles: [] });
  const project = await createProject({ status: 'live' });
  const unit = await createUnit({ projectId: project.id, status: 'live', instantBook: true });
  await setConfigOverride(db, 'booking.payment.methods_enabled', ['card_provider'], {
    scopeType: 'project', scopeId: project.id, changedByIdentityId: guest.id,
  });
  const price = await computePriceBreakdown(db, unit.id, new Date(stay.startDate), new Date(stay.endDate), 2);
  const body = { ...stay, unitId: unit.id, instantBook: true, paymentMethod: 'card_provider',
    acceptedTotalSatang: price.total_thb, idempotencyKey: randomUUID() };
  const booking = withBooking ? await createBooking({ unitId: unit.id, projectId: project.id, guestIdentityId: guest.id,
    startDate: new Date(stay.startDate), endDate: new Date(stay.endDate), totalThb: price.total_thb,
    status: 'pending_payment', holdExpiresAt: new Date(Date.now() + 600_000) }) : null;
  return { guest, project, unit, body, booking };
}

async function waitForOtherWriter(unitId: string, gate: NonNullable<typeof insertGate>) {
  const deadline = Date.now() + 4_000;
  while (gate.count < 2) {
    const [row] = await db.$queryRaw<Array<{ waiting: boolean }>>`
      SELECT EXISTS (SELECT 1 FROM pg_locks WHERE locktype = 'advisory' AND NOT granted
        AND database = (SELECT oid FROM pg_database WHERE datname = current_database())
        AND objid = ((hashtext(${unitId})::bigint & 4294967295)::oid)) AS waiting
    `;
    if (row.waiting) return;
    if (Date.now() > deadline) throw new Error('The competing writer never reached the insert or inventory lock');
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

describe('durable provider checkout recovery', () => {
  beforeEach(async () => {
    await resetDb();
    await seedConfig(db);
    vi.stubEnv('PAYMENT_PROVIDER', 'opn');
    providerCreate.mockReset().mockImplementation(async (input: { paymentId: string; amount: number }) => ({
      id: `chrg_${input.paymentId}`, url: `https://example.invalid/pay/${input.paymentId}?token=synthetic`,
      amount: input.amount, status: 'pending', expiresAt: new Date(Date.now() + 3_600_000),
    }));
  });
  afterEach(() => { insertGate = null; vi.unstubAllEnvs(); });

  it('recovers the same external URL after losing the original booking response', async () => {
    const f = await fixture();
    const original = await create(request(f.body));
    expect(original.status).toBe(201);
    const first = await original.json(); // Represents a response lost by the guest.
    const replay = await create(request(f.body));
    expect(replay.status).toBe(200);
    expect((await replay.json()).booking.id).toBe(first.booking.id);
    const response = await resumeBooking(first.booking.id);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(first.checkout);
    expect(providerCreate).toHaveBeenCalledTimes(1);
    expect(await db.payment.count()).toBe(1);
    const payment = await db.payment.findFirstOrThrow();
    const ciphertext = (payment as typeof payment & { checkoutUrlEncrypted: string }).checkoutUrlEncrypted;
    expect(ciphertext).not.toContain('synthetic');
    expect(decrypt(ciphertext)).toBe(first.checkout.checkoutUrl);
  });

  it.each(['initial_vs_resume', 'two_resumes'] as const)('claims at most one provider session during %s before Payment is visible', async scenario => {
    const f = await fixture(scenario === 'two_resumes');
    let enter!: () => void;
    let release!: () => void;
    const entered = new Promise<void>(resolve => { enter = resolve; });
    const released = new Promise<void>(resolve => { release = resolve; });
    const gate = { count: 0, entered: enter, released };
    insertGate = gate;
    const first = f.booking ? resumeBooking(f.booking.id) : create(request(f.body));
    await entered;
    const booking = await db.booking.findFirstOrThrow({ where: { unitId: f.unit.id } });
    // Guest can recover the committed booking while the first checkout is opening.
    if (!f.booking) {
      const recovery = await recover(new NextRequest(`http://localhost/api/bookings?idempotencyKey=${f.body.idempotencyKey}`));
      expect(recovery.status).toBe(200);
      expect((await recovery.json()).booking.id).toBe(booking.id);
    }
    const second = resumeBooking(booking.id);
    try { await waitForOtherWriter(f.unit.id, gate); }
    finally { release(); }
    const responses = await Promise.all([first, second]);
    expect(responses[0].ok).toBe(true);
    expect([200, 409]).toContain(responses[1].status);
    if (responses[1].status === 409) expect((await responses[1].json()).code).toBe('CHECKOUT_PREPARING');
    expect(providerCreate).toHaveBeenCalledTimes(1);
    expect(await db.payment.count()).toBe(1);
    const recovered = await resumeBooking(booking.id);
    expect(recovered.status).toBe(200);
    expect((await recovered.json()).paymentId).toBe((await db.payment.findFirstOrThrow()).id);
  });

  it('reports preparation during a provider barrier then reuses the completed session', async () => {
    const f = await fixture(true);
    const implementation = providerCreate.getMockImplementation()!;
    let start!: () => void;
    let release!: () => void;
    const started = new Promise<void>(resolve => { start = resolve; });
    const released = new Promise<void>(resolve => { release = resolve; });
    providerCreate.mockImplementation(async input => { start(); await released; return implementation(input); });
    const first = resumeBooking(f.booking!.id);
    await started;
    let second: Response;
    try { second = await resumeBooking(f.booking!.id); }
    finally { release(); }
    expect(second!.status).toBe(409);
    expect((await second!.json()).code).toBe('CHECKOUT_PREPARING');
    const firstResponse = await first;
    expect(firstResponse.status).toBe(200);
    expect(await (await resumeBooking(f.booking!.id)).json()).toEqual(await firstResponse.json());
    expect(providerCreate).toHaveBeenCalledTimes(1);
  });

  it('does not create a second charge after an ambiguous provider response', async () => {
    const f = await fixture(true);
    providerCreate.mockRejectedValue(new Error('Synthetic lost provider response after possible acceptance'));
    const input = { purpose: 'stay' as const, bookingId: f.booking!.id, payerIdentityId: f.guest.id, amountThb: f.booking!.totalThb };
    await expect(createCheckout(db, input)).rejects.toThrow();
    await expect(createCheckout(db, input)).rejects.toMatchObject({ code: 'CHECKOUT_RECONCILIATION_REQUIRED' });
    expect(providerCreate).toHaveBeenCalledTimes(1);
    expect(await db.payment.count()).toBe(1);
    expect(await db.payment.findFirstOrThrow()).toMatchObject({ status: 'created', reconciliationReason: 'CHECKOUT_PROVIDER_OUTCOME_UNKNOWN' });
    expect(await db.ledgerEntry.count()).toBe(0);
  });

  it('requires reconciliation for a historical real session without a recoverable URL', async () => {
    const f = await fixture(true);
    await db.payment.create({ data: { purpose: 'stay', bookingId: f.booking!.id, payerIdentityId: f.guest.id,
      amountThb: f.booking!.totalThb, method: 'card_provider', provider: 'opn', status: 'pending', providerSessionId: 'chrg_old' } });
    const response = await resumeBooking(f.booking!.id);
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe('CHECKOUT_RECONCILIATION_REQUIRED');
    expect(providerCreate).not.toHaveBeenCalled();
    expect(await db.payment.count()).toBe(1);
  });

  it('refuses a payer mismatch at the canonical writer before any provider operation', async () => {
    const f = await fixture(true);
    const stranger = await createIdentity();
    await expect(createCheckout(db, { purpose: 'stay', bookingId: f.booking!.id,
      payerIdentityId: stranger.id, amountThb: f.booking!.totalThb })).rejects.toThrow();
    expect(providerCreate).not.toHaveBeenCalled();
    expect(await db.payment.count()).toBe(0);
  });

  it('surfaces an abandoned durable claim without automatically creating another session', async () => {
    const f = await fixture(true);
    const old = await db.payment.create({ data: { purpose: 'stay', bookingId: f.booking!.id, payerIdentityId: f.guest.id,
      amountThb: f.booking!.totalThb, method: 'card_provider', provider: 'opn', status: 'created', createdAt: new Date(Date.now() - 180_000) } });
    expect((await getReconciliationData(db)).unmatchedPayments.map(p => p.id)).toContain(old.id);
    const view = await detail(request({}), { params: { id: f.booking!.id } });
    expect(view.status).toBe(200);
    expect(await view.json()).toMatchObject({ paymentReviewRequired: true, paymentFailed: false });
    const response = await resumeBooking(f.booking!.id);
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe('CHECKOUT_RECONCILIATION_REQUIRED');
    expect(providerCreate).not.toHaveBeenCalled();
    expect(await db.payment.count()).toBe(1);
  });

  it('does not return an expired provider URL or silently create a replacement', async () => {
    const f = await fixture(true);
    expect((await resumeBooking(f.booking!.id)).status).toBe(200);
    await db.payment.updateMany({ data: { checkoutExpiresAt: new Date(Date.now() - 1_000) } });
    const response = await resumeBooking(f.booking!.id);
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe('CHECKOUT_RECONCILIATION_REQUIRED');
    expect(providerCreate).toHaveBeenCalledTimes(1);
  });

  it('withholds the provider redirect when the booking expires during provider creation', async () => {
    const f = await fixture(true);
    const implementation = providerCreate.getMockImplementation()!;
    providerCreate.mockImplementation(async input => {
      await db.booking.update({ where: { id: f.booking!.id }, data: { holdExpiresAt: new Date(Date.now() - 1_000) } });
      return implementation(input);
    });
    const response = await resumeBooking(f.booking!.id);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'BOOKING_NOT_PAYABLE' });
    expect(await db.payment.findFirstOrThrow()).toMatchObject({ status: 'pending',
      providerSessionId: expect.any(String), reconciliationReason: 'CHECKOUT_BOOKING_UNAVAILABLE' });
    expect((await resumeBooking(f.booking!.id)).status).toBe(409);
    expect(providerCreate).toHaveBeenCalledTimes(1);
    expect(await db.ledgerEntry.count()).toBe(0);
  });

  it('does not expose a reusable URL to another guest or an anonymous request', async () => {
    const f = await fixture(true);
    expect((await resumeBooking(f.booking!.id)).status).toBe(200);
    currentUser.mockResolvedValue({ identityId: (await createIdentity()).id, isAdmin: false });
    expect((await resumeBooking(f.booking!.id)).status).toBe(404);
    currentUser.mockResolvedValue(null);
    expect((await resumeBooking(f.booking!.id)).status).toBe(401);
    expect(providerCreate).toHaveBeenCalledTimes(1);
  });
});
