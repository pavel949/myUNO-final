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
  recordOwnerPayout,
  recordProviderRemittance,
  computeProviderRemittance,
  getReconciliationData,
  reconcilePayout,
  resolveFailedRefund,
} from './payout.service';
import { generateOwnerStatement, publishStatement } from './statement.service';

/**
 * Give a unit an owner and an active owner_direct engagement so a statement can
 * be generated for it. Statement generation refuses units with no owner/engagement.
 */
async function seedStatementUnit() {
  const project = await createProject();
  const owner = await createIdentity();
  const unit = await createUnit({ projectId: project.id, ownerIdentityId: owner.id });
  await db.unitEngagement.create({
    data: {
      unitId: unit.id,
      ownerIdentityId: owner.id,
      engagementType: 'owner_direct',
      status: 'active',
    },
  });
  return { project, owner, unit };
}

describe('Payouts & Reconciliation (T-031)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('owner payout recording', () => {
    it('records payout linked to published statement', async () => {
      const { unit } = await seedStatementUnit();
      const staff = await createIdentity();

      // Create and publish a statement
      const statement = await generateOwnerStatement(db, {
        unitId: unit.id,
        periodStart: new Date('2026-07-01'),
        periodEnd: new Date('2026-07-31'),
      });

      await publishStatement(db, statement.id, staff.id);

      // Record payout
      const payout = await recordOwnerPayout(db, {
        ownerStatementId: statement.id,
        amountThb: 10000,
        method: 'bank_transfer_thb',
        reference: 'KRUNGSRI-123456',
        executedOn: new Date('2026-08-05'),
        recordedByIdentityId: staff.id,
      });

      expect(payout.payeeType).toBe('owner');
      expect(payout.ownerStatementId).toBe(statement.id);
      expect(payout.amountThb).toBe(10000);
      expect(payout.method).toBe('bank_transfer_thb');
      expect(payout.reference).toBe('KRUNGSRI-123456');
      expect(payout.status).toBe('recorded');
    });

    it('refuses payout when statement not published', async () => {
      const { unit } = await seedStatementUnit();
      const staff = await createIdentity();

      // Create draft statement (don't publish)
      const statement = await generateOwnerStatement(db, {
        unitId: unit.id,
        periodStart: new Date('2026-07-01'),
        periodEnd: new Date('2026-07-31'),
      });

      // Attempt payout on draft statement
      await expect(
        recordOwnerPayout(db, {
          ownerStatementId: statement.id,
          amountThb: 10000,
          method: 'bank_transfer_thb',
          reference: 'KRUNGSRI-123456',
          executedOn: new Date('2026-08-05'),
          recordedByIdentityId: staff.id,
        })
      ).rejects.toThrow('Can only payout published statements');
    });
  });

  describe('provider remittance recording', () => {
    it('records provider remittance payout', async () => {
      const staff = await createIdentity();
      const provider = await createProvider();

      // Record remittance
      const payout = await recordProviderRemittance(db, {
        providerId: provider.id,
        periodStart: new Date('2026-07-01'),
        periodEnd: new Date('2026-07-31'),
        amountThb: 50000,
        reference: 'REMIT-001',
        executedOn: new Date('2026-08-10'),
        recordedByIdentityId: staff.id,
      });

      expect(payout.payeeType).toBe('provider');
      expect(payout.providerId).toBe(provider.id);
      expect(payout.amountThb).toBe(50000);
      expect(payout.periodStart).toEqual(new Date('2026-07-01'));
      expect(payout.periodEnd).toEqual(new Date('2026-07-31'));
      expect(payout.status).toBe('recorded');
    });
  });

  describe('remittance math computation', () => {
    it('computes remittance: fulfilled orders - refunds', async () => {
      const project = await createProject();
      const unit = await createUnit({ projectId: project.id });
      const orderer = await createIdentity();
      const provider = await createProvider();
      const service = await createService({ providerId: provider.id });

      // Create service order (fulfilled). Dated inside the remittance period —
      // computeProviderRemittance selects orders by updatedAt within it (the
      // best available proxy for "when it was fulfilled": doc 10 §5 remits
      // per period on fulfilled work, and the schema has no dedicated
      // fulfilled-at timestamp).
      await db.serviceOrder.create({
        data: {
          service_id: service.id,
          provider_id: provider.id,
          orderer_identity_id: orderer.id,
          orderer_role: 'owner',
          project_id: project.id,
          unit_id: unit.id,
          createdAt: new Date('2026-07-10'),
          updatedAt: new Date('2026-07-10'),
          scheduled_start: new Date('2026-07-10'),
          scheduled_end: new Date('2026-07-10T02:00:00Z'),
          total_thb: 10000,
          status: 'fulfilled',
          price_breakdown: { total: 10000, fee: 1000, provider: 9000 },
          take_rate_pct_snapshot: 10,
        },
      });

      // Compute remittance
      const remittance = await computeProviderRemittance(db, provider.id, new Date('2026-07-01'), new Date('2026-07-31'));

      // Should include the fulfilled order. Doc 10 §5: fulfilled total − take
      // rate (10% default, matching the config `services.take_rate_pct`) −
      // refunds (none here).
      expect(remittance.fulfilledOrdersTotal).toBe(10000);
      expect(remittance.takeRateThb).toBe(1000);
      expect(remittance.netThb).toBe(9000);
    });

    it('deducts clawed-back refunds from remittance', async () => {
      const project = await createProject();
      const unit = await createUnit({ projectId: project.id });
      const orderer = await createIdentity();
      const payer = await createIdentity();
      const staff = await createIdentity();
      const provider = await createProvider();
      const service = await createService({ providerId: provider.id });

      // Create service order (dated inside the remittance period)
      const order = await db.serviceOrder.create({
        data: {
          service_id: service.id,
          provider_id: provider.id,
          orderer_identity_id: orderer.id,
          orderer_role: 'owner',
          project_id: project.id,
          unit_id: unit.id,
          createdAt: new Date('2026-07-10'),
          updatedAt: new Date('2026-07-10'),
          scheduled_start: new Date('2026-07-10'),
          scheduled_end: new Date('2026-07-10T02:00:00Z'),
          total_thb: 10000,
          status: 'fulfilled',
          price_breakdown: { total: 10000, fee: 1000, provider: 9000 },
          take_rate_pct_snapshot: 10,
        },
      });

      // Create payment and refund
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

      // Refund is clawed back only if it falls in the same period as the order
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

      // Compute remittance
      const remittance = await computeProviderRemittance(db, provider.id, new Date('2026-07-01'), new Date('2026-07-31'));

      // Refunds should be clawed back: 10000 total − 1000 take-rate (10%) − 2000 refund.
      expect(remittance.refundsClawedBack).toBe(2000);
      expect(remittance.takeRateThb).toBe(1000);
      expect(remittance.netThb).toBe(7000);
    });
  });

  describe('failed refunds surfacing', () => {
    it('lists failed refunds for reconciliation', async () => {
      const staff = await createIdentity();
      const payer = await createIdentity();

      // Create payment and failed refund
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

      // Get the reconciliation board's failed-refunds list
      const data = await getReconciliationData(db);

      expect(data.failedRefunds.length).toBeGreaterThan(0);
      const found = data.failedRefunds.find((r) => r.id === failedRefund.id);
      expect(found).toBeDefined();
      expect(found?.status).toBe('failed');
      // Satang -> baht at the board's display boundary (CLAUDE.md; Q47).
      expect(found?.refundAmount).toBe(50);
    });

    it('failed refund persists until status changed', async () => {
      const staff = await createIdentity();
      const payer = await createIdentity();

      // Create failed refund
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

      // List and verify it's there
      let data = await getReconciliationData(db);
      expect(data.failedRefunds.some((r) => r.id === failedRefund.id)).toBe(true);

      // Resolve it via the same function the admin route calls.
      await resolveFailedRefund(db, failedRefund.id, 'retry');

      // 'retry' resets status to 'requested', so it no longer reads as failed.
      data = await getReconciliationData(db);
      expect(data.failedRefunds.some((r) => r.id === failedRefund.id)).toBe(false);
    });
  });

  describe('payout reconciliation workflow', () => {
    it('records payout as unreconciled, then marks reconciled', async () => {
      const { unit } = await seedStatementUnit();
      const staff = await createIdentity();

      // Create and publish statement
      const statement = await generateOwnerStatement(db, {
        unitId: unit.id,
        periodStart: new Date('2026-07-01'),
        periodEnd: new Date('2026-07-31'),
      });

      await publishStatement(db, statement.id, staff.id);

      // Record payout
      const payout = await recordOwnerPayout(db, {
        ownerStatementId: statement.id,
        amountThb: 10000,
        method: 'bank_transfer_thb',
        reference: 'KRUNGSRI-123456',
        executedOn: new Date('2026-08-05'),
        recordedByIdentityId: staff.id,
      });

      // Verify payout is in recorded status
      expect(payout.status).toBe('recorded');

      // Reconcile via the same function the admin route calls.
      const reconciled = await reconcilePayout(db, payout.id);

      expect(reconciled.status).toBe('reconciled');
    });

    it('refuses to reconcile a payout that does not exist', async () => {
      await expect(reconcilePayout(db, 'nonexistent-id')).rejects.toThrow('Payout not found');
    });
  });
});
