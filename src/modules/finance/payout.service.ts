import { PrismaClient, Payout } from '@prisma/client';
import { getConfig } from '@/modules/config';
import { satangToBaht } from '@/lib/money';
import { lockBookingInventory } from '@/modules/core/booking-occupancy';
import { processRequestedCardRefund } from './finance.service';

export type PayoutPeriodCadence = 'weekly' | 'biweekly' | 'monthly';

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

/**
 * Resolve the active provider payout period for a cadence (doc 10 §5).
 * Periods are half-open: [periodStart, periodEnd).
 */
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

/**
 * Provider portal remittance view (F-PROV-4): current-period report plus
 * recorded payout history scoped to the caller's provider.
 */
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
    where: {
      providerId,
      payeeType: 'provider',
      periodStart,
      periodEnd,
    },
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
      OR: [
        { reconciliationReason: { not: null } },
        { method: 'card_provider', provider: { not: 'mock' }, status: 'created', createdAt: { lte: new Date(Date.now() - 120_000) } },
        { AND: [{ OR: [{ bookingId: null }, { status: 'failed' }] }, { serviceOrderId: null }] },
      ],
    },
    include: {
      payer: { select: { id: true, firstName: true, lastName: true } },
      refunds: { where: { status: 'succeeded' }, select: { amountThb: true } },
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
  return {
    unmatchedPayments: unmatchedPayments.filter(p => !p.reconciliationReason ||
      p.refunds.reduce((sum, refund) => sum + refund.amountThb, 0) < p.amountThb).map((p) => ({
      id: p.id,
      amountThb: satangToBaht(p.amountThb),
      method: p.method,
      purpose: p.purpose,
      status: p.status,
      createdAt: p.createdAt.toISOString(),
      payer: `${p.payer.firstName} ${p.payer.lastName}`.trim(),
      bookingId: p.bookingId,
      serviceOrderId: p.serviceOrderId,
      reconciliationReason: p.reconciliationReason ?? (p.status === 'created' ? 'CHECKOUT_PROVIDER_OUTCOME_UNKNOWN' : null),
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
  const result = await db.$transaction(async tx => {
    const snapshot = await tx.refund.findUnique({ where: { id: refundId } });
    if (!snapshot) throw new Error('Refund not found');
    const source = await tx.payment.findUniqueOrThrow({ where: { id: snapshot.paymentId } });
    if (source.bookingId) await lockBookingInventory(tx, source.bookingId);
    if (source.serviceOrderId) await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${source.serviceOrderId}))`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${source.id}))`;
    await tx.$queryRaw`SELECT id FROM refund WHERE id = ${refundId} FOR UPDATE`;
    const current = await tx.refund.findUniqueOrThrow({ where: { id: refundId }, include: { payment: { include: { booking: true } } } });
    const conflict = (message: string) => Object.assign(new Error(message), { code: 'REFUND_RESOLUTION_CONFLICT' });

    if (action === 'write_off' && current.status === 'written_off') return current;
    if (action === 'retry' && current.status === 'requested' && current.method === 'card_provider' &&
        current.payment.bookingId && !current.dispatchAuthorizedAt) {
      throw conflict('The previous provider refund outcome must be reconciled before retrying');
    }
    // A repeated retry observes the durable claim; never reset settled money.
    if (action === 'retry' && ['requested', 'processing', 'succeeded'].includes(current.status)) return current;
    if (current.status !== 'failed') throw conflict('Only a failed refund can be resolved');

    if (action === 'write_off') {
      if (current.payment.booking) {
        await tx.ledgerEntry.create({ data: {
          entryType: 'adjustment', amountThb: -current.amountThb,
          unitId: current.payment.booking.unitId,
          description: `Failed refund write-off: ${current.reason}`,
          refundId, occurredOn: new Date(),
        } });
      }
      // Administrative closure does not claim that money reached the guest.
      return tx.refund.update({ where: { id: refundId }, data: { status: 'written_off' } });
    }

    if (current.payment.status !== 'succeeded') throw conflict('Only a succeeded payment can be refunded');
    // Failed attempts release capacity. Another request may have reserved or
    // returned this money in the meantime, so recheck under the source lock.
    const reserved = await tx.refund.aggregate({
      where: { paymentId: current.paymentId, id: { not: current.id },
        status: { in: ['requested', 'processing', 'succeeded'] } },
      _sum: { amountThb: true },
    });
    const remaining = current.payment.amountThb - (reserved._sum.amountThb ?? 0);
    if (current.amountThb <= 0 || current.amountThb > remaining) {
      throw conflict('Refund exceeds the remaining payment refund capacity');
    }

    // Older booking refunds marked transport exceptions failed. Without a
    // provider refund ID, absence of a response cannot prove no money moved.
    const receiptQuarantined = current.payment.reconciliationReason &&
      !['SERVICE_REFUND_REVIEW_REQUIRED', 'SERVICE_REFUND_PROVIDER_UNAVAILABLE'].includes(current.payment.reconciliationReason);
    if (current.method === 'card_provider' && (receiptQuarantined ||
        (current.payment.provider !== 'mock' && !current.providerRefundId))) {
      throw conflict('The previous provider refund outcome must be reconciled before retrying');
    }
    if (current.payment.reconciliationReason === 'SERVICE_REFUND_REVIEW_REQUIRED') {
      await tx.payment.update({ where: { id: current.paymentId }, data: { reconciliationReason: null } });
    }
    return tx.refund.update({ where: { id: refundId }, data: { status: 'requested', providerRefundId: null,
      ...(current.method === 'card_provider' && current.payment.bookingId ? { dispatchAuthorizedAt: new Date() } : {}),
    } });
  });

  // Dispatch after commit. The dispatcher atomically claims requested work,
  // so repeated/concurrent HTTP retries cannot issue the same refund twice.
  if (action === 'retry' && result.method === 'card_provider' && result.status === 'requested') {
    await processRequestedCardRefund(db, result.id);
    return db.refund.findUniqueOrThrow({ where: { id: result.id } });
  }
  return result;
}
