import prismadb from './prismadb'
import { getConfig } from '@/modules/config/config.service'

export interface RemittanceReport {
  providerId: string
  periodStart: Date
  periodEnd: Date
  fulfilledOrdersTotal: number
  takeRateThb: number
  refundsClawedBack: number
  netThb: number
  orderCount: number
  refundCount: number
}

/**
 * Compute provider remittance for a given period.
 * Formula: fulfilled orders total - take-rate - refunds clawed back = net
 */
export async function computeProviderRemittance(
  providerId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<RemittanceReport> {
  // Fetch fulfilled service orders in period
  const fulfilledOrders = await prismadb.serviceOrder.findMany({
    where: {
      provider_id: providerId,
      status: 'fulfilled',
      updatedAt: {
        gte: periodStart,
        lt: periodEnd,
      },
    },
  })

  // Sum up fulfilled order totals (from price breakdown)
  const fulfilledOrdersTotal = fulfilledOrders.reduce((sum, order) => {
    return sum + (order.total_thb || 0)
  }, 0)

  // Fetch the take-rate config (may vary by service category)
  const takeRatePercent = await getConfig(prismadb, 'services.take_rate_pct')
  const takeRateValue = typeof takeRatePercent === 'number' ? takeRatePercent : 10

  // Calculate take-rate on fulfilled orders
  const takeRateThb = Math.round((fulfilledOrdersTotal * takeRateValue) / 100)

  // Find refunds clawed back (succeeded refunds for this provider's orders)
  const fulfilledOrderIds = fulfilledOrders.map(o => o.id)
  const paymentsForOrders = await prismadb.payment.findMany({
    where: {
      serviceOrderId: { in: fulfilledOrderIds },
    },
    include: {
      refunds: {
        where: { status: 'succeeded' },
      },
    },
  })

  const refundsClawedBack = paymentsForOrders.reduce((sum, payment) => {
    return sum + payment.refunds.reduce((refundSum, refund) => refundSum + refund.amountThb, 0)
  }, 0)

  const totalRefundCount = paymentsForOrders.reduce((sum, payment) => sum + payment.refunds.length, 0)

  // Net = total - take-rate - refunds clawed back
  const netThb = fulfilledOrdersTotal - takeRateThb - refundsClawedBack

  return {
    providerId,
    periodStart,
    periodEnd,
    fulfilledOrdersTotal,
    takeRateThb,
    refundsClawedBack,
    netThb,
    orderCount: fulfilledOrders.length,
    refundCount: totalRefundCount,
  }
}

/**
 * Get reconciliation board data:
 * - Unmatched payments (no corresponding booking/service order)
 * - Failed refunds
 * - Payouts pending reconciliation
 */
export async function getReconciliationData() {
  // Find payments with no matching booking or service order
  const unmatchedPayments = await prismadb.payment.findMany({
    where: {
      AND: [
        {
          OR: [{ bookingId: null }, { status: 'failed' }],
        },
        { serviceOrderId: null },
      ],
    },
    include: {
      payer: { select: { id: true, firstName: true, lastName: true } },
    },
  })

  // Find failed refunds
  const failedRefunds = await prismadb.refund.findMany({
    where: { status: 'failed' },
    include: {
      payment: {
        select: {
          id: true,
          purpose: true,
          amountThb: true,
          method: true,
          bookingId: true,
          serviceOrderId: true,
        },
      },
      initiatedBy: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  // Find payouts pending reconciliation
  const pendingPayouts = await prismadb.payout.findMany({
    where: { status: 'recorded' },
    include: {
      ownerStatement: {
        select: {
          id: true,
          periodStart: true,
          periodEnd: true,
          unit: { select: { name: true } },
        },
      },
      provider: { select: { name: true } },
      recordedBy: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  // Display boundary: this DTO feeds the admin reconciliation board only
  // (never sent back — the board's actions post ids/reasons, not amounts),
  // so every *Thb/*Amount figure is converted from satang (THB x 100) to
  // baht here, once, at the response boundary.
  const toBaht = (satang: number) => Math.round(satang / 100)
  return {
    unmatchedPayments: unmatchedPayments.map(p => ({
      id: p.id,
      amountThb: toBaht(p.amountThb),
      method: p.method,
      purpose: p.purpose,
      status: p.status,
      createdAt: p.createdAt.toISOString(),
      payer: `${p.payer.firstName} ${p.payer.lastName}`.trim(),
      bookingId: p.bookingId,
      serviceOrderId: p.serviceOrderId,
    })),
    failedRefunds: failedRefunds.map(r => ({
      id: r.id,
      paymentId: r.paymentId,
      paymentAmount: toBaht(r.payment.amountThb),
      refundAmount: toBaht(r.amountThb),
      reason: r.reason,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      initiatedBy: `${r.initiatedBy.firstName} ${r.initiatedBy.lastName}`.trim(),
    })),
    pendingPayouts: pendingPayouts.map(p => ({
      id: p.id,
      payeeType: p.payeeType,
      amountThb: toBaht(p.amountThb),
      reference: p.reference,
      executedOn: p.executedOn.toISOString().split('T')[0],
      status: p.status,
      createdAt: p.createdAt.toISOString(),
      recordedBy: `${p.recordedBy.firstName} ${p.recordedBy.lastName}`.trim(),
      statement: p.ownerStatement
        ? {
            id: p.ownerStatement.id,
            unitName: p.ownerStatement.unit.name,
            periodStart: p.ownerStatement.periodStart.toISOString().split('T')[0],
            periodEnd: p.ownerStatement.periodEnd.toISOString().split('T')[0],
          }
        : null,
      provider: p.provider?.name || null,
    })),
  }
}

/**
 * Mark payout as reconciled (matched against bank statement)
 */
export async function reconcilePayout(payoutId: string) {
  return prismadb.payout.update({
    where: { id: payoutId },
    data: { status: 'reconciled' },
    include: {
      ownerStatement: { select: { unit: { select: { name: true } } } },
      provider: { select: { name: true } },
    },
  })
}

/**
 * Resolve failed refund by re-initiating or marking as refund loss
 */
export async function resolveFailedRefund(
  refundId: string,
  action: 'retry' | 'write_off'
) {
  const refund = await prismadb.refund.findUnique({
    where: { id: refundId },
  })

  if (!refund) {
    throw new Error('Refund not found')
  }

  if (action === 'write_off') {
    // Create a ledger entry recording the refund loss
    const payment = await prismadb.payment.findUnique({
      where: { id: refund.paymentId },
      include: { booking: true },
    })

    if (payment?.booking) {
      await prismadb.ledgerEntry.create({
        data: {
          entryType: 'adjustment',
          amountThb: -refund.amountThb,
          unitId: payment.booking.unitId,
          description: `Failed refund write-off: ${refund.reason}`,
          refundId,
          occurredOn: new Date(),
        },
      })
    }

    // Mark refund as succeeded (written off)
    return prismadb.refund.update({
      where: { id: refundId },
      data: { status: 'succeeded' },
    })
  }

  // 'retry' — reset to requested and let the payment seam handle it
  return prismadb.refund.update({
    where: { id: refundId },
    data: { status: 'requested' },
  })
}
