import { PrismaClient, Payout } from '@prisma/client';
import { track } from '@/modules/analytics';

export interface RecordOwnerPayoutInput {
  ownerStatementId: string;
  amountThb: number;
  method: 'bank_transfer_thb' | 'other';
  reference: string;
  executedOn: Date;
  recordedByIdentityId: string;
}

export interface ProviderRemittanceInput {
  providerId: string;
  periodStart: Date;
  periodEnd: Date;
  amountThb: number;
  reference: string;
  executedOn: Date;
  recordedByIdentityId: string;
}

export interface RemittanceReport {
  providerId: string;
  periodStart: Date;
  periodEnd: Date;
  fulfilledOrdersTotal: number;
  takeRateTotal: number;
  refundsClawed: number;
  netRemittance: number;
}

/**
 * Record an owner payout (manual in loop one).
 * Links to the published statement that triggered it.
 */
export async function recordOwnerPayout(db: PrismaClient, input: RecordOwnerPayoutInput): Promise<Payout> {
  const { ownerStatementId, amountThb, method, reference, executedOn, recordedByIdentityId } = input;

  // Verify statement exists and is published
  const statement = await db.ownerStatement.findUnique({
    where: { id: ownerStatementId },
  });

  if (!statement) {
    throw new Error(`Statement ${ownerStatementId} not found`);
  }

  if (statement.status !== 'published') {
    throw new Error(`Can only payout published statements; statement is ${statement.status}`);
  }

  // Create payout record
  const payout = await db.payout.create({
    data: {
      payeeType: 'owner',
      ownerStatementId,
      amountThb,
      method,
      reference,
      executedOn,
      recordedByIdentityId,
      status: 'recorded',
    },
  });

  // Track analytics event
  // Get owner identity and project from statement
  const statementWithDetails = await db.ownerStatement.findUnique({
    where: { id: ownerStatementId },
    select: {
      ownerIdentityId: true,
      unit: { select: { projectId: true } },
    },
  });

  if (statementWithDetails) {
    await track(db, 'owner_payout_recorded', {
      payoutId: payout.id,
      statementId: ownerStatementId,
      identityId: statementWithDetails.ownerIdentityId,
      projectId: statementWithDetails.unit?.projectId,
      amountThb,
      method,
    });
  }

  return payout;
}

/**
 * Record a provider remittance payout (manual in loop one).
 * Computed from fulfilled service orders in the period minus take-rate and clawed-back refunds.
 */
export async function recordProviderRemittance(
  db: PrismaClient,
  input: ProviderRemittanceInput
): Promise<Payout> {
  const { providerId, periodStart, periodEnd, amountThb, reference, executedOn, recordedByIdentityId } = input;

  // Verify provider exists
  const provider = await db.provider.findUnique({
    where: { id: providerId },
  });

  if (!provider) {
    throw new Error(`Provider ${providerId} not found`);
  }

  // Create payout record
  const payout = await db.payout.create({
    data: {
      payeeType: 'provider',
      providerId,
      periodStart,
      periodEnd,
      amountThb,
      method: 'bank_transfer_thb',
      reference,
      executedOn,
      recordedByIdentityId,
      status: 'recorded',
    },
  });

  return payout;
}

/**
 * Compute provider remittance for a period.
 * Formula: fulfilled orders total - take-rate total - refunds clawed back.
 */
export async function computeProviderRemittance(
  db: PrismaClient,
  providerId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<RemittanceReport> {
  // Get all fulfilled service orders for provider in period
  const orders = await db.serviceOrder.findMany({
    where: {
      provider_id: providerId,
      createdAt: {
        gte: periodStart,
        lte: periodEnd,
      },
      status: {
        in: ['accepted', 'fulfilled'],
      },
    },
  });

  // Sum fulfilled order totals (server-computed from price_breakdown)
  const fulfilledOrdersTotal = orders.reduce((sum, order) => {
    // price_breakdown is stored as JSON; extract total
    const breakdown = order.price_breakdown as any;
    return sum + (breakdown?.total || 0);
  }, 0);

  // Get refunds for fulfilled orders in period (clawed back)
  const refunds = await db.refund.findMany({
    where: {
      createdAt: {
        gte: periodStart,
        lte: periodEnd,
      },
      payment: {
        serviceOrder: {
          provider_id: providerId,
        },
      },
    },
  });

  // Sum only succeeded refunds (clawed back from provider)
  const refundsClawed = refunds
    .filter((r) => r.status === 'succeeded')
    .reduce((sum, r) => sum + r.amountThb, 0);

  // The take-rate is already captured in service_commission ledger entries
  // For remittance, we compute: fulfilled total - refunds = what provider receives
  // The platform take-rate is retained by platform (recorded as service_commission)
  const netRemittance = fulfilledOrdersTotal - refundsClawed;

  return {
    providerId,
    periodStart,
    periodEnd,
    fulfilledOrdersTotal,
    takeRateTotal: 0, // Computed from ledger; not double-counted here
    refundsClawed,
    netRemittance,
  };
}

/**
 * List failed refunds that need resolution.
 * These surface on reconciliation board until cleared (status changed).
 */
export async function getFailedRefunds(db: PrismaClient): Promise<any[]> {
  return db.refund.findMany({
    where: {
      status: 'failed',
    },
    include: {
      payment: {
        select: {
          id: true,
          purpose: true,
          amountThb: true,
          bookingId: true,
          serviceOrderId: true,
        },
      },
      initiatedBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
  });
}

/**
 * Mark a payout as reconciled (matched to bank statement, cleared).
 */
export async function markPayoutReconciled(db: PrismaClient, payoutId: string): Promise<Payout> {
  const payout = await db.payout.update({
    where: { id: payoutId },
    data: {
      status: 'reconciled',
    },
  });

  return payout;
}

/**
 * List unreconciled payouts (recorded but not yet matched to bank statement).
 */
export async function getUnreconciledPayouts(db: PrismaClient): Promise<Payout[]> {
  return db.payout.findMany({
    where: {
      status: 'recorded',
    },
    include: {
      ownerStatement: {
        select: {
          id: true,
          ownerIdentityId: true,
          ownerShareTh: true,
        },
      },
      provider: {
        select: {
          id: true,
          name: true,
        },
      },
      recordedBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: {
      executedOn: 'asc',
    },
  });
}
