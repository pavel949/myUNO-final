import { PrismaClient } from '@prisma/client';

/**
 * Read-time project reports (LY-10) — no new rollup dimensions. Money comes
 * from the append-only ledger (the truth, doc 10); nights come from bookings
 * joined to the unit's category. MetricDaily stays untouched.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const OCCUPYING_STATUSES = ['confirmed', 'checked_in', 'checked_out', 'completed'] as const;

function overlapNights(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date
): number {
  const start = Math.max(aStart.getTime(), bStart.getTime());
  const end = Math.min(aEnd.getTime(), bEnd.getTime());
  return Math.max(0, Math.round((end - start) / DAY_MS));
}

export interface CategoryOccupancyRow {
  categoryKey: string;
  unitCount: number;
  bookedNights: number;
  availableNights: number;
  occupancyPct: number;
}

/**
 * Occupancy by villa category over a range: booked nights (occupying
 * statuses, clipped to the range) ÷ available nights (units × range nights).
 * Units without a category report under 'uncategorized'.
 */
export async function occupancyByCategory(
  db: PrismaClient,
  projectId: string,
  rangeStart: Date,
  rangeEnd: Date
): Promise<CategoryOccupancyRow[]> {
  const rangeNights = Math.max(0, Math.round((rangeEnd.getTime() - rangeStart.getTime()) / DAY_MS));
  const units = await db.unit.findMany({
    where: { projectId, status: 'live' },
    select: { id: true, categoryKey: true },
  });
  const bookings = await db.booking.findMany({
    where: {
      projectId,
      bookingType: 'guest_stay',
      status: { in: [...OCCUPYING_STATUSES] },
      startDate: { lt: rangeEnd },
      endDate: { gt: rangeStart },
    },
    select: { unitId: true, startDate: true, endDate: true },
  });

  const unitCategory = new Map(units.map((u) => [u.id, u.categoryKey ?? 'uncategorized']));
  const rows = new Map<string, CategoryOccupancyRow>();
  for (const unit of units) {
    const key = unit.categoryKey ?? 'uncategorized';
    const row = rows.get(key) ?? {
      categoryKey: key,
      unitCount: 0,
      bookedNights: 0,
      availableNights: 0,
      occupancyPct: 0,
    };
    row.unitCount += 1;
    rows.set(key, row);
  }
  for (const booking of bookings) {
    const key = unitCategory.get(booking.unitId);
    if (!key) continue; // booking on a non-live unit — out of the availability base
    const row = rows.get(key);
    if (!row) continue;
    row.bookedNights += overlapNights(booking.startDate, booking.endDate, rangeStart, rangeEnd);
  }
  for (const row of rows.values()) {
    row.availableNights = row.unitCount * rangeNights;
    row.occupancyPct =
      row.availableNights > 0
        ? Math.round((row.bookedNights / row.availableNights) * 1000) / 10
        : 0;
  }

  return [...rows.values()].sort((a, b) => a.categoryKey.localeCompare(b.categoryKey));
}

export interface ChannelRevenueRow {
  channel: string;
  revenueThb: number;
  bookings: number;
}

/**
 * Rental revenue by booking channel: ledger rental_revenue rows joined to
 * their booking's channel (the ledger is the money truth; unattributed rows
 * report under 'unattributed').
 */
export async function revenueByChannel(
  db: PrismaClient,
  projectId: string,
  rangeStart: Date,
  rangeEnd: Date
): Promise<ChannelRevenueRow[]> {
  const entries = await db.ledgerEntry.findMany({
    where: {
      projectId,
      entryType: 'rental_revenue',
      occurredOn: { gte: rangeStart, lt: rangeEnd },
    },
    select: {
      amountThb: true,
      booking: { select: { id: true, channel: true } },
    },
  });

  const rows = new Map<string, ChannelRevenueRow>();
  const countedBookings = new Map<string, Set<string>>();
  for (const entry of entries) {
    const channel = entry.booking?.channel ?? 'unattributed';
    const row = rows.get(channel) ?? { channel, revenueThb: 0, bookings: 0 };
    row.revenueThb += entry.amountThb;
    rows.set(channel, row);
    const seen = countedBookings.get(channel) ?? new Set<string>();
    if (entry.booking && !seen.has(entry.booking.id)) {
      seen.add(entry.booking.id);
      row.bookings += 1;
    }
    countedBookings.set(channel, seen);
  }

  return [...rows.values()].sort((a, b) => b.revenueThb - a.revenueThb);
}

export interface RevenueSplit {
  rentalThb: number;
  ancillaryThb: number;
}

/**
 * The brief's hard requirement: ancillary revenue reported SEPARATELY from
 * rental. Rental = ledger rental_revenue; ancillary = ledger
 * service_commission (the platform's take on service orders).
 */
export async function revenueSplit(
  db: PrismaClient,
  projectId: string,
  rangeStart: Date,
  rangeEnd: Date
): Promise<RevenueSplit> {
  const grouped = await db.ledgerEntry.groupBy({
    by: ['entryType'],
    where: {
      projectId,
      entryType: { in: ['rental_revenue', 'service_commission'] },
      occurredOn: { gte: rangeStart, lt: rangeEnd },
    },
    _sum: { amountThb: true },
  });

  const byType = Object.fromEntries(grouped.map((g) => [g.entryType, g._sum.amountThb ?? 0]));
  return {
    rentalThb: byType.rental_revenue ?? 0,
    ancillaryThb: byType.service_commission ?? 0,
  };
}
