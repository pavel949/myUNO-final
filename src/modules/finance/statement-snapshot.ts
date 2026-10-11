import { createHash } from 'crypto'; // unprefixed on purpose: this file is reachable from the finance barrel, which a client component imports (see CLAUDE.md, module rule 2 exception)
import type { BookingStatus, PrismaClient } from '@prisma/client';
import { toCalendarDay } from '@/lib/date';
import {
  NON_EXPENSE_STATEMENT_ENTRY_TYPES,
  OPERATING_EXPENSE_ENTRY_TYPES,
  isStatementLedgerRow,
  type StatementLedgerRow,
} from './statement-expense';

/**
 * The verified snapshot of an owner statement.
 *
 * Two hashes, two questions:
 *
 * - `sourceFingerprint` — "are the facts this statement was built from still
 *   the facts?" Stays, guest payments, ledger rows, the receipt that is current
 *   for each cost, and the ownership chain over the period. Compared by VALUE
 *   (ids, amounts, dates), not by status or timestamp, so an unrelated booking
 *   moving from confirmed to checked-in does not make a statement stale.
 * - `snapshotHash` — "is what was issued still what was issued?" The figures
 *   and every line item.
 *
 * Sign-off re-checks both (see statement-signoff.service). Freshness is only
 * enforced until the operator has signed: after that the owner is approving
 * exactly the issued snapshot, and a later cost or reversal for that period is
 * a new fact for the correction process, not a reason to pull the statement
 * out from under the person reading it.
 *
 * `collectSnapshotSources` is the single place the source facts are read, used
 * by generation and by the freshness check alike.
 */

/** A stay counts towards the period's gross bookings from confirmation on. */
export const REVENUE_BOOKING_STATUSES: BookingStatus[] = [
  'confirmed',
  'checked_in',
  'checked_out',
  'completed',
];

const MS_PER_DAY = 24 * 60 * 60 * 1000;

type SnapshotDb = Pick<
  PrismaClient,
  'booking' | 'payment' | 'ledgerEntry' | 'expenseReceipt' | 'ownershipPeriod' | 'statementLineItem'
>;

export interface SnapshotPeriod {
  unitId: string;
  /** Inclusive first day (UTC midnight). */
  periodStart: Date;
  /** Inclusive last day (UTC midnight). */
  periodEnd: Date;
}

export interface SnapshotSources {
  bookings: Array<{ id: string; startDate: Date; endDate: Date; totalThb: number | null }>;
  guestPaymentsReceivedThb: number;
  ledgerRows: StatementLedgerRow[];
  /** ledger entry id → id of its CURRENT receipt. */
  currentReceiptByEntryId: Map<string, string>;
  /** ledger entry id → sha256 of that receipt's bytes. */
  currentReceiptHashByEntryId: Map<string, string>;
  ownership: Array<{ ownerIdentityId: string; from: string; to: string }>;
}

export function dayAfter(day: Date): Date {
  return new Date(day.getTime() + MS_PER_DAY);
}

