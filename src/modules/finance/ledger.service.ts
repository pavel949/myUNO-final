import { Prisma, PrismaClient, LedgerEntry, LedgerEntryType } from '@prisma/client';
import { calendarDayIn, DEFAULT_TIME_ZONE, startOfCalendarDayUtc } from '@/lib/date';
import { MANUAL_COST_TYPES } from './manual-cost-input';

export interface RecordCostInput {
  unitId: string;
  entryType: LedgerEntryType;
  amountThb: number;
  occurredOn: Date;
  description: string;
  receiptMediaId?: string;
  recordedByIdentityId: string;
}

export interface LedgerEntryWithRelations extends LedgerEntry {
  unit?: { id: string; name: string } | null;
  project?: { id: string; name: string } | null;
  createdBy?: { id: string; firstName: string; lastName: string } | null;
}

/**
 * Record a cost entry in the ledger.
 * Append-only: creates a new LedgerEntry row, never updates.
 *
 * This is the SYSTEM writer (dispute outcomes, owner-stay turnover). It does no
 * authorisation and has no replay key. A person recording a cost goes through
 * `recordManualCost` (manual-cost.service), which has both.
 */
export async function recordCost(db: PrismaClient, input: RecordCostInput): Promise<LedgerEntry> {
  const entry = await db.ledgerEntry.create({
    data: {
      entryType: input.entryType,
      amountThb: input.amountThb,
      unitId: input.unitId,
      occurredOn: input.occurredOn,
      description: input.description,
      createdByIdentityId: input.recordedByIdentityId,
      projectId: input.unitId
        ? (await db.unit.findUnique({ where: { id: input.unitId }, select: { projectId: true } }))?.projectId
        : undefined,
    },
  });

  return entry;
}

/**
 * Create an auto entry for booking revenue (called on payment confirmation).
 * Append-only; no update path.
 */
export async function recordBookingRevenue(
  db: PrismaClient,
  bookingId: string,
  unitId: string,
  amountThb: number,
  occurredOn: Date
): Promise<LedgerEntry> {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: { id: true },
  });

  if (!booking) {
    throw new Error(`Booking ${bookingId} not found`);
  }

  const unit = await db.unit.findUnique({
    where: { id: unitId },
    select: { projectId: true },
  });

  const entry = await db.ledgerEntry.create({
    data: {
      entryType: 'rental_revenue',
      amountThb,
      unitId,
      projectId: unit?.projectId,
      bookingId,
      occurredOn,
      description: `Booking revenue for booking ${bookingId}`,
      createdByIdentityId: null,
    },
  });

  return entry;
}

/**
 * Create an auto entry for a refund (called on refund processing).
 * Append-only; no update path.
 */
export async function recordRefundOut(
  db: PrismaClient,
  refundId: string,
  unitId: string | null,
  projectId: string | null,
  amountThb: number,
  occurredOn: Date
): Promise<LedgerEntry> {
  const entry = await db.ledgerEntry.create({
    data: {
      entryType: 'refund_out',
      amountThb: -Math.abs(amountThb),
      unitId,
      projectId,
      refundId,
      occurredOn,
      description: `Refund ${refundId}`,
      createdByIdentityId: null,
    },
  });

  return entry;
}

/**
 * Create an auto entry for service commission (called on service order payment).
 * Append-only; no update path.
 */
export async function recordServiceCommission(
  db: PrismaClient,
  serviceOrderId: string,
  unitId: string | null,
  projectId: string,
  commissionAmountThb: number,
  occurredOn: Date
): Promise<LedgerEntry> {
  const entry = await db.ledgerEntry.create({
    data: {
      entryType: 'service_commission',
      amountThb: commissionAmountThb,
      unitId,
      projectId,
      serviceOrderId,
      occurredOn,
      description: `Service commission for order ${serviceOrderId}`,
      createdByIdentityId: null,
    },
  });

  return entry;
}

/**
 * Reverse a ledger entry via an admin-only reversal entry.
 * Append-only: creates a new negative entry instead of updating the original.
 *
 * Generic and unlinked: it carries no `reversesEntryId`, so it cannot stop a
 * second reversal. The HTTP route uses `reverseManualCost` below instead.
 */
