import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBooking, createIdentity, createProject, createUnit, db, resetDb } from '@/test/util';
import { importICalEvents } from '@/modules/integrations/ical-import';
import { registerIntegrationAccount } from '@/modules/integrations/integrations';
import { confirmBooking } from '@/modules/booking/booking.service';
import { getReconciliationData } from './payout.service';
import { markRefundSucceeded, recordCashPayment, verifyAndConfirm } from './finance.service';
import { recordBankTransfer } from './bank-transfer.service';

const { confirmPayment } = vi.hoisted(() => ({ confirmPayment: vi.fn() }));
vi.mock('./providers', () => ({
  getProviderConfig: () => ({ provider: 'opn' }),
  getPaymentProvider: () => ({ confirmPayment }),
}));

async function fixture(expired = true) {
  const guest = await createIdentity();
  const operator = await createIdentity();
  const project = await createProject();
  const unit = await createUnit(project.id);
  const booking = await createBooking({ unitId: unit.id, projectId: project.id, guestIdentityId: guest.id,
    startDate: new Date('2027-05-10'), endDate: new Date('2027-05-14'), status: 'pending_payment',
    totalThb: 400_000, holdExpiresAt: new Date(Date.now() + (expired ? -60_000 : 600_000)) });
  const payment = await db.payment.create({ data: { bookingId: booking.id, purpose: 'stay',
    payerIdentityId: guest.id, method: 'card_provider', provider: 'opn',
    providerSessionId: `chrg_synthetic_${booking.id}`, amountThb: booking.totalThb, status: 'pending' } });
  const integration = await registerIntegrationAccount(db, 'ical_airbnb', 'unit',
    { ical_url: 'https://example.invalid/synthetic.ics' }, unit.id);
  const event = { uid: 'synthetic-ota', summary: 'Synthetic occupancy', dtStart: booking.startDate, dtEnd: booking.endDate };
  return { guest, operator, project, unit, booking, payment, integration, event };
}

