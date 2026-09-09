import { PrismaClient, Payout } from '@prisma/client';
import { getConfig } from '@/modules/config';
import { satangToBaht } from '@/lib/money';

export type PayoutPeriodCadence = 'weekly' | 'biweekly' | 'monthly';

export interface RemittanceReport {
  providerId: string;
  periodStart: Date;
  periodEnd: Date;
  fulfilledOrdersTotal: number;
  takeRateThb: number;
  refundsClawedBack: number;
  lateRefundAdjustments: number;
  pendingRefundCount: number;
  netThb: number;
  orderCount: number;
  refundCount: number;
}

export interface ProviderRemittancePayoutRow {
  id: string;
  periodStart: string;
  periodEnd: string;
  amountThb: number;
  reference: string;
  executedOn: string;
  status: string;
}

export interface ProviderRemittancesView {
  cadence: PayoutPeriodCadence;
  currentPeriod: {
    periodStart: string;
    periodEnd: string;
    remittance: RemittanceReport;
    payoutRecorded: boolean;
    payoutId: string | null;
  };
  payouts: ProviderRemittancePayoutRow[];
}

/** Resolve a half-open provider payout period [start, end). */
export function resolveProviderPayoutPeriod(
  now: Date,
  cadence: PayoutPeriodCadence
): { periodStart: Date; periodEnd: Date } {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();

  if (cadence === 'monthly') {
    return {
      periodStart: new Date(Date.UTC(y, m, 1)),
      periodEnd: new Date(Date.UTC(y, m + 1, 1)),
    };
  }

  const today = new Date(Date.UTC(y, m, d));
  const dow = today.getUTCDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const weekStart = new Date(today);
  weekStart.setUTCDate(today.getUTCDate() + mondayOffset);

  if (cadence === 'weekly') {
    const periodEnd = new Date(weekStart);
    periodEnd.setUTCDate(weekStart.getUTCDate() + 7);
    return { periodStart: weekStart, periodEnd };
  }

  const yearStart = new Date(Date.UTC(y, 0, 1));
  const yearStartDow = yearStart.getUTCDay();
  const daysToFirstMonday = yearStartDow === 0 ? 1 : yearStartDow === 1 ? 0 : 8 - yearStartDow;
  const firstMonday = new Date(yearStart);
  firstMonday.setUTCDate(1 + daysToFirstMonday);

  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const weeksFromAnchor = Math.floor((weekStart.getTime() - firstMonday.getTime()) / msPerWeek);
  const biweekBlock = Math.floor(weeksFromAnchor / 2) * 2;
  const periodStart = new Date(firstMonday.getTime() + biweekBlock * msPerWeek);
  const periodEnd = new Date(periodStart.getTime() + 14 * msPerWeek);
  return { periodStart, periodEnd };
}

/** Provider portal current-period report plus immutable payout history. */
export async function getProviderRemittancesView(
  db: PrismaClient,
  providerId: string,
  now: Date = new Date()
): Promise<ProviderRemittancesView> {
  const cadenceRaw = await getConfig(db, 'services.payout_period');
  const cadence: PayoutPeriodCadence =
    cadenceRaw === 'biweekly' || cadenceRaw === 'monthly' ? cadenceRaw : 'weekly';

  const { periodStart, periodEnd } = resolveProviderPayoutPeriod(now, cadence);
  const remittance = await computeProviderRemittance(db, providerId, periodStart, periodEnd);

  const currentPayout = await db.payout.findFirst({
    where: { providerId, payeeType: 'provider', periodStart, periodEnd },
    select: { id: true },
  });

  const payouts = await db.payout.findMany({
    where: { providerId, payeeType: 'provider' },
    orderBy: [{ executedOn: 'desc' }, { createdAt: 'desc' }],
    take: 24,
  });

  return {
    cadence,
    currentPeriod: {
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      remittance,
      payoutRecorded: Boolean(currentPayout),
      payoutId: currentPayout?.id ?? null,
    },
    payouts: payouts.map((p) => ({
      id: p.id,
      periodStart: p.periodStart?.toISOString() ?? '',
      periodEnd: p.periodEnd?.toISOString() ?? '',
      amountThb: p.amountThb,
      reference: p.reference,
      executedOn: p.executedOn.toISOString().split('T')[0],
      status: p.status,
    })),
  };
}

/** Whether a timestamp belongs to a recorded provider payout period. */
function wasCoveredByPayout(
  fulfilledAt: Date | null,
  refundCreatedAt: Date,
  payouts: Array<{ periodStart: Date | null; periodEnd: Date | null; createdAt: Date }>
): boolean {
  if (!fulfilledAt) return false;
  return payouts.some(
    (payout) =>
      payout.periodStart &&
      payout.periodEnd &&
      payout.createdAt < refundCreatedAt &&
      fulfilledAt >= payout.periodStart &&
      fulfilledAt < payout.periodEnd
  );
}

/**
 * Compute a provider remittance without rewriting closed history.
 *
 * Rules:
 * - service revenue belongs to immutable `fulfilled_at`;
 * - commission comes from each order's take-rate snapshot;
 * - open disputes hold an order out of the payable set;
 * - succeeded refunds initiated before this period ends are charged to the
 *   order's own period only when that period has not already been paid;
 * - a refund initiated after an earlier payout is carried into the period in
 *   which the refund was initiated (`lateRefundAdjustments`);
 * - requested/processing refunds on current-period orders block payout record
 *   creation, preventing an unresolved refund from becoming a later hidden
 *   historical mutation.
 */
