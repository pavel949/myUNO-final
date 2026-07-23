import { PrismaClient } from '@prisma/client';

export interface KpiSummary {
  occupancyPct: number;
  adrThb: number;
  revpanThb: number;
}

export interface KpiMetrics {
  occupancyPct: number;
  adrThb: number;
  revpanThb: number;
  attachRatePct: number;
  directSharePct: number;
  repeatGuestRatePct: number;
}

/**
 * Get KPI summary for a date range: occupancy %, ADR, RevPAN
 * ADR excludes owner stay nights; computed from rental revenue / (occupied - owner) nights
 */
export async function getKpiSummary(
  db: PrismaClient,
  options: {
    from: Date;
    to: Date;
    unitIds?: string[];
    projectId?: string;
  }
): Promise<KpiSummary> {
  const where: any = {
    date: { gte: options.from, lte: options.to },
  };

  if (options.projectId) where.projectId = options.projectId;
  if (options.unitIds && options.unitIds.length > 0) {
    where.unitId = { in: options.unitIds };
  }

  const metrics = await db.metricDaily.aggregate({
    where,
    _sum: {
      nightsAvailable: true,
      nightsOccupied: true,
      ownerStayNights: true,
      rentalRevenueCents: true,
    },
  });

  const nightsAvailable = metrics._sum.nightsAvailable ?? 0;
  const nightsOccupied = metrics._sum.nightsOccupied ?? 0;
  const ownerStayNights = metrics._sum.ownerStayNights ?? 0;
  const rentalRevenueCents = metrics._sum.rentalRevenueCents ?? 0;

  // Occupancy % = occupied / available
  const occupancyPct = nightsAvailable > 0 ? Math.round((nightsOccupied / nightsAvailable) * 100) : 0;

  // ADR = revenue / (occupied - owner nights), in THB
  const guestNights = nightsOccupied - ownerStayNights;
  const adrThb = guestNights > 0 ? Math.round(rentalRevenueCents / guestNights / 100) : 0;

  // RevPAN = revenue / available nights, in THB
  const revpanThb = nightsAvailable > 0 ? Math.round(rentalRevenueCents / nightsAvailable / 100) : 0;

  return { occupancyPct, adrThb, revpanThb };
}

/**
 * Service attach rate: percent of stays with at least one service order
 */
export async function getServicesAttachRate(
  db: PrismaClient,
  options: {
    from: Date;
    to: Date;
    projectId?: string;
  }
): Promise<number> {
  const [totalBookings, bookingsWithServices] = await Promise.all([
    db.booking.count({
      where: {
        startDate: { gte: options.from },
        endDate: { lte: options.to },
        ...(options.projectId && {
          unit: { projectId: options.projectId },
        }),
      },
    }),
    db.booking.count({
      where: {
        startDate: { gte: options.from },
        endDate: { lte: options.to },
        serviceOrders: { some: {} },
        ...(options.projectId && {
          unit: { projectId: options.projectId },
        }),
      },
    }),
  ]);

  return totalBookings > 0 ? Math.round((bookingsWithServices / totalBookings) * 100) : 0;
}

/**
 * Direct booking share: percent of bookings with channel = 'direct'
 */
export async function getDirectShare(
  db: PrismaClient,
  options: {
    from: Date;
    to: Date;
    projectId?: string;
  }
): Promise<number> {
  const [totalBookings, directBookings] = await Promise.all([
    db.booking.count({
      where: {
        startDate: { gte: options.from },
        endDate: { lte: options.to },
        ...(options.projectId && {
          unit: { projectId: options.projectId },
        }),
      },
    }),
    db.booking.count({
      where: {
        startDate: { gte: options.from },
        endDate: { lte: options.to },
        channel: 'direct',
        ...(options.projectId && {
          unit: { projectId: options.projectId },
        }),
      },
    }),
  ]);

  return totalBookings > 0 ? Math.round((directBookings / totalBookings) * 100) : 0;
}

