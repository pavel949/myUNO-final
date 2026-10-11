import { describe, expect, it } from 'vitest';
import {
  snapshotHash,
  sourceFingerprint,
  type SnapshotFigures,
  type SnapshotLine,
  type SnapshotPeriod,
  type SnapshotSources,
} from './statement-snapshot';

const period: SnapshotPeriod = {
  unitId: 'u1',
  periodStart: new Date('2026-07-01'),
  periodEnd: new Date('2026-07-31'),
};
const recipient = { ownerIdentityId: 'owner-a', engagementId: 'eng-1' };

function sources(patch: Partial<SnapshotSources> = {}): SnapshotSources {
  return {
    bookings: [{ id: 'b1', startDate: new Date('2026-07-02'), endDate: new Date('2026-07-05'), totalThb: 900_000 }],
    guestPaymentsReceivedThb: 900_000,
    ledgerRows: [
      { id: 'e1', entryType: 'cleaning_cost', amountThb: -5000, description: 'Clean', bookingId: null, occurredOn: new Date('2026-07-10'), reversesEntryId: null },
      { id: 'e2', entryType: 'utilities_cost', amountThb: -3000, description: 'Power', bookingId: null, occurredOn: new Date('2026-07-12'), reversesEntryId: null },
    ],
    currentReceiptByEntryId: new Map([['e1', 'r1']]),
    currentReceiptHashByEntryId: new Map([['e1', 'a'.repeat(64)]]),
    ownership: [{ ownerIdentityId: 'owner-a', from: '2026-07-01', to: '2026-08-01' }],
    ...patch,
  };
}

const fp = (s: SnapshotSources) => sourceFingerprint(period, recipient, s);

describe('sourceFingerprint', () => {
  it('is stable and independent of row order', () => {
    const a = sources();
    const b = sources({ ledgerRows: [...a.ledgerRows].reverse() });
    expect(fp(a)).toBe(fp(b));
    expect(fp(a)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('changes when a cost is added, reversed, or its amount differs', () => {
    const base = fp(sources());
    const extra = sources({
      ledgerRows: [
        ...sources().ledgerRows,
        { id: 'e3', entryType: 'cleaning_cost', amountThb: -100, description: 'late', bookingId: null, occurredOn: new Date('2026-07-30'), reversesEntryId: null },
      ],
    });
    expect(fp(extra)).not.toBe(base);
    const reversed = sources({
      ledgerRows: [
        ...sources().ledgerRows,
        { id: 'e4', entryType: 'adjustment', amountThb: 5000, description: 'rev', bookingId: null, occurredOn: new Date('2026-07-10'), reversesEntryId: 'e1' },
      ],
    });
    expect(fp(reversed)).not.toBe(base);
  });

  it('changes when the current receipt is replaced or removed', () => {
    const base = fp(sources());
    expect(fp(sources({ currentReceiptByEntryId: new Map([['e1', 'r2']]) }))).not.toBe(base);
    expect(fp(sources({ currentReceiptByEntryId: new Map() }))).not.toBe(base);
    expect(fp(sources({ currentReceiptHashByEntryId: new Map([['e1', 'b'.repeat(64)]]) }))).not.toBe(base);
  });

  it('changes when the ownership chain over the period changes', () => {
    const split = sources({
      ownership: [
        { ownerIdentityId: 'owner-a', from: '2026-07-01', to: '2026-07-20' },
        { ownerIdentityId: 'owner-b', from: '2026-07-20', to: '2026-08-01' },
      ],
    });
    expect(fp(split)).not.toBe(fp(sources()));
  });

  it('does not change for a booking total of null vs 0, nor for booking status (not an input)', () => {
    const a = sources({ bookings: [{ id: 'b1', startDate: new Date('2026-07-02'), endDate: new Date('2026-07-05'), totalThb: null }] });
    const b = sources({ bookings: [{ id: 'b1', startDate: new Date('2026-07-02'), endDate: new Date('2026-07-05'), totalThb: 0 }] });
    expect(fp(a)).toBe(fp(b));
  });

  it('is tied to the recipient and the unit', () => {
    const s = sources();
    expect(sourceFingerprint(period, { ...recipient, ownerIdentityId: 'owner-b' }, s)).not.toBe(fp(s));
    expect(sourceFingerprint({ ...period, unitId: 'u2' }, recipient, s)).not.toBe(fp(s));
  });
});

describe('snapshotHash', () => {
  const figures: SnapshotFigures = {
    grossRevenueTh: 900_000, totalCostsTh: 100_000, noiTh: 800_000, ownerShareTh: 600_000, estateShareTh: 200_000, capApplied: false,
    grossBookingsAmountTh: 900_000, guestPaymentsReceivedTh: 900_000, serviceFeesAmountTh: 90_000, operatingExpensesAmountTh: 8000,
    taxesAmountTh: 0, adjustedNoiTh: 800_000, distributableCashTh: 800_000, performanceFeeAmountTh: 0, performanceFeeBasisText: null,
  };
  const lines: SnapshotLine[] = [
    { category: 'operating_expense', description: 'cleaning_cost: Clean', amountTh: 5000, bookingId: null, ledgerEntryId: 'e1', expenseReceiptId: 'r1' },
    { category: 'booking_revenue', description: 'Booking b1', amountTh: 900_000, bookingId: 'b1', ledgerEntryId: null, expenseReceiptId: null },
  ];

  it('is order-independent and detects any change to a figure or a line', () => {
    const base = snapshotHash(figures, lines);
    expect(snapshotHash(figures, [...lines].reverse())).toBe(base);
    expect(snapshotHash({ ...figures, ownerShareTh: figures.ownerShareTh + 1 }, lines)).not.toBe(base);
    expect(snapshotHash(figures, [{ ...lines[0], amountTh: 5001 }, lines[1]])).not.toBe(base);
    expect(snapshotHash(figures, [{ ...lines[0], expenseReceiptId: 'r2' }, lines[1]])).not.toBe(base);
    expect(snapshotHash(figures, [lines[0]])).not.toBe(base);
  });
});
