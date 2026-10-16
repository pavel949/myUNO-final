import type { PrismaClient } from '@prisma/client';
import { beforeEach, describe, expect, it } from 'vitest';
import { createIdentity, createProject, createProvider, createService, db, resetDb } from '@/test/util';
import { raiseTicket } from '@/modules/comms/ticket.service';
import { computeProviderRemittance } from './remittance.service';
import { recordProviderPayoutAtomic } from './payout-ledger.service';

beforeEach(async () => { await resetDb(); });
async function fixture() {
  const admin = await createIdentity({ isAdmin: true });
  const guest = await createIdentity();
  const project = await createProject();
  const provider = await createProvider();
  const service = await createService({ providerId: provider.id });
  const now = new Date();
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const start = new Date(end.getTime() - 7 * 86_400_000);
  const fulfilled = new Date(end.getTime() - 3_600_000);
  const order = await db.serviceOrder.create({ data: { service_id: service.id, provider_id: provider.id, project_id: project.id, orderer_identity_id: guest.id, orderer_role: 'guest', scheduled_start: new Date(fulfilled.getTime() - 3_600_000), scheduled_end: fulfilled, fulfilled_at: fulfilled, status: 'fulfilled', quantity: 1, total_thb: 10000, take_rate_pct_snapshot: 10, price_breakdown: { total_thb: 10000 } } });
  const payment = await db.payment.create({ data: { purpose: 'service_order', serviceOrderId: order.id, payerIdentityId: guest.id, amountThb: 10000, method: 'cash', provider: 'cash', status: 'succeeded' } });
  const input = { providerId: provider.id, periodStart: start, periodEnd: end, amountThb: 9000, reference: 'SYNTHETIC-PAYOUT', executedOn: now, recordedByIdentityId: admin.id };
  return { admin, guest, project, provider, order, payment, input };
}

describe('atomic provider payout source checks', () => {
  it('records exactly one payout and matching append-only ledger from the locked canonical report', async () => {
    const { input } = await fixture();
    const { payout, remittance } = await recordProviderPayoutAtomic(db, input);
    expect(remittance.netThb).toBe(9000);
    expect(payout.amountThb).toBe(9000);
    expect(await db.ledgerEntry.findUniqueOrThrow({ where: { payoutId: payout.id } })).toMatchObject({ entryType: 'payout_provider', amountThb: -9000 });
    await expect(recordProviderPayoutAtomic(db, input)).rejects.toThrow(/overlapping/);
    expect(await db.payout.count()).toBe(1);
  });

  it('serializes overlapping periods instead of relying only on exact-date uniqueness', async () => {
    const { input } = await fixture();
    const results = await Promise.allSettled([
      recordProviderPayoutAtomic(db, input),
      recordProviderPayoutAtomic(db, { ...input, periodStart: new Date(input.periodStart.getTime() - 86_400_000), reference: 'SYNTHETIC-OVERLAP' }),
    ]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(await db.payout.count()).toBe(1);
    expect(await db.ledgerEntry.count({ where: { entryType: 'payout_provider' } })).toBe(1);
  });

  it('waits for an in-flight dispute on the same order and recomputes after its commit', async () => {
    const { input, project, guest, order } = await fixture();
    expect((await computeProviderRemittance(db, input.providerId, input.periodStart, input.periodEnd)).netThb).toBe(9000);
    let release!: () => void;
    let locked!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const ready = new Promise<void>(resolve => { locked = resolve; });
    const dispute = db.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${order.id}))`;
      await tx.$queryRaw`SELECT id FROM service_order WHERE id = ${order.id} FOR UPDATE`;
      locked(); await gate;
      const ticket = await raiseTicket(tx as unknown as PrismaClient, { projectId: project.id, raisedByIdentityId: guest.id, raisedByRole: 'guest', categoryKey: 'complaint', title: 'Synthetic pending dispute', description: 'Synthetic incomplete service' });
      await tx.dispute.create({ data: { subjectType: 'service_order', subjectId: order.id, ticketId: ticket.id } });
    }, { timeout: 15000 });
    await ready;
    let settled = false;
    const payout = recordProviderPayoutAtomic(db, input);
    const result = payout.then(value => ({ value }), error => ({ error }));
    void result.then(() => { settled = true; });
    try {
      await new Promise(resolve => setTimeout(resolve, 75));
      expect(settled).toBe(false);
    } finally { release(); await dispute; }
    expect(await result).toMatchObject({ error: { message: expect.stringContaining('No positive') } });
    expect(await db.payout.count()).toBe(0);
    expect(await db.ledgerEntry.count({ where: { entryType: 'payout_provider' } })).toBe(0);
  });

  it('blocks a refund requested after period end, even if the preview count missed it', async () => {
    const { input, payment, admin } = await fixture();
    await db.refund.create({ data: { paymentId: payment.id, method: 'cash', amountThb: 1000, reason: 'dispute_resolution', status: 'requested', initiatedByIdentityId: admin.id } });
    expect((await computeProviderRemittance(db, input.providerId, input.periodStart, input.periodEnd)).pendingRefundCount).toBe(0);
    await expect(recordProviderPayoutAtomic(db, input)).rejects.toThrow(/refunds are unresolved/);
    expect(await db.payout.count()).toBe(0);
  });

  it('does not silently overpay a late pre-payout refund that has no captured-period adjustment', async () => {
    const { input, payment, admin } = await fixture();
    await db.refund.create({ data: { paymentId: payment.id, method: 'cash', amountThb: 1000, reason: 'dispute_resolution', status: 'succeeded', initiatedByIdentityId: admin.id, paidBackByIdentityId: admin.id } });
    await expect(recordProviderPayoutAtomic(db, input)).rejects.toThrow(/Late pre-payout refund requires financial reconciliation/);
    expect(await db.payout.count()).toBe(0);
  });

  it('rejects an open period and a tampered amount without financial writes', async () => {
    const { input } = await fixture();
    await expect(recordProviderPayoutAtomic(db, { ...input, periodEnd: new Date(Date.now() + 86_400_000) })).rejects.toThrow(/completed period/);
    await expect(recordProviderPayoutAtomic(db, { ...input, amountThb: 9999 })).rejects.toThrow(/does not match/);
    expect(await db.payout.count()).toBe(0);
    expect(await db.ledgerEntry.count({ where: { entryType: 'payout_provider' } })).toBe(0);
  });
});