/**
 * Repeat guest rate: percent of guests with 2+ bookings
 */
export async function getRepeatGuestRate(
  db: PrismaClient,
  options: {
    from: Date;
    to: Date;
    projectId?: string;
  }
): Promise<number> {
  // Get all bookings in range with guest identity
  const bookings = await db.booking.findMany({
    where: {
      startDate: { gte: options.from },
      endDate: { lte: options.to },
      ...(options.projectId && {
        unit: { projectId: options.projectId },
      }),
    },
    select: { guestIdentityId: true },
  });

  // Filter to bookings with guest identity only
  const bookingsWithGuests = bookings.filter((b) => b.guestIdentityId !== null);

  if (bookingsWithGuests.length === 0) return 0;

  // Count by guestIdentityId
  const guestCounts = new Map<string, number>();
  for (const booking of bookingsWithGuests) {
    guestCounts.set(
      booking.guestIdentityId!,
      (guestCounts.get(booking.guestIdentityId!) ?? 0) + 1
    );
  }

  // Count repeat guests (count >= 2)
  const repeatGuests = Array.from(guestCounts.values()).filter((count) => count >= 2).length;
  const uniqueGuests = guestCounts.size;

  return uniqueGuests > 0 ? Math.round((repeatGuests / uniqueGuests) * 100) : 0;
}

/**
 * TM30 SLA on-time rate: percent of foreign guest arrivals with TM30 filed within 24h
 */
export async function getTm30OnTimeRate(
  db: PrismaClient,
  options: {
    from: Date;
    to: Date;
    projectId?: string;
  }
): Promise<number> {
  // Get foreign guest arrivals in range (bookings with non-TH guests)
  const arrivals = await db.booking.findMany({
    where: {
      startDate: { gte: options.from, lte: options.to },
      guests: { some: { nationality: { not: 'TH' } } },
      ...(options.projectId && {
        unit: { projectId: options.projectId },
      }),
    },
    select: {
      id: true,
      startDate: true,
      tm30Filings: {
        select: {
          filedAt: true,
        },
        orderBy: { filedAt: 'asc' },
        take: 1,
      },
    },
  });

  if (arrivals.length === 0) return 100; // No foreign guests = 100% rate

  // Count on-time filings (filed within 24h of arrival)
  let onTimeCount = 0;
  for (const arrival of arrivals) {
    if (arrival.tm30Filings.length > 0 && arrival.tm30Filings[0].filedAt) {
      const filedAt = new Date(arrival.tm30Filings[0].filedAt);
      const startDate = new Date(arrival.startDate);
      const hoursDiff = (filedAt.getTime() - startDate.getTime()) / (1000 * 60 * 60);
      if (hoursDiff <= 24) {
        onTimeCount++;
      }
    }
  }

  return Math.round((onTimeCount / arrivals.length) * 100);
}

/**
 * Ticket SLA hit rate: percent of resolved tickets met their slaDueAt deadline
 */
export async function getTicketSlaHitRate(
  db: PrismaClient,
  options: {
    from: Date;
    to: Date;
    projectId?: string;
  }
): Promise<number> {
  const resolvedTickets = await db.ticket.findMany({
    where: {
      resolvedAt: { gte: options.from, lte: options.to },
      slaDueAt: { not: null },
      status: { in: ['resolved', 'closed'] },
      ...(options.projectId && {
        unit: { projectId: options.projectId },
      }),
    },
    select: {
      resolvedAt: true,
      slaDueAt: true,
    },
  });

  if (resolvedTickets.length === 0) return 100; // No resolved tickets = 100% rate

  // Count tickets resolved by their SLA due time
  const hitCount = resolvedTickets.filter((t) => t.resolvedAt! <= t.slaDueAt!).length;

  return Math.round((hitCount / resolvedTickets.length) * 100);
}
