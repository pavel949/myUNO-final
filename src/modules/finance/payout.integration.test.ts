import { describe, it, expect, beforeEach } from 'vitest';
import {
  db,
  resetDb,
  createIdentity,
  createProject,
  createUnit,
  createProvider,
  createService,
} from '@/test/util';
import {
  computeProviderRemittance,
  getProviderRemittancesView,
  getReconciliationData,
  reconcilePayout,
  resolveFailedRefund,
  resolveProviderPayoutPeriod,
} from './payout.service';

describe('Payouts & Reconciliation (T-031)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('remittance math computation', () => {
    it('uses fulfilled_at and the accepted per-order take-rate snapshot', async () => {
      const project = await createProject();
      const unit = await createUnit({ projectId: project.id });
      const orderer = await createIdentity();
      const provider = await createProvider();
      const service = await createService({ providerId: provider.id });

      await db.serviceOrder.create({
        data: {
          service_id: service.id,
          provider_id: provider.id,
          orderer_identity_id: orderer.id,
          orderer_role: 'owner',
          project_id: project.id,
          unit_id: unit.id,
          createdAt: new Date('2026-06-10'),
          updatedAt: new Date('2026-08-20'),
          scheduled_start: new Date('2026-07-10'),
          scheduled_end: new Date('2026-07-10T02:00:00Z'),
          fulfilled_at: new Date('2026-07-10T02:00:00Z'),
          total_thb: 10000,
          status: 'fulfilled',
          price_breakdown: { total: 10000, fee: 1500, provider: 8500 },
          take_rate_pct_snapshot: 15,
        },
      });

      const remittance = await computeProviderRemittance(
        db,
        provider.id,
        new Date('2026-07-01'),
        new Date('2026-08-01')
      );

      expect(remittance.fulfilledOrdersTotal).toBe(10000);
      expect(remittance.takeRateThb).toBe(1500);
      expect(remittance.netThb).toBe(8500);
      expect(remittance.orderCount).toBe(1);
    });

    it('keeps a subsequently closed order in its fulfillment period', async () => {
      const project = await createProject();
      const unit = await createUnit({ projectId: project.id });
      const orderer = await createIdentity();
      const provider = await createProvider();
      const service = await createService({ providerId: provider.id });

      await db.serviceOrder.create({
        data: {
          service_id: service.id,
          provider_id: provider.id,
          orderer_identity_id: orderer.id,
          orderer_role: 'owner',
          project_id: project.id,
          unit_id: unit.id,
          scheduled_start: new Date('2026-07-10'),
          scheduled_end: new Date('2026-07-10T02:00:00Z'),
          fulfilled_at: new Date('2026-07-10T02:00:00Z'),
          closed_at: new Date('2026-07-12T02:00:00Z'),
          total_thb: 10000,
          status: 'closed',
          price_breakdown: { total: 10000 },
          take_rate_pct_snapshot: 10,
        },
      });

      const remittance = await computeProviderRemittance(
        db,
        provider.id,
        new Date('2026-07-01'),
        new Date('2026-08-01')
      );
      expect(remittance.orderCount).toBe(1);
      expect(remittance.netThb).toBe(9000);
    });

    it('holds an order with an undecided dispute out of remittance', async () => {
      const project = await createProject();
      const unit = await createUnit({ projectId: project.id });
      const orderer = await createIdentity();
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
          scheduled_start: new Date('2026-07-10'),
          scheduled_end: new Date('2026-07-10T02:00:00Z'),
          fulfilled_at: new Date('2026-07-10T02:00:00Z'),
          total_thb: 10000,
          status: 'fulfilled',
          price_breakdown: { total: 10000 },
          take_rate_pct_snapshot: 10,
        },
      });

      const ticket = await db.ticket.create({
        data: {
          projectId: project.id,
          unitId: unit.id,
          raisedByIdentityId: orderer.id,
          raisedByRole: 'owner',
          category: 'complaint',
          priority: 'high',
          title: 'Service dispute',
          description: 'Work is disputed',
          status: 'open',
        },
      });
      await db.dispute.create({
        data: {
          ticketId: ticket.id,
          subjectType: 'service_order',
          subjectId: order.id,
        },
      });

      const remittance = await computeProviderRemittance(
        db,
        provider.id,
        new Date('2026-07-01'),
        new Date('2026-08-01')
      );
      expect(remittance.orderCount).toBe(0);
      expect(remittance.netThb).toBe(0);
    });

    it('deducts clawed-back refunds from eligible remittance', async () => {
      const project = await createProject();
      const unit = await createUnit({ projectId: project.id });
      const orderer = await createIdentity();
      const payer = await createIdentity();
      const staff = await createIdentity();
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
          scheduled_start: new Date('2026-07-10'),
          scheduled_end: new Date('2026-07-10T02:00:00Z'),
          fulfilled_at: new Date('2026-07-10T02:00:00Z'),
          total_thb: 10000,
          status: 'fulfilled',
          price_breakdown: { total: 10000, fee: 1000, provider: 9000 },
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
          amountThb: 10000,
          status: 'succeeded',
          succeededAt: new Date(),
        },
      });

      await db.refund.create({
        data: {
          paymentId: payment.id,
          method: 'card_provider',
          amountThb: 2000,
          reason: 'provider_no_show',
          status: 'succeeded',
          initiatedByIdentityId: staff.id,
          createdAt: new Date('2026-07-15'),
        },
      });

      const remittance = await computeProviderRemittance(
        db,
        provider.id,
        new Date('2026-07-01'),
        new Date('2026-08-01')
      );

      expect(remittance.refundsClawedBack).toBe(2000);
      expect(remittance.takeRateThb).toBe(1000);
      expect(remittance.netThb).toBe(7000);
    });
  });

  describe('failed refunds surfacing', () => {
    it('lists failed refunds for reconciliation', async () => {
      const staff = await createIdentity();
      const payer = await createIdentity();
      const payment = await db.payment.create({
        data: {
          purpose: 'stay',
          payerIdentityId: payer.id,
          method: 'card_provider',
          provider: 'mock',
          amountThb: 5000,
          status: 'succeeded',
          succeededAt: new Date(),
        },
      });
      const failedRefund = await db.refund.create({
        data: {
          paymentId: payment.id,
          method: 'card_provider',
          amountThb: 5000,
          reason: 'cancellation',
          status: 'failed',
          initiatedByIdentityId: staff.id,
        },
      });
      const data = await getReconciliationData(db);
      const found = data.failedRefunds.find((r) => r.id === failedRefund.id);
      expect(found).toBeDefined();
      expect(found?.status).toBe('failed');
      expect(found?.refundAmount).toBe(50);
    });

    it('failed refund persists until status changed', async () => {
      const staff = await createIdentity();
      const payer = await createIdentity();
      const payment = await db.payment.create({
        data: {
          purpose: 'stay',
          payerIdentityId: payer.id,
          method: 'card_provider',
          provider: 'mock',
          amountThb: 5000,
          status: 'succeeded',
          succeededAt: new Date(),
        },
      });
      const failedRefund = await db.refund.create({
        data: {
          paymentId: payment.id,
          method: 'card_provider',
          amountThb: 5000,
          reason: 'cancellation',
          status: 'failed',
          initiatedByIdentityId: staff.id,
        },
      });
      let data = await getReconciliationData(db);
      expect(data.failedRefunds.some((r) => r.id === failedRefund.id)).toBe(true);
      await resolveFailedRefund(db, failedRefund.id, 'retry');
      data = await getReconciliationData(db);
      expect(data.failedRefunds.some((r) => r.id === failedRefund.id)).toBe(false);
    });
  });

  describe('payout reconciliation workflow', () => {
    it('records payout as unreconciled, then marks reconciled', async () => {
      const staff = await createIdentity();
      const payout = await db.payout.create({
        data: {
          payeeType: 'owner',
          amountThb: 10000,
          method: 'bank_transfer_thb',
          reference: 'KRUNGSRI-123456',
          executedOn: new Date('2026-08-05'),
          recordedByIdentityId: staff.id,
        },
      });
      expect(payout.status).toBe('recorded');
      const reconciled = await reconcilePayout(db, payout.id);
      expect(reconciled.status).toBe('reconciled');
    });

    it('refuses to reconcile a payout that does not exist', async () => {
      await expect(reconcilePayout(db, 'nonexistent-id')).rejects.toThrow('Payout not found');
    });
  });

  describe('resolveProviderPayoutPeriod', () => {
    it('returns a monthly period aligned to calendar months', () => {
      const { periodStart, periodEnd } = resolveProviderPayoutPeriod(
        new Date('2026-07-15T12:00:00Z'),
        'monthly'
      );
      expect(periodStart.toISOString()).toBe('2026-07-01T00:00:00.000Z');
      expect(periodEnd.toISOString()).toBe('2026-08-01T00:00:00.000Z');
    });

    it('returns a weekly period starting on Monday', () => {
      const { periodStart, periodEnd } = resolveProviderPayoutPeriod(
        new Date('2026-07-15T12:00:00Z'),
        'weekly'
      );
      expect(periodStart.getUTCDay()).toBe(1);
      expect(periodEnd.getTime() - periodStart.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
    });
  });

  describe('getProviderRemittancesView', () => {
    it('marks payoutRecorded when a payout exists for the current period', async () => {
      const provider = await createProvider();
      const staff = await createIdentity();
      const now = new Date('2026-07-10T12:00:00Z');
      const { periodStart, periodEnd } = resolveProviderPayoutPeriod(now, 'weekly');
      await db.payout.create({
        data: {
          payeeType: 'provider',
          providerId: provider.id,
          periodStart,
          periodEnd,
          amountThb: 1000,
          method: 'bank_transfer_thb',
          reference: 'REF-CURRENT',
          executedOn: new Date('2026-07-09'),
          recordedByIdentityId: staff.id,
          status: 'recorded',
        },
      });
      const view = await getProviderRemittancesView(db, provider.id, now);
      expect(view.currentPeriod.payoutRecorded).toBe(true);
      expect(view.payouts[0].reference).toBe('REF-CURRENT');
    });
  });
});
