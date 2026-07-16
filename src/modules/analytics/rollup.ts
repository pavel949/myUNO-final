import { PrismaClient, BookingStatus } from '@prisma/client';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Booking statuses that mean the unit was actually occupied that night. */
const OCCUPYING_STATUSES: BookingStatus[] = [
  BookingStatus.confirmed,
  BookingStatus.checked_in,
  BookingStatus.checked_out,
  BookingStatus.completed,
];

/**
 * Materialize MetricDaily for one UTC day — one row per unit.
 *
 * Definitions (doc 13 §1):
 * - nightsAvailable ∈ {0,1}: 1 when the unit existed that day and was either
 *   occupied or live-and-unblocked; 0 before the unit existed, while it was
 *   not live (draft/mobilizing/paused/offboarded), or under a BlockedDate.
 * - nightsOccupied ∈ {0,1}: 1 when any confirmed/checked_in/checked_out/
 *   completed booking covers the night. Owner stays and internal blocks
 *   occupy the unit but carry no revenue (totalThb = 0).
 * - rentalRevenueCents: each booking's total attributed evenly per night
 *   (totalThb × 100 / nights), so summing days never double-counts a stay.
 */
export async function rollupMetricsDaily(db: PrismaClient, date?: Date) {
  const targetDate = new Date(date ? date.getTime() : Date.now());
  targetDate.setUTCHours(0, 0, 0, 0);
  const nextDay = new Date(targetDate.getTime() + DAY_MS);

  const units = await db.unit.findMany({
    select: { id: true, projectId: true, status: true, createdAt: true },
  });
  if (units.length === 0) return;

  const [bookings, blocks, serviceOrders] = await Promise.all([
    db.booking.findMany({
      where: {
        startDate: { lte: targetDate },
        endDate: { gt: targetDate },
        status: { in: OCCUPYING_STATUSES },
      },
      select: { unitId: true, totalThb: true, startDate: true, endDate: true },
    }),
    db.blockedDate.findMany({
      where: { startDate: { lte: targetDate }, endDate: { gt: targetDate } },
      select: { unitId: true },
    }),
    db.serviceOrder.findMany({
      where: {
        status: { in: ['fulfilled', 'closed'] },
        createdAt: { gte: targetDate, lt: nextDay },
      },
      select: { unit_id: true, total_thb: true },
    }),
  ]);

  const bookingsByUnit = new Map<string, typeof bookings>();
  for (const b of bookings) {
    const list = bookingsByUnit.get(b.unitId) || [];
    list.push(b);
    bookingsByUnit.set(b.unitId, list);
  }
  const blockedUnitIds = new Set(blocks.map((b) => b.unitId));
  const ordersByUnit = new Map<string, { count: number; revenueCents: number }>();
  for (const o of serviceOrders) {
    if (!o.unit_id) continue;
    const agg = ordersByUnit.get(o.unit_id) || { count: 0, revenueCents: 0 };
    agg.count += 1;
    agg.revenueCents += o.total_thb * 100;
    ordersByUnit.set(o.unit_id, agg);
  }

  for (const unit of units) {
    const unitBookings = bookingsByUnit.get(unit.id) || [];
    // A booking covering the night proves occupancy regardless of when the
    // unit row was created (seeded/imported history predates createdAt).
    const nightsOccupied = unitBookings.length > 0 ? 1 : 0;

    // A vacant night only counts as available if the unit existed by then
    // and was live and unblocked — otherwise occupancy% would be diluted
    // by days the unit wasn't rentable.
    const existed = unit.createdAt.getTime() < nextDay.getTime();
    const nightsAvailable =
      nightsOccupied === 1
        ? 1
        : existed && unit.status === 'live' && !blockedUnitIds.has(unit.id)
          ? 1
          : 0;

    // Attribute each stay's revenue evenly across its nights
    let rentalRevenueCents = 0;
    for (const b of unitBookings) {
      if (b.totalThb <= 0) continue;
      const nights = Math.max(
        1,
        Math.round((b.endDate.getTime() - b.startDate.getTime()) / DAY_MS)
      );
      rentalRevenueCents += (b.totalThb * 100) / nights;
    }
    rentalRevenueCents = Math.round(rentalRevenueCents);

    const orders = ordersByUnit.get(unit.id) || { count: 0, revenueCents: 0 };

    const occupancyPct =
      nightsAvailable > 0 ? (nightsOccupied / nightsAvailable) * 100 : 0;
    const adrCents =
      nightsOccupied > 0 ? Math.round(rentalRevenueCents / nightsOccupied) : null;
    const revpanCents =
      nightsAvailable > 0 ? Math.round(rentalRevenueCents / nightsAvailable) : null;

    const metrics = {
      nightsAvailable,
      nightsOccupied,
      rentalRevenueCents,
      serviceOrderCount: orders.count,
      serviceOrderRevenueCents: Math.round(orders.revenueCents),
      occupancyPct,
      adrCents,
      revpanCents,
    };

    await db.metricDaily.upsert({
      where: { unitId_date: { unitId: unit.id, date: targetDate } },
      update: metrics,
      create: { projectId: unit.projectId, unitId: unit.id, date: targetDate, ...metrics },
    });
  }
}

/**
 * Roll up an inclusive UTC date range, one day at a time (used by the
 * backfill route). Capped to 400 days per call to keep a single request
 * bounded.
 */
export async function rollupMetricsRange(db: PrismaClient, from: Date, to: Date) {
  const start = new Date(from.getTime());
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(to.getTime());
  end.setUTCHours(0, 0, 0, 0);

  let days = 0;
  for (
    let d = start.getTime();
    d <= end.getTime() && days < 400;
    d += DAY_MS, days += 1
  ) {
    await rollupMetricsDaily(db, new Date(d));
  }
  return days;
}
