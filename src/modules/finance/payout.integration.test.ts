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
import { recordOwnerPayout, recordProviderRemittance, computeProviderRemittance, getFailedRefunds } from './payout.service';
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

      // Create service order (fulfilled)
      await db.serviceOrder.create({
        data: {
          service_id: service.id,
          provider_id: provider.id,
          orderer_identity_id: orderer.id,
          orderer_role: 'owner',
          project_id: project.id,
          unit_id: unit.id,
          scheduled_start: new Date(),
          scheduled_end: new Date(),
          total_thb: 10000,
          status: 'fulfilled',
          price_breakdown: { total: 10000, fee: 1000, provider: 9000 },
          take_rate_pct_snapshot: 10,
        },
      });

      // Compute remittance
      const remittance = await computeProviderRemittance(db, provider.id, new Date('2026-07-01'), new Date('2026-07-31'));

      // Should include the fulfilled order
      expect(remittance.fulfilledOrdersTotal).toBeGreaterThanOrEqual(10000);
      expect(remittance.netRemittance).toBeGreaterThanOrEqual(9000); // After refunds (none here)
    });

    it('deducts clawed-back refunds from remittance', async () => {
      const project = await createProject();
      const unit = await createUnit({ projectId: project.id });
      const orderer = await createIdentity();
      const payer = await createIdentity();
      const staff = await createIdentity();
      const provider = await createProvider();
      const service = await createService({ providerId: provider.id });

      // Create service order
      const order = await db.serviceOrder.create({
        data: {
          service_id: service.id,
          provider_id: provider.id,
          orderer_identity_id: orderer.id,
          orderer_role: 'owner',
          project_id: project.id,
          unit_id: unit.id,
          scheduled_start: new Date(),
          scheduled_end: new Date(),
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

      await db.refund.create({
        data: {
          paymentId: payment.id,
          method: 'card_provider',
          amountThb: 2000,
          reason: 'provider_no_show',
          status: 'succeeded',
          initiatedByIdentityId: staff.id,
        },
      });

      // Compute remittance
      const remittance = await computeProviderRemittance(db, provider.id, new Date('2026-07-01'), new Date('2026-07-31'));

      // Refunds should be clawed back
      expect(remittance.refundsClawed).toBeGreaterThanOrEqual(2000);
      expect(remittance.netRemittance).toBeLessThanOrEqual(remittance.fulfilledOrdersTotal - 2000);
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

      // Get failed refunds
      const failed = await getFailedRefunds(db);

      expect(failed.length).toBeGreaterThan(0);
      const found = failed.find((r) => r.id === failedRefund.id);
      expect(found).toBeDefined();
      expect(found?.status).toBe('failed');
      expect(found?.amountThb).toBe(5000);
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
      let failed = await getFailedRefunds(db);
      expect(failed.some((r) => r.id === failedRefund.id)).toBe(true);

      // Update status (manually simulating admin resolution)
      await db.refund.update({
        where: { id: failedRefund.id },
        data: { status: 'succeeded' },
      });

      // Verify it no longer appears
      failed = await getFailedRefunds(db);
      expect(failed.some((r) => r.id === failedRefund.id)).toBe(false);
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

      // Update to reconciled (simulating bank statement match)
      const reconciled = await db.payout.update({
        where: { id: payout.id },
        data: { status: 'reconciled' },
      });

      expect(reconciled.status).toBe('reconciled');
    });
  });
});
