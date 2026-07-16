import { PrismaClient } from '@prisma/client';

export interface MetricsSeriesOptions {
  /** Restrict to specific units (e.g. one owner's portfolio). */
  unitIds?: string[];
  /** Restrict to one project (ignored when unitIds is set). */
  projectId?: string;
  /** Inclusive UTC range. */
  from: Date;
  to: Date;
  groupBy: 'day' | 'month';
}

export interface MetricsPoint {
  /** 'YYYY-MM-DD' for day grouping, 'YYYY-MM' for month grouping. */
  period: string;
  nightsAvailable: number;
  nightsOccupied: number;
  /** Weighted across the group: occupied / available × 100 (0 when no availability). */
  occupancyPct: number;
  rentalRevenueThb: number;
  serviceOrderCount: number;
  serviceOrderRevenueThb: number;
}

export interface UnitSparkPoint {
  date: string; // YYYY-MM-DD
  occupied: boolean;
}

function floorUtc(d: Date): Date {
  const out = new Date(d.getTime());
  out.setUTCHours(0, 0, 0, 0);
  return out;
}

/**
 * Read seam over MetricDaily — the single way dashboards pull trend data.
 * Aggregates unit×day rows into a per-day or per-month series with weighted
 * occupancy. Amounts come back in whole THB (matching what screens display).
 */
export async function getMetricsSeries(
  db: PrismaClient,
  options: MetricsSeriesOptions
): Promise<MetricsPoint[]> {
  const { unitIds, projectId, groupBy } = options;
  const from = floorUtc(options.from);
  const to = floorUtc(options.to);

  const rows = await db.metricDaily.findMany({
    where: {
      date: { gte: from, lte: to },
      ...(unitIds && unitIds.length > 0
        ? { unitId: { in: unitIds } }
        : projectId
          ? { projectId }
          : {}),
    },
    select: {
      date: true,
      nightsAvailable: true,
      nightsOccupied: true,
      rentalRevenueCents: true,
      serviceOrderCount: true,
      serviceOrderRevenueCents: true,
    },
    orderBy: { date: 'asc' },
  });

  const buckets = new Map<string, MetricsPoint>();
  for (const row of rows) {
    const iso = row.date.toISOString().slice(0, 10);
    const period = groupBy === 'month' ? iso.slice(0, 7) : iso;
    const bucket =
      buckets.get(period) ||
      ({
        period,
        nightsAvailable: 0,
        nightsOccupied: 0,
        occupancyPct: 0,
        rentalRevenueThb: 0,
        serviceOrderCount: 0,
        serviceOrderRevenueThb: 0,
      } satisfies MetricsPoint);
    bucket.nightsAvailable += row.nightsAvailable;
    bucket.nightsOccupied += row.nightsOccupied;
    bucket.rentalRevenueThb += row.rentalRevenueCents / 100;
    bucket.serviceOrderCount += row.serviceOrderCount;
    bucket.serviceOrderRevenueThb += row.serviceOrderRevenueCents / 100;
    buckets.set(period, bucket);
  }

  const series = Array.from(buckets.values()).sort((a, b) =>
    a.period.localeCompare(b.period)
  );
  for (const point of series) {
    point.occupancyPct =
      point.nightsAvailable > 0
        ? (point.nightsOccupied / point.nightsAvailable) * 100
        : 0;
    point.rentalRevenueThb = Math.round(point.rentalRevenueThb);
    point.serviceOrderRevenueThb = Math.round(point.serviceOrderRevenueThb);
  }
  return series;
}

/**
 * Per-unit day dots for sparklines: which of the last `days` nights were
 * occupied. Returns a map keyed by unitId, each value ordered oldest→newest.
 */
export async function getUnitOccupancySparklines(
  db: PrismaClient,
  unitIds: string[],
  days: number,
  reference?: Date
): Promise<Record<string, UnitSparkPoint[]>> {
  if (unitIds.length === 0) return {};
  const end = floorUtc(reference ?? new Date());
  const start = new Date(end.getTime() - (days - 1) * 24 * 60 * 60 * 1000);

  const rows = await db.metricDaily.findMany({
    where: { unitId: { in: unitIds }, date: { gte: start, lte: end } },
    select: { unitId: true, date: true, nightsOccupied: true },
    orderBy: { date: 'asc' },
  });

  const result: Record<string, UnitSparkPoint[]> = {};
  for (const id of unitIds) result[id] = [];
  for (const row of rows) {
    result[row.unitId].push({
      date: row.date.toISOString().slice(0, 10),
      occupied: row.nightsOccupied > 0,
    });
  }
  return result;
}
