import { describe, it, expect, beforeEach } from 'vitest'
import prismadb from '@/app/libs/prismadb'
import {
  resetDb,
  createIdentity,
  createProject,
  createUnit,
  createUnitEngagement,
  createProvider,
  createService,
} from '@/test/util'
import { computeProviderRemittance, getReconciliationData } from '@/app/libs/payouts'

describe('T-031: Payouts & Reconciliation', () => {
  beforeEach(async () => {
    await resetDb()
  })

  describe('Provider Remittance Math', () => {
    it('should calculate net remittance correctly with no orders', async () => {
      const provider = await createProvider({ status: 'active' })

      const periodStart = new Date('2026-01-01')
      const periodEnd = new Date('2026-01-31')

      const remittance = await computeProviderRemittance(
        provider.id,
        periodStart,
        periodEnd
      )

      expect(remittance.fulfilledOrdersTotal).toBe(0)
      expect(remittance.takeRateThb).toBe(0)
      expect(remittance.refundsClawedBack).toBe(0)
      expect(remittance.netThb).toBe(0)
      expect(remittance.orderCount).toBe(0)
      expect(remittance.refundCount).toBe(0)
    })

    it('should include only fulfilled orders in the period', async () => {
      const provider = await createProvider({ status: 'active' })

      const orderer = await createIdentity()
      const periodStart = new Date('2026-01-01')
      const periodEnd = new Date('2026-01-31')

      // Create service for orders
      const service = await createService({
        providerId: provider.id,
        title: 'Test Service',
        status: 'active',
      })

      const project = await createProject()

      // Create fulfilled order in period
      await prismadb.serviceOrder.create({
        data: {
          service_id: service.id,
          provider_id: provider.id,
          project_id: project.id,
          orderer_identity_id: orderer.id,
          orderer_role: 'guest',
          scheduled_start: new Date('2026-01-15'),
          scheduled_end: new Date('2026-01-15T02:00:00'),
          status: 'fulfilled',
          total_thb: 5000,
          take_rate_pct_snapshot: 10,
          price_breakdown: {},
          updatedAt: new Date('2026-01-15'),
        },
      })

      // Create pending order (not fulfilled)
      await prismadb.serviceOrder.create({
        data: {
          service_id: service.id,
          provider_id: provider.id,
          project_id: project.id,
          orderer_identity_id: orderer.id,
          orderer_role: 'guest',
          scheduled_start: new Date('2026-01-10'),
          scheduled_end: new Date('2026-01-10T02:00:00'),
          status: 'placed',
          total_thb: 5000,
          take_rate_pct_snapshot: 10,
          price_breakdown: {},
        },
      })

      // Create fulfilled order outside period
      await prismadb.serviceOrder.create({
        data: {
          service_id: service.id,
          provider_id: provider.id,
          project_id: project.id,
          orderer_identity_id: orderer.id,
          orderer_role: 'guest',
          scheduled_start: new Date('2026-02-15'),
          scheduled_end: new Date('2026-02-15T02:00:00'),
          status: 'fulfilled',
          total_thb: 5000,
          take_rate_pct_snapshot: 10,
          price_breakdown: {},
          updatedAt: new Date('2026-02-15'),
        },
      })

      const remittance = await computeProviderRemittance(
        provider.id,
        periodStart,
        periodEnd
      )

      // Should only count the one fulfilled in-period order
      expect(remittance.fulfilledOrdersTotal).toBe(5000)
      expect(remittance.orderCount).toBe(1)
      expect(remittance.takeRateThb).toBe(500) // 5000 * 10%
      expect(remittance.netThb).toBe(4500) // 5000 - 500
    })
  })

  describe('Recording Payouts', () => {
    it('should record owner payout for approved statement', async () => {
      const owner = await createIdentity()
      const project = await createProject()
      const unit = await createUnit({ projectId: project.id, ownerIdentityId: owner.id })
      const engagement = await createUnitEngagement({
        unitId: unit.id,
        ownerIdentityId: owner.id,
        status: 'active',
      })
      const admin = await createIdentity()

      const statement = await prismadb.ownerStatement.create({
        data: {
          unitId: unit.id,
          ownerIdentityId: owner.id,
          engagementId: engagement.id,
          periodStart: new Date('2026-01-01'),
          periodEnd: new Date('2026-01-31'),
          status: 'signed_off',
          // The statement totals: 50000 revenue - 10000 costs = 40000 NOI,
          // all of which is the owner's share here.
          grossRevenueTh: 50000,
          totalCostsTh: 10000,
          noiTh: 40000,
          ownerShareTh: 40000,
          estateShareTh: 0,
          // The transparency block (Prisma names end in `Th`, columns in `_thb`)
          grossBookingsAmountTh: 50000,
          serviceFeesAmountTh: 6000,
          operatingExpensesAmountTh: 4000,
          adjustedNoiTh: 40000,
          distributableCashTh: 40000,
        },
      })

      const payout = await prismadb.payout.create({
        data: {
          payeeType: 'owner',
          ownerStatementId: statement.id,
          periodStart: statement.periodStart,
          periodEnd: statement.periodEnd,
          amountThb: 40000,
          method: 'bank_transfer_thb',
          reference: 'BANK-REF-001',
          executedOn: new Date('2026-02-05'),
          recordedByIdentityId: admin.id,
          status: 'recorded',
        },
      })

      expect(payout.payeeType).toBe('owner')
      expect(payout.ownerStatementId).toBe(statement.id)
      expect(payout.amountThb).toBe(40000)
      expect(payout.status).toBe('recorded')
    })
  })

  describe('Reconciliation Board', () => {
    it('should surface failed refunds until cleared', async () => {
      const owner = await createIdentity()
      const project = await createProject()
      const unit = await createUnit({ projectId: project.id, ownerIdentityId: owner.id })
      const guest = await createIdentity()

      const booking = await prismadb.booking.create({
        data: {
          unitId: unit.id,
          projectId: project.id,
          guestIdentityId: guest.id,
          // A guest's stay booked on our own rails: the type is the stay kind,
          // the channel is where it came from.
          bookingType: 'guest_stay',
          channel: 'direct',
          status: 'confirmed',
          startDate: new Date('2026-01-15'),
          endDate: new Date('2026-01-20'),
          adults: 2,
          children: 0,
          totalThb: 5000,
          priceBreakdown: {},
        },
      })

      const payment = await prismadb.payment.create({
        data: {
          purpose: 'stay',
          bookingId: booking.id,
          payerIdentityId: guest.id,
          method: 'card_provider',
          provider: 'mock',
          amountThb: 5000,
          status: 'succeeded',
        },
      })

      // Create failed refund
      const failedRefund = await prismadb.refund.create({
        data: {
          paymentId: payment.id,
          method: 'card_provider',
          amountThb: 5000,
          reason: 'cancellation',
          status: 'failed',
          initiatedByIdentityId: (await createIdentity()).id,
        },
      })

      // Get reconciliation data
      let data = await getReconciliationData()

      // Failed refund should be visible
      const surfacedRefund = data.failedRefunds.find(r => r.id === failedRefund.id)
      expect(surfacedRefund).toBeDefined()
      expect(surfacedRefund!.status).toBe('failed')

      // After resolution (marking as succeeded), it should no longer appear
      await prismadb.refund.update({
        where: { id: failedRefund.id },
        data: { status: 'succeeded' },
      })

      data = await getReconciliationData()
      const refundAfter = data.failedRefunds.find(r => r.id === failedRefund.id)
      expect(refundAfter).toBeUndefined()
    })

    it('should track payouts from recorded to reconciled', async () => {
      const owner = await createIdentity()
      const project = await createProject()
      const unit = await createUnit({ projectId: project.id, ownerIdentityId: owner.id })
      const engagement = await createUnitEngagement({
        unitId: unit.id,
        ownerIdentityId: owner.id,
        status: 'active',
      })
      const admin = await createIdentity()

      const statement = await prismadb.ownerStatement.create({
        data: {
          unitId: unit.id,
          ownerIdentityId: owner.id,
          engagementId: engagement.id,
          periodStart: new Date('2026-01-01'),
          periodEnd: new Date('2026-01-31'),
          status: 'signed_off',
          // The statement totals: 50000 revenue - 10000 costs = 40000 NOI,
          // all of which is the owner's share here.
          grossRevenueTh: 50000,
          totalCostsTh: 10000,
          noiTh: 40000,
          ownerShareTh: 40000,
          estateShareTh: 0,
          // The transparency block (Prisma names end in `Th`, columns in `_thb`)
          grossBookingsAmountTh: 50000,
          serviceFeesAmountTh: 6000,
          operatingExpensesAmountTh: 4000,
          adjustedNoiTh: 40000,
          distributableCashTh: 40000,
        },
      })

      const payout = await prismadb.payout.create({
        data: {
          payeeType: 'owner',
          ownerStatementId: statement.id,
          periodStart: statement.periodStart,
          periodEnd: statement.periodEnd,
          amountThb: 40000,
          method: 'bank_transfer_thb',
          reference: 'BANK-REF-001',
          executedOn: new Date('2026-02-05'),
          recordedByIdentityId: admin.id,
          status: 'recorded',
        },
      })

      // Initially should appear in pending payouts
      let data = await getReconciliationData()
      let pending = data.pendingPayouts.find(p => p.id === payout.id)
      expect(pending).toBeDefined()
      expect(pending!.status).toBe('recorded')

      // After reconciliation, should disappear from pending
      await prismadb.payout.update({
        where: { id: payout.id },
        data: { status: 'reconciled' },
      })

      data = await getReconciliationData()
      pending = data.pendingPayouts.find(p => p.id === payout.id)
      expect(pending).toBeUndefined()
    })
  })
})