export async function computeProviderRemittance(
  db: PrismaClient,
  providerId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<RemittanceReport> {
  const candidateOrders = await db.serviceOrder.findMany({
    where: {
      provider_id: providerId,
      status: { in: ['fulfilled', 'closed'] },
      fulfilled_at: { gte: periodStart, lt: periodEnd },
    },
  });

  const candidateIds = candidateOrders.map((order) => order.id);
  const openDisputes = candidateIds.length
    ? await db.dispute.findMany({
        where: {
          subjectType: 'service_order',
          subjectId: { in: candidateIds },
          decidedAt: null,
        },
        select: { subjectId: true },
      })
    : [];
  const heldOrderIds = new Set(openDisputes.map((row) => row.subjectId));
  const eligibleOrders = candidateOrders.filter((order) => !heldOrderIds.has(order.id));
  const eligibleOrderIds = eligibleOrders.map((order) => order.id);

  const fulfilledOrdersTotal = eligibleOrders.reduce((sum, order) => sum + order.total_thb, 0);
  const takeRateThb = eligibleOrders.reduce(
    (sum, order) =>
      sum + Math.round(order.total_thb * (Number(order.take_rate_pct_snapshot) / 100)),
    0
  );

  const paymentsForOrders = eligibleOrderIds.length
    ? await db.payment.findMany({
        where: { serviceOrderId: { in: eligibleOrderIds } },
        include: {
          refunds: {
            where: {
              createdAt: { lt: periodEnd },
              status: { in: ['requested', 'processing', 'succeeded'] },
            },
          },
        },
      })
    : [];

  const succeededCurrentRefunds = paymentsForOrders.flatMap((payment) =>
    payment.refunds.filter((refund) => refund.status === 'succeeded')
  );
  const pendingRefundCount = paymentsForOrders.reduce(
    (sum, payment) =>
      sum + payment.refunds.filter((refund) =>
        refund.status === 'requested' || refund.status === 'processing'
      ).length,
    0
  );
  const refundsClawedBack = succeededCurrentRefunds.reduce(
    (sum, refund) => sum + refund.amountThb,
    0
  );

  const priorPayouts = await db.payout.findMany({
    where: {
      providerId,
      payeeType: 'provider',
      periodEnd: { lte: periodStart },
    },
    select: { periodStart: true, periodEnd: true, createdAt: true },
  });

  const lateRefundCandidates = await db.refund.findMany({
    where: {
      status: 'succeeded',
      createdAt: { gte: periodStart, lt: periodEnd },
      payment: {
        serviceOrder: {
          provider_id: providerId,
          fulfilled_at: { lt: periodStart },
        },
      },
    },
    select: {
      amountThb: true,
      createdAt: true,
      payment: {
        select: {
          serviceOrder: { select: { fulfilled_at: true } },
        },
      },
    },
  });

  const carriedRefunds = lateRefundCandidates.filter((refund) =>
    wasCoveredByPayout(
      refund.payment.serviceOrder?.fulfilled_at ?? null,
      refund.createdAt,
      priorPayouts
    )
  );
  const lateRefundAdjustments = carriedRefunds.reduce((sum, refund) => sum + refund.amountThb, 0);

  const refundCount = succeededCurrentRefunds.length + carriedRefunds.length;
  const netThb = fulfilledOrdersTotal - takeRateThb - refundsClawedBack - lateRefundAdjustments;

  return {
    providerId,
    periodStart,
    periodEnd,
    fulfilledOrdersTotal,
    takeRateThb,
    refundsClawedBack,
    lateRefundAdjustments,
    pendingRefundCount,
    netThb,
    orderCount: eligibleOrders.length,
    refundCount,
  };
}

/** Admin reconciliation board data. */
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

  return {
    unmatchedPayments: unmatchedPayments.map((p) => ({
      id: p.id,
      amountThb: satangToBaht(p.amountThb),
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
      paymentAmount: satangToBaht(r.payment.amountThb),
      refundAmount: satangToBaht(r.amountThb),
      reason: r.reason,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      initiatedBy: `${r.initiatedBy.firstName} ${r.initiatedBy.lastName}`.trim(),
    })),
    pendingPayouts: pendingPayouts.map((p) => ({
      id: p.id,
      payeeType: p.payeeType,
      amountThb: satangToBaht(p.amountThb),
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

/** Mark a recorded payout reconciled; its amount and period remain immutable. */
export async function reconcilePayout(db: PrismaClient, payoutId: string): Promise<Payout> {
  const payout = await db.payout.findUnique({ where: { id: payoutId } });
  if (!payout) throw new Error('Payout not found');

  return db.payout.update({
    where: { id: payoutId },
    data: { status: 'reconciled' },
    include: {
      ownerStatement: { select: { unit: { select: { name: true } } } },
      provider: { select: { name: true } },
    },
  });
}

/** Resolve a failed refund without silently losing its ledger consequence. */
export async function resolveFailedRefund(
  db: PrismaClient,
  refundId: string,
  action: 'retry' | 'write_off'
) {
  const refundRecord = await db.refund.findUnique({ where: { id: refundId } });
  if (!refundRecord) throw new Error('Refund not found');

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

    return db.refund.update({
      where: { id: refundId },
      data: { status: 'succeeded' },
    });
  }

  return db.refund.update({
    where: { id: refundId },
    data: { status: 'requested' },
  });
}