export async function collectSnapshotSources(
  db: SnapshotDb,
  period: SnapshotPeriod
): Promise<SnapshotSources> {
  const nextPeriodDay = dayAfter(period.periodEnd);

  const bookings = await db.booking.findMany({
    where: {
      unitId: period.unitId,
      startDate: { gte: period.periodStart },
      endDate: { lte: nextPeriodDay },
      status: { in: REVENUE_BOOKING_STATUSES },
    },
    orderBy: { startDate: 'asc' },
    select: { id: true, startDate: true, endDate: true, totalThb: true },
  });

  const bookingIds = bookings.map((b) => b.id);
  const payments = bookingIds.length
    ? await db.payment.aggregate({
        where: {
          bookingId: { in: bookingIds },
          status: 'succeeded',
          reconciliationReason: null,
          purpose: { in: ['stay', 'stay_balance'] },
        },
        _sum: { amountThb: true },
      })
    : { _sum: { amountThb: 0 } };

  // The append-only ledger is the source for refunds, expenses, taxes and the
  // reversals of expenses. Ordered deterministically: equal accrual dates fall
  // back to creation order, then id.
  const swept = await db.ledgerEntry.findMany({
    where: {
      unitId: period.unitId,
      occurredOn: { gte: period.periodStart, lt: nextPeriodDay },
      OR: [
        { entryType: { in: [...NON_EXPENSE_STATEMENT_ENTRY_TYPES, ...OPERATING_EXPENSE_ENTRY_TYPES] } },
        { entryType: 'adjustment', reversesEntryId: { not: null } },
      ],
    },
    orderBy: [{ occurredOn: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      entryType: true,
      amountThb: true,
      description: true,
      bookingId: true,
      occurredOn: true,
      reversesEntryId: true,
    },
  });
  const ledgerRows = swept.filter(isStatementLedgerRow);

  const receipts = ledgerRows.length
    ? await db.expenseReceipt.findMany({
        where: { ledgerEntryId: { in: ledgerRows.map((r) => r.id) }, supersededAt: null },
        select: { id: true, ledgerEntryId: true, sha256: true },
      })
    : [];

  const periods = await db.ownershipPeriod.findMany({
    where: {
      unitId: period.unitId,
      startsOn: { lt: nextPeriodDay },
      OR: [{ endsOn: null }, { endsOn: { gt: period.periodStart } }],
    },
    select: { ownerIdentityId: true, startsOn: true, endsOn: true },
    orderBy: { startsOn: 'asc' },
  });
  // Clamped to the window: a transfer AFTER the period ends does not change who
  // held title DURING it, so it must not change the fingerprint either.
  const ownership = periods.map((p) => ({
    ownerIdentityId: p.ownerIdentityId,
    from: toCalendarDay(p.startsOn < period.periodStart ? period.periodStart : p.startsOn),
    to: toCalendarDay(!p.endsOn || p.endsOn > nextPeriodDay ? nextPeriodDay : p.endsOn),
  }));

  return {
    bookings,
    guestPaymentsReceivedThb: payments._sum.amountThb ?? 0,
    ledgerRows,
    currentReceiptByEntryId: new Map(receipts.map((r) => [r.ledgerEntryId, r.id])),
    currentReceiptHashByEntryId: new Map(receipts.map((r) => [r.ledgerEntryId, r.sha256])),
    ownership,
  };
}

const sha256 = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const byJson = (a: unknown, b: unknown) => {
  const x = JSON.stringify(a);
  const y = JSON.stringify(b);
  return x < y ? -1 : x > y ? 1 : 0;
};

export function sourceFingerprint(
  period: SnapshotPeriod,
  recipient: { ownerIdentityId: string; engagementId: string },
  sources: SnapshotSources
): string {
  return sha256({
    v: 1,
    unitId: period.unitId,
    period: [toCalendarDay(period.periodStart), toCalendarDay(period.periodEnd)],
    recipient: [recipient.ownerIdentityId, recipient.engagementId],
    ownership: sources.ownership
      .map((o) => [o.ownerIdentityId, o.from, o.to])
      .sort(byJson),
    bookings: sources.bookings.map((b) => [b.id, b.totalThb ?? 0]).sort(byJson),
    guestPayments: sources.guestPaymentsReceivedThb,
    ledger: sources.ledgerRows
      .map((r) => [r.id, r.entryType, r.amountThb, toCalendarDay(r.occurredOn), r.reversesEntryId])
      .sort(byJson),
    receipts: [...sources.currentReceiptByEntryId.entries()]
      .map(([entryId, receiptId]) => [entryId, receiptId, sources.currentReceiptHashByEntryId.get(entryId)])
      .sort(byJson),
  });
}

export interface SnapshotFigures {
  grossRevenueTh: number;
  totalCostsTh: number;
  noiTh: number;
  ownerShareTh: number;
  estateShareTh: number;
  capApplied: boolean;
  grossBookingsAmountTh: number | null;
  guestPaymentsReceivedTh: number | null;
  serviceFeesAmountTh: number | null;
  operatingExpensesAmountTh: number | null;
  taxesAmountTh: number | null;
  adjustedNoiTh: number | null;
  distributableCashTh: number | null;
  performanceFeeAmountTh: number | null;
  performanceFeeBasisText: string | null;
}

export interface SnapshotLine {
  category: string;
  description: string;
  amountTh: number;
  bookingId: string | null;
  ledgerEntryId: string | null;
  expenseReceiptId: string | null;
}

export function snapshotHash(figures: SnapshotFigures, lines: SnapshotLine[]): string {
  return sha256({
    v: 1,
    figures: [
      figures.grossRevenueTh,
      figures.totalCostsTh,
      figures.noiTh,
      figures.ownerShareTh,
      figures.estateShareTh,
      figures.capApplied,
      figures.grossBookingsAmountTh,
      figures.guestPaymentsReceivedTh,
      figures.serviceFeesAmountTh,
      figures.operatingExpensesAmountTh,
      figures.taxesAmountTh,
      figures.adjustedNoiTh,
      figures.distributableCashTh,
      figures.performanceFeeAmountTh,
      figures.performanceFeeBasisText,
    ],
    lines: lines
      .map((l) => [l.category, l.description, l.amountTh, l.bookingId, l.ledgerEntryId, l.expenseReceiptId])
      .sort(byJson),
  });
}

export type SnapshotVerdict =
  | { ok: true; verified: 'full' | 'integrity_only' | 'legacy_unverifiable' }
  | { ok: false; reason: 'stale' | 'snapshot_mismatch' };

interface StoredStatement extends SnapshotFigures {
  id: string;
  unitId: string;
  periodStart: Date;
  periodEnd: Date;
  ownerIdentityId: string;
  engagementId: string;
  signedOffByOperatorAt: Date | null;
  sourceFingerprint: string | null;
  snapshotHash: string | null;
}

/**
 * Verify a stored statement before a signature is written onto it.
 *
 * Call inside the sign-off transaction, after the unit ledger lock and the
 * statement row lock are held — that is what makes "fresh" mean fresh at the
 * moment of signing rather than at the moment of reading.
 */
export async function verifyStatementSnapshot(
  db: SnapshotDb,
  statement: StoredStatement
): Promise<SnapshotVerdict> {
  // Statements generated before the snapshot columns existed carry no hashes.
  // They are not "stale" — they cannot be judged — and are signed as before.
  if (!statement.snapshotHash || !statement.sourceFingerprint) {
    return { ok: true, verified: 'legacy_unverifiable' };
  }

  const items = await db.statementLineItem.findMany({
    where: { statementId: statement.id },
    select: {
      category: true,
      description: true,
      amountTh: true,
      bookingId: true,
      ledgerEntryId: true,
      expenseReceiptId: true,
    },
  });
  if (snapshotHash(statement, items) !== statement.snapshotHash) {
    return { ok: false, reason: 'snapshot_mismatch' };
  }

  // Once the operator has signed, the owner is approving the issued snapshot.
  if (statement.signedOffByOperatorAt) return { ok: true, verified: 'integrity_only' };

  const period: SnapshotPeriod = {
    unitId: statement.unitId,
    periodStart: statement.periodStart,
    periodEnd: statement.periodEnd,
  };
  const sources = await collectSnapshotSources(db, period);
  const live = sourceFingerprint(
    period,
    { ownerIdentityId: statement.ownerIdentityId, engagementId: statement.engagementId },
    sources
  );
  return live === statement.sourceFingerprint
    ? { ok: true, verified: 'full' }
    : { ok: false, reason: 'stale' };
}
