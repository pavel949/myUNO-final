import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { getMetricsSeries } from './query';
import { rollupMetricsDaily, rollupMetricsRange } from './rollup';

type BookingInput = {
  unitId: string;
  totalThb: number;
  startDate: Date;
  endDate: Date;
  bookingType: 'guest_stay' | 'owner_stay';
};

type MetricRow = {
  unitId: string;
  date: Date;
  nightsAvailable: number;
  nightsOccupied: number;
  ownerStayNights: number;
  rentalRevenueCents: number;
  serviceOrderCount: number;
  serviceOrderRevenueCents: number;
  adrCents: number | null;
  revpanCents: number | null;
};

function makeDb(
  bookings: BookingInput[] = [],
  orders: { unit_id: string | null; total_thb: number }[] = []
) {
  const rows = new Map<string, MetricRow>();
  const metricDaily = {
    upsert: vi.fn(async ({ create }: { create: MetricRow }) => {
      rows.set(`${create.unitId}:${create.date.toISOString()}`, create);
      return create;
    }),
    findMany: vi.fn(async () => Array.from(rows.values())),
  };
  const serviceOrder = { findMany: vi.fn().mockResolvedValue(orders) };
  const db = {
    unit: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: 'unit-1',
          projectId: 'project-1',
          status: 'live',
          createdAt: new Date('2024-01-01T00:00:00Z'),
        },
      ]),
    },
    booking: { findMany: vi.fn().mockResolvedValue(bookings) },
    blockedDate: { findMany: vi.fn().mockResolvedValue([]) },
    serviceOrder,
    metricDaily,
  } as unknown as PrismaClient;

  return { db, rows, metricDaily, serviceOrder };
}

describe('analytics rollup money units', () => {
  it('keeps a one-night stored booking total in satang through revenue, ADR and RevPAN', async () => {
    const date = new Date('2025-01-15T00:00:00Z');
    const { db, rows, metricDaily } = makeDb([
      {
        unitId: 'unit-1',
        totalThb: 6_983_496, // The stored value for THB 69,834.96.
        startDate: date,
        endDate: new Date('2025-01-16T00:00:00Z'),
        bookingType: 'guest_stay',
      },
    ]);

    await rollupMetricsDaily(db, date);
    await rollupMetricsDaily(db, date);

    expect(rows.size).toBe(1);
    expect(metricDaily.upsert).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { unitId_date: { unitId: 'unit-1', date } },
        update: expect.objectContaining({
          rentalRevenueCents: 6_983_496,
          adrCents: 6_983_496,
          revpanCents: 6_983_496,
        }),
      })
    );
    expect(Array.from(rows.values())[0]).toMatchObject({
      rentalRevenueCents: 6_983_496,
      adrCents: 6_983_496,
      revpanCents: 6_983_496,
      nightsOccupied: 1,
      nightsAvailable: 1,
    });
    const series = await getMetricsSeries(db, { from: date, to: date, groupBy: 'day' });
    // The read boundary intentionally rounds to whole baht, once.
    expect(series[0].rentalRevenueThb).toBe(69_835);
  });

  it('allocates a divisible multi-night satang total without a second conversion', async () => {
    const from = new Date('2025-01-10T00:00:00Z');
    const to = new Date('2025-01-13T00:00:00Z');
    const { db, rows } = makeDb([
      {
        unitId: 'unit-1',
        totalThb: 800_000, // THB 8,000 over four nights.
        startDate: from,
        endDate: new Date('2025-01-14T00:00:00Z'),
        bookingType: 'guest_stay',
      },
    ]);

    expect(await rollupMetricsRange(db, from, to)).toBe(4);
    const metrics = Array.from(rows.values());
    expect(metrics.map((row) => row.rentalRevenueCents)).toEqual([
      200_000, 200_000, 200_000, 200_000,
    ]);
    expect(metrics.reduce((sum, row) => sum + row.rentalRevenueCents, 0)).toBe(800_000);
    const series = await getMetricsSeries(db, { from, to, groupBy: 'month' });
    expect(series[0]).toMatchObject({
      rentalRevenueThb: 8_000,
      nightsOccupied: 4,
      nightsAvailable: 4,
      occupancyPct: 100,
    });
  });

  it('sums stored service-order satang and converts only in the read boundary', async () => {
    const date = new Date('2025-01-15T00:00:00Z');
    const { db, rows, serviceOrder } = makeDb([], [
      { unit_id: 'unit-1', total_thb: 125_050 }, // THB 1,250.50.
      { unit_id: 'unit-1', total_thb: 25_025 }, // THB 250.25.
      { unit_id: null, total_thb: 9_999_900 }, // No unit-level attribution.
    ]);

    await rollupMetricsDaily(db, date);

    expect(serviceOrder.findMany).toHaveBeenCalledWith({
      where: {
        status: { in: ['fulfilled', 'closed'] },
        createdAt: { gte: date, lt: new Date('2025-01-16T00:00:00Z') },
      },
      select: { unit_id: true, total_thb: true },
    });
    expect(Array.from(rows.values())[0]).toMatchObject({
      serviceOrderRevenueCents: 150_075,
      serviceOrderCount: 2,
      rentalRevenueCents: 0,
      nightsOccupied: 0,
      adrCents: null,
      revpanCents: 0,
    });
    const series = await getMetricsSeries(db, { from: date, to: date, groupBy: 'day' });
    expect(series[0]).toMatchObject({
      serviceOrderRevenueThb: 1_501,
      serviceOrderCount: 2,
      rentalRevenueThb: 0,
    });
  });

  it('keeps zero-value owner stays occupied with no revenue', async () => {
    const date = new Date('2025-01-15T00:00:00Z');
    const { db, rows } = makeDb([
      {
        unitId: 'unit-1',
        totalThb: 0,
        startDate: date,
        endDate: new Date('2025-01-16T00:00:00Z'),
        bookingType: 'owner_stay',
      },
    ]);

    await rollupMetricsDaily(db, date);

    expect(Array.from(rows.values())[0]).toMatchObject({
      nightsOccupied: 1,
      ownerStayNights: 1,
      rentalRevenueCents: 0,
      serviceOrderRevenueCents: 0,
      adrCents: 0,
      revpanCents: 0,
    });
  });
});
