import type { LedgerEntryType } from '@prisma/client';

/**
 * How ledger rows become the expense block of an owner statement.
 *
 * Pure. The statement generator feeds it rows; sign-off's freshness check
 * feeds it the same rows again. One definition, so what was issued and what is
 * re-checked cannot drift apart.
 *
 * ## Costs and their reversals
 * A cost row contributes its MAGNITUDE (`|amount|`) — legacy rows were stored
 * positive and new manual costs are stored negative (doc 02 §5.3), and a
 * statement must read both. A reversal row (`adjustment` with
 * `reversesEntryId`) contributes the NEGATIVE of its magnitude: a credit line.
 * Summed, a cost and its same-period reversal net to zero, and the owner can
 * still see both lines. A reversal dated into a LATER period (because the
 * original's statement had been issued) is a credit in that later statement.
 *
 * Any other `adjustment` is not an expense. It was never in this list and is
 * not smuggled in here.
 */

/** Ledger kinds that make up the itemised expense block of a statement. */
export const OPERATING_EXPENSE_ENTRY_TYPES: LedgerEntryType[] = [
  'cleaning_cost',
  'maintenance_cost',
  'consumables_cost',
  'utilities_cost',
  'setup_fee',
  'ota_commission_cost',
];

/** The kinds the statement sweeps from the ledger besides expenses. */
export const NON_EXPENSE_STATEMENT_ENTRY_TYPES: LedgerEntryType[] = ['refund_out', 'tax_collected'];

export interface StatementLedgerRow {
  id: string;
  entryType: LedgerEntryType;
  amountThb: number;
  description: string;
  bookingId: string | null;
  occurredOn: Date;
  reversesEntryId: string | null;
}

export type StatementLineCategory = 'operating_expense' | 'refund' | 'tax';

export interface StatementLedgerLine {
  category: StatementLineCategory;
  description: string;
  /** Signed: a reversal is negative. */
  amountTh: number;
  bookingId: string | null;
  ledgerEntryId: string;
  expenseReceiptId: string | null;
}

export function isReversalRow(row: Pick<StatementLedgerRow, 'entryType' | 'reversesEntryId'>): boolean {
  return row.entryType === 'adjustment' && row.reversesEntryId !== null;
}

/** Which of the swept rows belong on the statement at all. */
export function isStatementLedgerRow(
  row: Pick<StatementLedgerRow, 'entryType' | 'reversesEntryId'>
): boolean {
  return (
    OPERATING_EXPENSE_ENTRY_TYPES.includes(row.entryType) ||
    NON_EXPENSE_STATEMENT_ENTRY_TYPES.includes(row.entryType) ||
    isReversalRow(row)
  );
}

/** Signed contribution of a row to the operating-expense total. */
export function operatingExpenseContribution(
  row: Pick<StatementLedgerRow, 'entryType' | 'amountThb' | 'reversesEntryId'>
): number {
  if (isReversalRow(row)) return -Math.abs(row.amountThb);
  if (OPERATING_EXPENSE_ENTRY_TYPES.includes(row.entryType)) return Math.abs(row.amountThb);
  return 0;
}

export function sumOperatingExpenses(rows: StatementLedgerRow[]): number {
  return rows.reduce((sum, row) => sum + operatingExpenseContribution(row), 0);
}

export function sumByType(rows: StatementLedgerRow[], type: LedgerEntryType): number {
  return rows
    .filter((row) => row.entryType === type)
    .reduce((sum, row) => sum + Math.abs(row.amountThb), 0);
}

/**
 * One statement line per swept ledger row, each traceable to its source row
 * and — for an expense — to the receipt that was current for it.
 */
export function buildLedgerLines(
  rows: StatementLedgerRow[],
  currentReceiptByEntryId: ReadonlyMap<string, string>,
  periodStart?: Date
): StatementLedgerLine[] {
  const lines: StatementLedgerLine[] = [];
  for (const row of rows) {
    if (!isStatementLedgerRow(row)) continue;

    if (isReversalRow(row)) {
      lines.push({
        category: 'operating_expense',
        description: row.description,
        amountTh: -Math.abs(row.amountThb),
        bookingId: row.bookingId,
        ledgerEntryId: row.id,
        expenseReceiptId: null,
      });
      continue;
    }

    const category: StatementLineCategory =
      row.entryType === 'refund_out'
        ? 'refund'
        : row.entryType === 'tax_collected'
          ? 'tax'
          : 'operating_expense';

    lines.push({
      category,
      // A cost carried forward from an issued period says when it really happened.
      description:
        periodStart && row.occurredOn < periodStart
          ? `${row.entryType}: ${row.description} (dated ${row.occurredOn.toISOString().slice(0, 10)})`
          : `${row.entryType}: ${row.description}`,
      amountTh: Math.abs(row.amountThb),
      bookingId: row.bookingId,
      ledgerEntryId: row.id,
      expenseReceiptId:
        category === 'operating_expense' ? (currentReceiptByEntryId.get(row.id) ?? null) : null,
    });
  }
  return lines;
}