export async function reverseLedgerEntry(
  db: PrismaClient,
  entryId: string,
  reverseReason: string,
  reversedByIdentityId: string
): Promise<LedgerEntry> {
  const original = await db.ledgerEntry.findUnique({
    where: { id: entryId },
  });

  if (!original) {
    throw new Error(`LedgerEntry ${entryId} not found`);
  }

  // Create a reversal entry: same amount but opposite sign.
  //
  // The reversal carries the ORIGINAL's occurredOn, not today's date. occurredOn
  // is the accrual date — "which month's statement it lands in" (doc 02 §5.3) —
  // and statements sweep ledger entries by occurredOn within the period
  // (statement.service). Dating the reversal today would leave the wrong entry
  // standing in its own period's NOI and drop the correction into a different
  // month, so the correction would never cancel what it corrects. createdAt
  // still records when the reversal was actually made (the audit trail).
  const reversal = await db.ledgerEntry.create({
    data: {
      entryType: 'adjustment',
      amountThb: -original.amountThb,
      unitId: original.unitId,
      projectId: original.projectId,
      occurredOn: original.occurredOn,
      description: `Reversal of ${original.description}: ${reverseReason}`,
      createdByIdentityId: reversedByIdentityId,
    },
  });

  return reversal;
}

/**
 * Get ledger entries for a unit within a date range.
 * Used for statement generation and reconciliation.
 */
export async function getUnitLedgerEntries(
  db: PrismaClient,
  unitId: string,
  startDate: Date,
  endDate: Date
): Promise<LedgerEntryWithRelations[]> {
  const entries = await db.ledgerEntry.findMany({
    where: {
      unitId,
      occurredOn: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      unit: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
    },
    // createdAt breaks ties so entries sharing an accrual date (an original and
    // its reversal, for instance) always read back in the order they were written.
    orderBy: [{ occurredOn: 'asc' }, { createdAt: 'asc' }],
  });

  return entries;
}

/**
 * Get all ledger entries for a project within a date range.
 * Used for admin reporting.
 */
