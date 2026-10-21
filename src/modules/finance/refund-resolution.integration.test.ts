import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { createBooking, createIdentity, createProject, createUnit, db, resetDb } from '@/test/util';
import { resolveFailedRefund } from './payout.service';
import { recoverRequestedBookingRefunds } from './refund-recovery';
const { gatewayRefund } = vi.hoisted(() => ({ gatewayRefund: vi.fn() }));
vi.mock('./providers', () => ({
  getProviderConfig: () => ({ provider: 'opn' }),
  getPaymentProvider: () => ({ refund: gatewayRefund }),
}));

async function fixture(status: 'failed' | 'succeeded' | 'requested' = 'failed', providerRefundId: string | null = 'rfnd_declined') {
  const guest = await createIdentity();
  const staff = await createIdentity();
  const project = await createProject();
  const unit = await createUnit(project.id);
  const booking = await createBooking({ unitId: unit.id, projectId: project.id, guestIdentityId: guest.id,
    startDate: new Date('2027-05-10'), endDate: new Date('2027-05-14'), status: 'cancelled', totalThb: 400_000 });
  await db.booking.update({ where: { id: booking.id }, data: { refundAccruedThb: 400_000 } });
  const payment = await db.payment.create({ data: { bookingId: booking.id, purpose: 'stay', payerIdentityId: guest.id,
    method: 'card_provider', provider: 'opn', providerSessionId: 'chrg_synthetic', amountThb: 400_000, status: 'succeeded' } });
  const refund = await db.refund.create({ data: { paymentId: payment.id, method: 'card_provider', amountThb: 400_000,
    reason: 'cancellation', status, providerRefundId, initiatedByIdentityId: staff.id } });
  return { booking, payment, refund };
}

beforeEach(async () => {
  await resetDb(); vi.stubEnv('PAYMENT_PROVIDER', 'opn');
  gatewayRefund.mockReset().mockResolvedValue({ refundId: 'rfnd_retried', status: 'completed', amount: 400_000 });
});
afterEach(() => vi.unstubAllEnvs());