async function waitForInventoryWaiters(unitId: string, count: number, settled: () => boolean) {
  const deadline = Date.now() + 4_000;
  while (!settled()) {
    const [row] = await db.$queryRaw<Array<{ count: bigint }>>`
      SELECT count(*) FROM pg_locks WHERE locktype = 'advisory' AND NOT granted
        AND database = (SELECT oid FROM pg_database WHERE datname = current_database())
        AND objid = ((hashtext(${unitId})::bigint & 4294967295)::oid)
    `;
    if (Number(row.count) >= count) return;
    if (Date.now() > deadline) throw new Error('Writer neither settled nor waited on the inventory lock');
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

describe('verified captures cannot resurrect released inventory', () => {
  beforeEach(async () => {
    await resetDb();
    confirmPayment.mockReset().mockResolvedValue({ status: 'confirmed', amount: 400_000 });
  });
  afterEach(() => vi.unstubAllEnvs());

  it('records a late captured payment once for reconciliation after OTA claims an expired hold', async () => {
    const f = await fixture();
    expect((await importICalEvents(db, f.integration.id, f.unit.id, [f.event])).imported).toBe(1);
    const result = await verifyAndConfirm(db, f.payment.id);
    expect(result).toMatchObject({ confirmed: false, reconciliationRequired: true,
      payment: { status: 'succeeded', reconciliationReason: expect.any(String) } });
    expect(await db.booking.findUniqueOrThrow({ where: { id: f.booking.id } })).toMatchObject({ status: 'expired' });
    expect(await db.blockedDate.count({ where: { unitId: f.unit.id } })).toBe(1);
    const entries = await db.ledgerEntry.findMany({ where: { paymentId: f.payment.id } });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ entryType: 'payment_unallocated', amountThb: 400_000,
      unitId: null, projectId: null, bookingId: f.booking.id });
    expect((await getReconciliationData(db)).unmatchedPayments.map(p => p.id)).toContain(f.payment.id);
    expect(await verifyAndConfirm(db, f.payment.id)).toMatchObject({ confirmed: false, reconciliationRequired: true });
    expect(await db.ledgerEntry.count({ where: { paymentId: f.payment.id } })).toBe(1);
    expect(await db.refund.count()).toBe(0); // Captured is not the same as refunded.
  });

  it('serializes concurrent OTA import then late capture using the unit inventory lock', async () => {
    const f = await fixture();
    let unlock!: () => void;
    let ready!: () => void;
    const released = new Promise<void>(resolve => { unlock = resolve; });
    const locked = new Promise<void>(resolve => { ready = resolve; });
    const holder = db.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${f.unit.id}))`;
      ready();
      await released;
    }, { timeout: 15_000 });
    await locked;
    let imported = false;
    let captured = false;
    const ota = importICalEvents(db, f.integration.id, f.unit.id, [f.event]).finally(() => { imported = true; });
    await waitForInventoryWaiters(f.unit.id, 1, () => imported);
    const capture = verifyAndConfirm(db, f.payment.id).then(
      value => ({ value }), error => ({ error }),
    ).finally(() => { captured = true; });
    try {
      await waitForInventoryWaiters(f.unit.id, 2, () => captured);
    } finally {
      unlock();
      await holder;
    }
    expect(await ota).toMatchObject({ imported: 1, conflicts: [], errors: [] });
    expect(await capture).toMatchObject({ value: { confirmed: false, reconciliationRequired: true } });
    expect((await db.booking.findUniqueOrThrow({ where: { id: f.booking.id } })).status).toBe('expired');
    expect(await db.ledgerEntry.count({ where: { entryType: 'rental_revenue', paymentId: f.payment.id } })).toBe(0);
  });

  it('keeps a valid capture authoritative when confirmation reaches the calendar before OTA', async () => {
    const f = await fixture(false);
    expect(await verifyAndConfirm(db, f.payment.id)).toMatchObject({ confirmed: true });
    const ota = await importICalEvents(db, f.integration.id, f.unit.id, [f.event]);
    expect(ota.imported).toBe(0);
    expect(ota.conflicts.map(c => c.conflictingBooking.id)).toEqual([f.booking.id]);
    expect(await db.blockedDate.count({ where: { unitId: f.unit.id } })).toBe(0);
  });

  it.each(['expired', 'cancelled'] as const)('retains provider evidence when the booking is already %s', async status => {
    const f = await fixture();
    await db.booking.update({ where: { id: f.booking.id }, data: { status, holdExpiresAt: null } });
    expect(await verifyAndConfirm(db, f.payment.id)).toMatchObject({ confirmed: false, reconciliationRequired: true,
      payment: { status: 'succeeded' } });
    expect((await db.booking.findUniqueOrThrow({ where: { id: f.booking.id } })).status).toBe(status);
  });

  it('records an unallocated refund without debiting property or owner income', async () => {
    const f = await fixture();
    await verifyAndConfirm(db, f.payment.id);
    const refund = await db.refund.create({ data: { paymentId: f.payment.id, method: 'card_provider',
      amountThb: 400_000, reason: 'cancellation', status: 'processing', initiatedByIdentityId: f.operator.id } });
    await markRefundSucceeded(db, refund.id); // Synthetic completion, no provider call.
    expect(await db.ledgerEntry.findFirstOrThrow({ where: { refundId: refund.id } })).toMatchObject({
      entryType: 'refund_out', amountThb: -400_000, unitId: null, projectId: null,
    });
    expect((await db.ledgerEntry.aggregate({ where: { paymentId: f.payment.id }, _sum: { amountThb: true } }))._sum.amountThb).toBe(0);
  });

  it('rejects direct confirmation of an expired checkout hold', async () => {
    const f = await fixture();
    await expect(confirmBooking(db, { bookingId: f.booking.id })).rejects.toThrow();
    expect((await db.booking.findUniqueOrThrow({ where: { id: f.booking.id } })).status).not.toBe('confirmed');
  });

  it.each(['direct', 'cash', 'bank'] as const)('prevents %s confirmation over an existing calendar block', async method => {
    const f = await fixture(false);
    await db.blockedDate.create({ data: { unitId: f.unit.id, startDate: f.booking.startDate,
      endDate: f.booking.endDate, reason: 'maintenance' } });
    const common = { purpose: 'stay' as const, bookingId: f.booking.id, payerIdentityId: f.guest.id, amountThb: 400_000 };
    const attempt = method === 'direct' ? confirmBooking(db, { bookingId: f.booking.id })
      : method === 'cash' ? recordCashPayment(db, { ...common, receivedByIdentityId: f.operator.id, receiptRef: 'synthetic' })
        : recordBankTransfer(db, { ...common, confirmedByIdentityId: f.operator.id, bankReference: 'synthetic' });
    await expect(attempt).rejects.toThrow();
    expect((await db.booking.findUniqueOrThrow({ where: { id: f.booking.id } })).status).toBe('pending_payment');
    expect(await db.ledgerEntry.count()).toBe(0);
  });
});
