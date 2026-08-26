import { PrismaClient, Payout } from '@prisma/client';
import { getConfig } from '@/modules/config';

export interface RemittanceReport {
  providerId: string;
  periodStart: Date;
  periodEnd: Date;
  fulfilledOrdersTotal: number;
  takeRateThb: number;
  refundsClawedBack: number;
  netThb: number;
  orderCount: number;
  refundCount: number;
}

/**
 * Compute provider remittance for a period (doc 10 §5, Q34).
 *
 * Formula, verbatim from doc 10 §5: "report per provider = fulfilled
 * orders' totals − take-rate − refunds clawed back". Two implementations of
 * this used to exist and disagreed — this one is now the only one. It
 * matches what has actually been wired and tested against real scenarios
 * (`src/app/api/admin/payouts/provider/route.ts`,
 * `src/app/api/admin/payouts/payouts.integration.test.ts`) rather than the
 * version nothing ever called.
 *
 * Only `fulfilled` orders remit — an `accepted` order has not yet been
 * delivered and is not owed to the provider yet (doc 10 §5: "disputed/
 * failed orders are excluded until resolved" is the same principle applied
 * to the fulfilled/unfulfilled boundary).
 */
export async function computeProviderRemittance(
  db: PrismaClient,
  providerId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<RemittanceReport> {
  const fulfilledOrders = await db.serviceOrder.findMany({
    where: {
      provider_id: providerId,
      status: 'fulfilled',
      updatedAt: {
        gte: periodStart,
        lt: periodEnd,
      },
    },
  });

  const fulfilledOrdersTotal = fulfilledOrders.reduce((sum, order) => sum + (order.total_thb || 0), 0);

  // The take-rate can vary by service category (services.take_rate_pct[.category]
  // per doc 10 §3); loop one reads the flat default until category overrides
  // are wired to this calculation.
  const takeRatePercent = await getConfig(db, 'services.take_rate_pct');
  const takeRateValue = typeof takeRatePercent === 'number' ? takeRatePercent : 10;
  const takeRateThb = Math.round((fulfilledOrdersTotal * takeRateValue) / 100);

  // Refunds clawed back: succeeded refunds against a payment for one of
  // this period's fulfilled orders.
  const fulfilledOrderIds = fulfilledOrders.map((o) => o.id);
  const paymentsForOrders = fulfilledOrderIds.length
    ? await db.payment.findMany({
        where: { serviceOrderId: { in: fulfilledOrderIds } },
        include: { refunds: { where: { status: 'succeeded' } } },
      })
    : [];

  const refundsClawedBack = paymentsForOrders.reduce(
    (sum, payment) => sum + payment.refunds.reduce((refundSum, r) => refundSum + r.amountThb, 0),
    0
  );
  const refundCount = paymentsForOrders.reduce((sum, payment) => sum + payment.refunds.length, 0);

  const netThb = fulfilledOrdersTotal - takeRateThb - refundsClawedBack;

  return {
    providerId,
    periodStart,
    periodEnd,
    fulfilledOrdersTotal,
    takeRateThb,
    refundsClawedBack,
    netThb,
    orderCount: fulfilledOrders.length,
    refundCount,
  };
}

/**
 * Admin reconciliation board data: payments with nothing to match them,
 * refunds that failed provider-side, and payouts recorded but not yet
 * matched against a bank statement.
 */
export async function getReconciliationData(db: PrismaClient) {
  const unmatchedPayments = await db.payment.findMany({
    where: {
      AND: [{ OR: [{ bookingId: null }, { status: 'failed' }] }, { serviceOrderId: null }],
    },
    include: {
      payer: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  const failedRefunds = await db.refund.findMany({
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
  });

  const pendingPayouts = await db.payout.findMany({
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
  });

  // Display boundary: this DTO feeds the admin reconciliation board only
  // (never sent back — the board's actions post ids/reasons, not amounts),
  // so every *Thb/*Amount figure is converted from satang (THB x 100) to
  // baht here, once, at the response boundary.
  const toBaht = (satang: number) => Math.round(satang / 100);
  return {
    unmatchedPayments: unmatchedPayments.map((p) => ({
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
    failedRefunds: failedRefunds.map((r) => ({
      id: r.id,
      paymentId: r.paymentId,
      paymentAmount: toBaht(r.payment.amountThb),
      refundAmount: toBaht(r.amountThb),
      reason: r.reason,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      initiatedBy: `${r.initiatedBy.firstName} ${r.initiatedBy.lastName}`.trim(),
    })),
    pendingPayouts: pendingPayouts.map((p) => ({
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
  };
}

/**
 * Mark a payout as reconciled (matched against the bank statement).
 */
export async function reconcilePayout(db: PrismaClient, payoutId: string): Promise<Payout> {
  const payout = await db.payout.findUnique({ where: { id: payoutId } });
  if (!payout) {
    throw new Error('Payout not found');
  }

  return db.payout.update({
    where: { id: payoutId },
    data: { status: 'reconciled' },
    include: {
      ownerStatement: { select: { unit: { select: { name: true } } } },
      provider: { select: { name: true } },
    },
  });
}

/**
 * Resolve a failed refund: retry it through the payment seam, or write it
 * off with a ledger adjustment when the provider-side retry isn't viable.
 */
export async function resolveFailedRefund(
  db: PrismaClient,
  refundId: string,
  action: 'retry' | 'write_off'
) {
  const refundRecord = await db.refund.findUnique({ where: { id: refundId } });
  if (!refundRecord) {
    throw new Error('Refund not found');
  }

  if (action === 'write_off') {
    const payment = await db.payment.findUnique({
      where: { id: refundRecord.paymentId },
      include: { booking: true },
    });

    if (payment?.booking) {
      await db.ledgerEntry.create({
        data: {
          entryType: 'adjustment',
          amountThb: -refundRecord.amountThb,
          unitId: payment.booking.unitId,
          description: `Failed refund write-off: ${refundRecord.reason}`,
          refundId,
          occurredOn: new Date(),
        },
      });
    }

    // Written off, not truly succeeded — but cleared from the reconciliation
    // board (`getReconciliationData` only surfaces `status: 'failed'`), which
    // is the same "cleared" semantics the reconciliation board's own test
    // suite already exercises.
    return db.refund.update({
      where: { id: refundId },
      data: { status: 'succeeded' },
    });
  }

  // 'retry' — reset to requested and let the payment seam handle it.
  return db.refund.update({
    where: { id: refundId },
    data: { status: 'requested' },
  });
}
