import { Prisma, type Identity, type LedgerEntryType, type PrismaClient } from '@prisma/client';
import { DEFAULT_TIME_ZONE, toCalendarDay } from '@/lib/date';
import { canWriteUnitExpenses } from './expense-access';
import { lockUnitLedgerShared } from './ledger.service';
import {
  MANUAL_COST_SIGN,
  assertBusinessDay,
  businessDayToStoredDate,
  manualCostFingerprint,
  type ManualCostRequest,
} from './manual-cost-input';

/**
 * Record a cost against a unit — the one authoritative writer behind
 * `POST /api/ledger/record-cost` (doc 07 F-OPS-3, F-MC-2).
 *
 * ## What "one authoritative record" means here
 * - Authority is checked FIRST, per unit, against the live database; a retry is
 *   authorised exactly like the original, so a revoked role cannot replay its
 *   way to a result.
 * - A retry (same actor, same Idempotency-Key, same content) returns the SAME
 *   ledger row. The same key with different content is a conflict and writes
 *   nothing. The key is scoped to the actor (UNIQUE on actor + key), so another
 *   user presenting someone's key neither sees nor collides with their row.
 * - A lost response after commit, and two simultaneous submits, both end on the
 *   UNIQUE index: one insert wins, the loser re-reads and answers as a replay.
 * - The write holds the unit's SHARED ledger lock, so it cannot commit in the
 *   gap between a statement's freshness check and its signature.
 */

export type ManualCostErrorKind =
  | 'unit_not_found'
  | 'forbidden'
  | 'idempotency_conflict';

export class ManualCostError extends Error {
  readonly kind: ManualCostErrorKind;
  constructor(kind: ManualCostErrorKind, message: string) {
    super(message);
    this.name = 'ManualCostError';
    this.kind = kind;
  }
}

/**
 * Where this cost will, or will not, appear — computed from live statement
 * state so the screen never promises more than the server can deliver.
 */
export type ReportImpact =
  | { state: 'no_statement_yet'; period: null; statementId: null }
  | { state: 'draft_regeneration_required'; period: ReportPeriod; statementId: string }
  | { state: 'period_already_issued'; period: ReportPeriod; statementId: string };

export interface ReportPeriod {
  start: string;
  end: string;
}

export interface ManualCostView {
  id: string;
  entryType: LedgerEntryType;
  /** Positive satang magnitude (the ledger stores it negative). */
  amountSatang: number;
  unitId: string;
  /** Business date, `YYYY-MM-DD`. */
  occurredOn: string;
  description: string;
  createdAt: string;
}

export interface RecordManualCostResult {
  entry: ManualCostView;
  replayed: boolean;
  reportImpact: ReportImpact;
}

function toView(entry: {
  id: string;
  entryType: LedgerEntryType;
  amountThb: number;
  unitId: string | null;
  occurredOn: Date;
  description: string;
  createdAt: Date;
}): ManualCostView {
  return {
    id: entry.id,
    entryType: entry.entryType,
    amountSatang: Math.abs(entry.amountThb),
    unitId: entry.unitId as string,
    occurredOn: toCalendarDay(entry.occurredOn),
    description: entry.description,
    createdAt: entry.createdAt.toISOString(),
  };
}

/** Which owner statement, if any, already covers a unit on a business day. */
export async function reportImpactFor(
  db: Pick<PrismaClient, 'ownerStatement'>,
  unitId: string,
  occurredOn: Date
): Promise<ReportImpact> {
  const statement = await db.ownerStatement.findFirst({
    where: {
      unitId,
      periodStart: { lte: occurredOn },
      periodEnd: { gte: occurredOn },
      status: { not: 'superseded' },
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true, status: true, periodStart: true, periodEnd: true },
  });
  if (!statement) return { state: 'no_statement_yet', period: null, statementId: null };
  const period = {
    start: toCalendarDay(statement.periodStart),
    end: toCalendarDay(statement.periodEnd),
  };
  return statement.status === 'draft'
    ? { state: 'draft_regeneration_required', period, statementId: statement.id }
    : { state: 'period_already_issued', period, statementId: statement.id };
}

async function replayOrConflict(
  db: PrismaClient,
  actorId: string,
  request: ManualCostRequest,
  fingerprint: string
): Promise<RecordManualCostResult | null> {
  const existing = await db.ledgerEntry.findUnique({
    where: {
      createdByIdentityId_manualCostKey: {
        createdByIdentityId: actorId,
        manualCostKey: request.idempotencyKey,
      },
    },
  });
  if (!existing) return null;
  if (existing.manualCostFingerprint !== fingerprint) {
    // Deliberately says nothing about what the earlier request contained.
    throw new ManualCostError(
      'idempotency_conflict',
      'This request key was already used for a different cost.'
    );
  }
  return {
    entry: toView(existing),
    replayed: true,
    reportImpact: await reportImpactFor(db, existing.unitId as string, existing.occurredOn),
  };
}

export async function recordManualCost(
  db: PrismaClient,
  actor: Identity,
  request: ManualCostRequest,
  now: Date = new Date()
): Promise<RecordManualCostResult> {
  const unit = await db.unit.findUnique({
    where: { id: request.unitId },
    select: { id: true, projectId: true, project: { select: { timezone: true } } },
  });
  // A caller who may not write costs learns nothing about which unit ids exist.
  if (!unit) {
    throw actor.isAdmin
      ? new ManualCostError('unit_not_found', 'Unit not found')
      : new ManualCostError('forbidden', 'Forbidden');
  }
  if (!(await canWriteUnitExpenses(db, actor, unit, now))) {
    throw new ManualCostError('forbidden', 'Forbidden');
  }

  const zone = unit.project?.timezone ?? DEFAULT_TIME_ZONE;
  // Re-validated against the UNIT's zone; the route only knew the default.
  assertBusinessDay(request.occurredOn, now, zone);

  const fingerprint = manualCostFingerprint(request);

  const replay = await replayOrConflict(db, actor.id, request, fingerprint);
  if (replay) return replay;

  const occurredOn = businessDayToStoredDate(request.occurredOn);

  try {
    const entry = await db.$transaction(
      async (tx) => {
        await lockUnitLedgerShared(tx, unit.id);
        const created = await tx.ledgerEntry.create({
          data: {
            entryType: request.entryType,
            amountThb: MANUAL_COST_SIGN * request.amountSatang,
            unitId: unit.id,
            projectId: unit.projectId,
            occurredOn,
            description: request.description,
            createdByIdentityId: actor.id,
            manualCostKey: request.idempotencyKey,
            manualCostFingerprint: fingerprint,
          },
        });
        await tx.auditLog.create({
          data: {
            action: 'manual_cost_recorded',
            entityType: 'ledger_entry',
            entityId: created.id,
            actorIdentityId: actor.id,
            data: {
              unitId: unit.id,
              entryType: request.entryType,
              amountSatang: request.amountSatang,
              occurredOn: request.occurredOn,
            },
          },
        });
        return created;
      },
      { timeout: 15_000 }
    );

    return {
      entry: toView(entry),
      replayed: false,
      reportImpact: await reportImpactFor(db, unit.id, occurredOn),
    };
  } catch (error) {
    // Two submits of one key raced: the UNIQUE index let one in. The loser
    // answers from the winner's row — as a replay if the content matches.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const winner = await replayOrConflict(db, actor.id, request, fingerprint);
      if (winner) return winner;
    }
    throw error;
  }
}
