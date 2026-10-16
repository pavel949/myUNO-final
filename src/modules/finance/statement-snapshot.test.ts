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
    bookings: [{ id: 'b1', startDate: new Date('2026-07-02'), endDate: new Date('2026-07-05'), totalThb: 900_000, status: 'confirmed', recognisedThb: 900_000 }],
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

  it('invalidates an unsigned source snapshot when a booking moves inside the same period without changing revenue', () => {
    const old = sources();
    const moved = sources({ bookings: old.bookings.map(b => ({ ...b, startDate: new Date('2026-07-03'), endDate: new Date('2026-07-06') })) });
    expect(fp(moved)).not.toBe(fp(old));
    const extended = sources({ bookings: old.bookings.map(b => ({ ...b, endDate: new Date('2026-07-06') })) });
    expect(fp(extended)).not.toBe(fp(old));
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
    const a = sources({ bookings: [{ id: 'b1', startDate: new Date('2026-07-02'), endDate: new Date('2026-07-05'), totalThb: null, status: 'confirmed', recognisedThb: 0 }] });
    const b = sources({ bookings: [{ id: 'b1', startDate: new Date('2026-07-02'), endDate: new Date('2026-07-05'), totalThb: 0, status: 'confirmed', recognisedThb: 0 }] });
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

describe('sourceFingerprint — cancelled stays', () => {
  it('changes when the retained amount of a cancelled stay changes (a later payment or reversal is a new fact)', () => {
    const cancelled = (recognisedThb: number) =>
      sources({
        bookings: [
          { id: 'b2', startDate: new Date('2026-07-02'), endDate: new Date('2026-07-05'), totalThb: 1_000_000, status: 'cancelled', recognisedThb },
        ],
      });
    expect(fp(cancelled(300_000))).not.toBe(fp(cancelled(400_000)));
    expect(fp(cancelled(300_000))).toBe(fp(cancelled(300_000)));
  });
});


it('preserves legacy collectible fingerprints but invalidates pending source review', () => {
  const legacy = sources();
  const collectible = sources({ bookings: legacy.bookings.map(b => ({ ...b, receivableStatus: 'collectible' })) });
  const pending = sources({ bookings: legacy.bookings.map(b => ({ ...b, receivableStatus: 'pending_reconciliation' })) });
  expect(fp(collectible)).toBe(fp(legacy));
  expect(fp(pending)).not.toBe(fp(legacy));
});
