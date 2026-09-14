import { PrismaClient } from '@prisma/client';
import { getConfig } from '@/modules/config';

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
 * Provider remittance is based on immutable business facts, not mutable rows:
 * fulfilled_at fixes the accounting period, each order's take-rate snapshot
 * fixes accepted economics, open disputes hold payout, and late refunds are
 * carried forward instead of rewriting an already-paid period.
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
      sum +
      payment.refunds.filter(
        (refund) => refund.status === 'requested' || refund.status === 'processing'
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