describe('PMS refund resolution and recovery', () => {
  it('serializes concurrent/repeated write-offs into one adjustment', async () => {
    const f = await fixture();
    await Promise.all([resolveFailedRefund(db, f.refund.id, 'write_off'), resolveFailedRefund(db, f.refund.id, 'write_off')]);
    await resolveFailedRefund(db, f.refund.id, 'write_off');
    expect(await db.ledgerEntry.count({ where: { refundId: f.refund.id, entryType: 'adjustment' } })).toBe(1);
    expect((await db.booking.findUniqueOrThrow({ where: { id: f.booking.id } })).refundAccruedThb).toBe(400_000);
    expect(gatewayRefund).not.toHaveBeenCalled();
  });
  it('never reopens a succeeded refund', async () => {
    const f = await fixture('succeeded');
    expect((await resolveFailedRefund(db, f.refund.id, 'retry')).status).toBe('succeeded');
    await expect(resolveFailedRefund(db, f.refund.id, 'write_off')).rejects.toMatchObject({ code: 'REFUND_RESOLUTION_CONFLICT' });
    expect(await db.ledgerEntry.count()).toBe(0);
    expect(gatewayRefund).not.toHaveBeenCalled();
  });
  it('dispatches one known failed card retry despite concurrent requests and settles the liability', async () => {
    const f = await fixture();
    await db.payment.update({ where: { id: f.payment.id }, data: { reconciliationReason: 'SERVICE_REFUND_REVIEW_REQUIRED' } });
    await Promise.all([resolveFailedRefund(db, f.refund.id, 'retry'), resolveFailedRefund(db, f.refund.id, 'retry')]);
    expect(gatewayRefund).toHaveBeenCalledTimes(1);
    expect((await db.refund.findUniqueOrThrow({ where: { id: f.refund.id } })).status).toBe('succeeded');
    expect(await db.ledgerEntry.count({ where: { refundId: f.refund.id, entryType: 'refund_out' } })).toBe(1);
    expect((await db.booking.findUniqueOrThrow({ where: { id: f.booking.id } })).refundAccruedThb).toBe(0);
  });
  it('refuses a retry when another refund has consumed its payment capacity', async () => {
    const f = await fixture();
    await db.refund.create({ data: { paymentId: f.payment.id, method: 'card_provider', amountThb: 100_000,
      reason: 'cancellation', status: 'succeeded', initiatedByIdentityId: f.refund.initiatedByIdentityId } });
    await expect(resolveFailedRefund(db, f.refund.id, 'retry')).rejects.toMatchObject({ code: 'REFUND_RESOLUTION_CONFLICT' });
    expect((await db.refund.findUniqueOrThrow({ where: { id: f.refund.id } })).status).toBe('failed');
    expect(gatewayRefund).not.toHaveBeenCalled();
  });
  it('serializes competing failed retries so only one can reserve the payment capacity', async () => {
    const f = await fixture();
    const other = await db.refund.create({ data: { paymentId: f.payment.id, method: 'card_provider', amountThb: 400_000,
      reason: 'cancellation', status: 'failed', providerRefundId: 'rfnd_other_declined', initiatedByIdentityId: f.refund.initiatedByIdentityId } });
    const outcomes = await Promise.allSettled([resolveFailedRefund(db, f.refund.id, 'retry'), resolveFailedRefund(db, other.id, 'retry')]);
    expect(outcomes.filter(outcome => outcome.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter(outcome => outcome.status === 'rejected')).toHaveLength(1);
    expect(gatewayRefund).toHaveBeenCalledTimes(1);
    expect(await db.refund.count({ where: { paymentId: f.payment.id, status: 'succeeded' } })).toBe(1);
    expect(await db.refund.count({ where: { paymentId: f.payment.id, status: 'failed' } })).toBe(1);
  });
  it('refuses a retry whose source payment is not succeeded', async () => {
    const f = await fixture();
    await db.payment.update({ where: { id: f.payment.id }, data: { status: 'failed' } });
    await expect(resolveFailedRefund(db, f.refund.id, 'retry')).rejects.toMatchObject({ code: 'REFUND_RESOLUTION_CONFLICT' });
    expect(gatewayRefund).not.toHaveBeenCalled();
  });
  it('refuses to replay a legacy unknown provider outcome', async () => {
    const f = await fixture('failed', null);
    await expect(resolveFailedRefund(db, f.refund.id, 'retry')).rejects.toMatchObject({ code: 'REFUND_RESOLUTION_CONFLICT' });
    expect(gatewayRefund).not.toHaveBeenCalled();
    expect((await db.refund.findUniqueOrThrow({ where: { id: f.refund.id } })).status).toBe('failed');
  });
  it('keeps a quarantined receipt visible instead of queueing an undispatchable refund', async () => {
    const f = await fixture();
    await db.payment.update({ where: { id: f.payment.id }, data: { reconciliationReason: 'BOOKING_AMOUNT_CHANGED' } });
    await expect(resolveFailedRefund(db, f.refund.id, 'retry')).rejects.toMatchObject({ code: 'REFUND_RESOLUTION_CONFLICT' });
    expect((await db.refund.findUniqueOrThrow({ where: { id: f.refund.id } })).status).toBe('failed');
    expect(gatewayRefund).not.toHaveBeenCalled();
  });
  it('recovers a committed requested booking refund and clears only its availability marker', async () => {
    const f = await fixture('requested', null);
    await db.payment.update({ where: { id: f.payment.id }, data: { reconciliationReason: 'SERVICE_REFUND_PROVIDER_UNAVAILABLE' } });
    expect(await recoverRequestedBookingRefunds(db)).toEqual({ processed: 1, deferred: 0 });
    expect(await recoverRequestedBookingRefunds(db)).toEqual({ processed: 0, deferred: 0 });
    expect(gatewayRefund).toHaveBeenCalledTimes(1);
    expect((await db.booking.findUniqueOrThrow({ where: { id: f.booking.id } })).refundAccruedThb).toBe(0);
  });
  it('does not let older requests without provider charge IDs starve a valid recovery batch', async () => {
    const f = await fixture('requested', null);
    const missingSource = await db.payment.create({ data: { bookingId: f.booking.id, purpose: 'stay',
      payerIdentityId: f.payment.payerIdentityId, method: 'card_provider', provider: 'opn', amountThb: 400_000, status: 'succeeded' } });
    await db.refund.createMany({ data: Array.from({ length: 20 }, () => ({ paymentId: missingSource.id,
      method: 'card_provider' as const, amountThb: 1, reason: 'cancellation' as const, status: 'requested' as const,
      initiatedByIdentityId: f.refund.initiatedByIdentityId, createdAt: new Date('2020-01-01') })) });
    expect(await recoverRequestedBookingRefunds(db)).toEqual({ processed: 1, deferred: 0 });
    expect(gatewayRefund).toHaveBeenCalledTimes(1);
    expect(await db.refund.count({ where: { paymentId: missingSource.id, status: 'requested' } })).toBe(20);
  });
  it('quarantines an unknown dispatch result and never automatically retries it', async () => {
    const f = await fixture('requested', null);
    gatewayRefund.mockRejectedValue(new Error('Response lost after provider may have accepted'));
    await recoverRequestedBookingRefunds(db);
    await recoverRequestedBookingRefunds(db);
    expect(gatewayRefund).toHaveBeenCalledTimes(1);
    expect((await db.refund.findUniqueOrThrow({ where: { id: f.refund.id } })).status).toBe('processing');
    expect((await db.payment.findUniqueOrThrow({ where: { id: f.payment.id } })).reconciliationReason).toBe('SERVICE_REFUND_OUTCOME_UNKNOWN');
    expect((await db.booking.findUniqueOrThrow({ where: { id: f.booking.id } })).refundAccruedThb).toBe(400_000);
  });
});
