import { beforeEach, describe, expect, it } from 'vitest';
import {
  db,
  resetDb,
  createIdentity,
  createProject,
  createUnit,
  createProvider,
  createService,
} from '@/test/util';
import { computeProviderRemittance } from './payout.service';

async function paidServiceOrder() {
  const project = await createProject();
  const unit = await createUnit({ projectId: project.id });
  const orderer = await createIdentity();
  const payer = await createIdentity();
  const admin = await createIdentity({ isAdmin: true });
  const provider = await createProvider();
  const service = await createService({ providerId: provider.id });

  const order = await db.serviceOrder.create({
    data: {
      service_id: service.id,
      provider_id: provider.id,
      orderer_identity_id: orderer.id,
      orderer_role: 'owner',
      project_id: project.id,
      unit_id: unit.id,
      scheduled_start: new Date('2026-07-10T00:00:00Z'),
      scheduled_end: new Date('2026-07-10T02:00:00Z'),
      fulfilled_at: new Date('2026-07-10T02:00:00Z'),
      total_thb: 10_000,
      status: 'closed',
      price_breakdown: { total: 10_000 },
      take_rate_pct_snapshot: 10,
    },
  });

  const payment = await db.payment.create({
    data: {
      purpose: 'service_order',
      serviceOrderId: order.id,
      payerIdentityId: payer.id,
      method: 'card_provider',
      provider: 'mock',
      amountThb: 10_000,
      status: 'succeeded',
      succeededAt: new Date('2026-07-01T00:00:00Z'),
    },
  });

  await db.payout.create({
    data: {
      payeeType: 'provider',
      providerId: provider.id,
      periodStart: new Date('2026-07-01T00:00:00Z'),
      periodEnd: new Date('2026-08-01T00:00:00Z'),
      amountThb: 9_000,
      method: 'bank_transfer_thb',
      reference: 'JULY-PAID',
      executedOn: new Date('2026-08-02T00:00:00Z'),
      recordedByIdentityId: admin.id,
      status: 'recorded',
      createdAt: new Date('2026-08-02T00:00:00Z'),
    },
  });

  return { provider, payment, admin };
}

describe('provider late-refund carry-forward', () => {
  beforeEach(async () => resetDb());

  it('does not rewrite the already-paid fulfilment period with a later refund', async () => {
    const { provider, payment, admin } = await paidServiceOrder();
    await db.refund.create({
      data: {
        paymentId: payment.id,
        method: 'card_provider',
        amountThb: 2_000,
        reason: 'goodwill',
        status: 'succeeded',
        initiatedByIdentityId: admin.id,
        createdAt: new Date('2026-08-10T00:00:00Z'),
      },
    });

    const july = await computeProviderRemittance(
      db,
      provider.id,
      new Date('2026-07-01T00:00:00Z'),
      new Date('2026-08-01T00:00:00Z')
    );
    expect(july.netThb).toBe(9_000);
    expect(july.lateRefundAdjustments).toBe(0);
  });

  it('carries a refund initiated after payout into the current payable period', async () => {
    const { provider, payment, admin } = await paidServiceOrder();
    await db.refund.create({
      data: {
        paymentId: payment.id,
        method: 'card_provider',
        amountThb: 2_000,
        reason: 'goodwill',
        status: 'succeeded',
        initiatedByIdentityId: admin.id,
        createdAt: new Date('2026-08-10T00:00:00Z'),
      },
    });

    const august = await computeProviderRemittance(
      db,
      provider.id,
      new Date('2026-08-01T00:00:00Z'),
      new Date('2026-09-01T00:00:00Z')
    );
    expect(august.fulfilledOrdersTotal).toBe(0);
    expect(august.lateRefundAdjustments).toBe(2_000);
    expect(august.netThb).toBe(-2_000);
  });

  it('reports unresolved refunds so payout recording can be blocked', async () => {
    const project = await createProject();
    const unit = await createUnit({ projectId: project.id });
    const orderer = await createIdentity();
    const payer = await createIdentity();
    const admin = await createIdentity({ isAdmin: true });
    const provider = await createProvider();
    const service = await createService({ providerId: provider.id });
    const order = await db.serviceOrder.create({
      data: {
        service_id: service.id,
        provider_id: provider.id,
        orderer_identity_id: orderer.id,
        orderer_role: 'owner',
        project_id: project.id,
        unit_id: unit.id,
        scheduled_start: new Date('2026-08-10T00:00:00Z'),
        scheduled_end: new Date('2026-08-10T02:00:00Z'),
        fulfilled_at: new Date('2026-08-10T02:00:00Z'),
        total_thb: 10_000,
        status: 'fulfilled',
        price_breakdown: { total: 10_000 },
        take_rate_pct_snapshot: 10,
      },
    });
    const payment = await db.payment.create({
      data: {
        purpose: 'service_order', serviceOrderId: order.id, payerIdentityId: payer.id,
        method: 'card_provider', provider: 'mock', amountThb: 10_000,
        status: 'succeeded', succeededAt: new Date('2026-08-01T00:00:00Z'),
      },
    });
    await db.refund.create({
      data: {
        paymentId: payment.id, method: 'card_provider', amountThb: 2_000,
        reason: 'goodwill', status: 'processing', initiatedByIdentityId: admin.id,
        createdAt: new Date('2026-08-15T00:00:00Z'),
      },
    });

    const report = await computeProviderRemittance(
      db,
      provider.id,
      new Date('2026-08-01T00:00:00Z'),
      new Date('2026-09-01T00:00:00Z')
    );
    expect(report.pendingRefundCount).toBe(1);
  });
});