export async function getProjectLedgerEntries(
  db: PrismaClient,
  projectId: string,
  startDate: Date,
  endDate: Date
): Promise<LedgerEntryWithRelations[]> {
  const entries = await db.ledgerEntry.findMany({
    where: {
      projectId,
      occurredOn: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      unit: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: [{ occurredOn: 'asc' }, { createdAt: 'asc' }],
  });

  return entries;
}

/**
 * Get a specific ledger entry by ID.
 */
export async function getLedgerEntry(
  db: PrismaClient,
  entryId: string
): Promise<LedgerEntryWithRelations | null> {
  return db.ledgerEntry.findUnique({
    where: { id: entryId },
    include: {
      unit: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}

/**
 * Compute total revenue and costs for a unit in a period.
 * Used by statement generation.
 */
export async function computeUnitLedgerTotals(
  db: PrismaClient,
  unitId: string,
  startDate: Date,
  endDate: Date
): Promise<{ totalRevenueTh: number; totalCostsTh: number; netTh: number }> {
  const result = await db.ledgerEntry.aggregate({
    where: {
      unitId,
      occurredOn: {
        gte: startDate,
        lte: endDate,
      },
    },
    _sum: { amountThb: true },
  });

  const net = result._sum.amountThb || 0;

  // Separate positive (revenue) and negative (costs)
  const entries = await getUnitLedgerEntries(db, unitId, startDate, endDate);
  const totalRevenue = entries.filter((e) => e.amountThb > 0).reduce((sum, e) => sum + e.amountThb, 0);
  const totalCosts = Math.abs(entries.filter((e) => e.amountThb < 0).reduce((sum, e) => sum + e.amountThb, 0));

  return {
    totalRevenueTh: totalRevenue,
    totalCostsTh: totalCosts,
    netTh: net,
  };
}

// ---------------------------------------------------------------------------
// Manual costs: per-unit ledger lock and linked reversal
// ---------------------------------------------------------------------------

type LockClient = Pick<Prisma.TransactionClient, '$executeRaw'>;

/**
 * A writer of ledger facts that feed a unit's owner statement takes this
 * SHARED lock; whoever freezes a statement (generate, sign-off) takes the
 * EXCLUSIVE one. Writers do not block each other, but none can commit between a
 * statement's snapshot check and its signature, and a statement cannot be
 * frozen while a cost is half-written. Transaction-scoped: released on commit
 * or rollback, so a crashed request never holds it.
 *
 * Lock order everywhere: unit ledger lock first, then the statement row.
 */
export async function lockUnitLedgerShared(tx: LockClient, unitId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock_shared(hashtextextended(${'unit-ledger:' + unitId}, 0))`;
}

export async function lockUnitLedgerExclusive(tx: LockClient, unitId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'unit-ledger:' + unitId}, 0))`;
}

export type LedgerCorrectionCode =
  | 'not_found'
  | 'not_reversible'
  | 'already_reversed'
  | 'invalid_reason';

export class LedgerCorrectionError extends Error {
  readonly code: LedgerCorrectionCode;
  constructor(code: LedgerCorrectionCode, message: string) {
    super(message);
    this.name = 'LedgerCorrectionError';
    this.code = code;
  }
}

export const REVERSAL_REASON_MIN = 3;
export const REVERSAL_REASON_MAX = 500;

/** Statuses at which an owner statement has been issued and must not be rewritten. */
const ISSUED_STATEMENT_STATUSES = ['published', 'pending_owner_review', 'signed_off', 'distributed'] as const;

export interface ManualCostReversal {
  reversal: LedgerEntry;
  original: LedgerEntry;
  /**
   * `same_period`: the reversal carries the original's date and nets inside the
   * original's statement. `current_period`: that statement was already issued,
   * so the correction is dated today and lands in the open period instead — the
   * issued statement is never rewritten, and the correction is not lost.
   */
  dating: 'same_period' | 'current_period';
}

/**
 * Reverse a manual cost. Admin authority is the caller's to establish.
 *
 * One original has at most one reversal: the UNIQUE index on
 * `reverses_entry_id` is the guarantee, and a second attempt — concurrent or
 * later — is `already_reversed`, never a second row. Only the four manual cost
 * kinds are reversible here; revenue, refunds and payouts have their own
 * correction processes and must not be erasable through a cost screen.
 */
export async function reverseManualCost(
  db: PrismaClient,
  input: { entryId: string; reason: string; actorIdentityId: string; now?: Date }
): Promise<ManualCostReversal> {
  const reason = input.reason.normalize('NFC').replace(/\s+/g, ' ').trim();
  if (reason.length < REVERSAL_REASON_MIN || reason.length > REVERSAL_REASON_MAX) {
    throw new LedgerCorrectionError(
      'invalid_reason',
      `A reason of ${REVERSAL_REASON_MIN}–${REVERSAL_REASON_MAX} characters is required.`
    );
  }
  const now = input.now ?? new Date();

  try {
    return await db.$transaction(
      async (tx) => {
        const original = await tx.ledgerEntry.findUnique({
          where: { id: input.entryId },
          include: { unit: { select: { project: { select: { timezone: true } } } } },
        });
        if (!original) {
          throw new LedgerCorrectionError('not_found', `Ledger entry ${input.entryId} not found`);
        }
        if (
          !original.unitId ||
          original.reversesEntryId !== null ||
          !(MANUAL_COST_TYPES as readonly string[]).includes(original.entryType)
        ) {
          throw new LedgerCorrectionError(
            'not_reversible',
            'Only a manually recorded cost can be reversed here.'
          );
        }

        await lockUnitLedgerShared(tx, original.unitId);

        // Friendly answer for the common case; the UNIQUE index below is the
        // guarantee for the concurrent one.
        const already = await tx.ledgerEntry.findUnique({
          where: { reversesEntryId: original.id },
          select: { id: true },
        });
        if (already) {
          throw new LedgerCorrectionError('already_reversed', 'This cost has already been reversed.');
        }

        const issued = await tx.ownerStatement.findFirst({
          where: {
            unitId: original.unitId,
            periodStart: { lte: original.occurredOn },
            periodEnd: { gte: original.occurredOn },
            status: { in: [...ISSUED_STATEMENT_STATUSES] },
          },
          select: { id: true },
        });

        const zone = original.unit?.project?.timezone ?? DEFAULT_TIME_ZONE;
        const occurredOn = issued
          ? startOfCalendarDayUtc(calendarDayIn(now, zone))
          : original.occurredOn;

        const reversal = await tx.ledgerEntry.create({
          data: {
            entryType: 'adjustment',
            amountThb: -original.amountThb,
            unitId: original.unitId,
            projectId: original.projectId,
            occurredOn,
            description: `Reversal of ${original.description}: ${reason}`,
            createdByIdentityId: input.actorIdentityId,
            reversesEntryId: original.id,
          },
        });

        await tx.auditLog.create({
          data: {
            action: 'ledger_entry_reversed',
            entityType: 'ledger_entry',
            entityId: original.id,
            actorIdentityId: input.actorIdentityId,
            data: {
              reversalEntryId: reversal.id,
              dating: issued ? 'current_period' : 'same_period',
            },
          },
        });

        return {
          reversal,
          original,
          dating: issued ? ('current_period' as const) : ('same_period' as const),
        };
      },
      { timeout: 15_000 }
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new LedgerCorrectionError('already_reversed', 'This cost has already been reversed.');
    }
    throw error;
  }
}
