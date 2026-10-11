import { describe, expect, it } from 'vitest';
import {
  buildLedgerLines,
  isStatementLedgerRow,
  operatingExpenseContribution,
  sumByType,
  sumOperatingExpenses,
  type StatementLedgerRow,
} from './statement-expense';

let n = 0;
function row(patch: Partial<StatementLedgerRow>): StatementLedgerRow {
  n += 1;
  return {
    id: `e${n}`,
    entryType: 'cleaning_cost',
    amountThb: -5000,
    description: 'Deep clean',
    bookingId: null,
    occurredOn: new Date('2026-07-10'),
    reversesEntryId: null,
    ...patch,
  };
}

describe('operating expenses on a statement', () => {
  it('counts a cost by its magnitude whatever its stored sign (legacy positive, new negative)', () => {
    expect(operatingExpenseContribution(row({ amountThb: -5000 }))).toBe(5000);
    expect(operatingExpenseContribution(row({ amountThb: 5000 }))).toBe(5000);
  });

  it('nets a cost against its reversal instead of adding both', () => {
    const cost = row({ id: 'c1', amountThb: -5000 });
    const reversal = row({ id: 'r1', entryType: 'adjustment', amountThb: 5000, reversesEntryId: 'c1' });
    expect(sumOperatingExpenses([cost, reversal])).toBe(0);
  });

  it('treats a reversal of a legacy positive cost the same way', () => {
    const cost = row({ id: 'c1', amountThb: 5000 });
    const reversal = row({ id: 'r1', entryType: 'adjustment', amountThb: -5000, reversesEntryId: 'c1' });
    expect(sumOperatingExpenses([cost, reversal])).toBe(0);
  });

  it('shows a reversal that lands in a later period as a credit', () => {
    const reversal = row({ entryType: 'adjustment', amountThb: 5000, reversesEntryId: 'in-an-earlier-statement' });
    expect(sumOperatingExpenses([reversal])).toBe(-5000);
  });

  it('does not smuggle a free-form adjustment into the expenses', () => {
    const free = row({ entryType: 'adjustment', amountThb: -9999, reversesEntryId: null });
    expect(isStatementLedgerRow(free)).toBe(false);
    expect(sumOperatingExpenses([free])).toBe(0);
  });

  it('keeps refunds and taxes out of the expense total', () => {
    const rows = [
      row({ entryType: 'refund_out', amountThb: -1200 }),
      row({ entryType: 'tax_collected', amountThb: 300 }),
      row({ amountThb: -5000 }),
    ];
    expect(sumOperatingExpenses(rows)).toBe(5000);
    expect(sumByType(rows, 'refund_out')).toBe(1200);
    expect(sumByType(rows, 'tax_collected')).toBe(300);
  });
});

describe('statement lines', () => {
  it('traces each line to its ledger row and cites the current receipt for an expense', () => {
    const cost = row({ id: 'c1' });
    const reversal = row({ id: 'r1', entryType: 'adjustment', amountThb: 5000, reversesEntryId: 'c1', description: 'Reversal of Deep clean: duplicate' });
    const lines = buildLedgerLines([cost, reversal], new Map([['c1', 'receipt-1']]));
    expect(lines).toEqual([
      { category: 'operating_expense', description: 'cleaning_cost: Deep clean', amountTh: 5000, bookingId: null, ledgerEntryId: 'c1', expenseReceiptId: 'receipt-1' },
      { category: 'operating_expense', description: 'Reversal of Deep clean: duplicate', amountTh: -5000, bookingId: null, ledgerEntryId: 'r1', expenseReceiptId: null },
    ]);
  });

  it('never attaches a receipt to a refund or tax line', () => {
    const refund = row({ id: 'f1', entryType: 'refund_out', amountThb: -700 });
    const [line] = buildLedgerLines([refund], new Map([['f1', 'receipt-x']]));
    expect(line).toMatchObject({ category: 'refund', amountTh: 700, expenseReceiptId: null });
  });
});
