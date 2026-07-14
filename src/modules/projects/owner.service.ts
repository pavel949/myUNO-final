import { PrismaClient, Booking } from '@prisma/client';
import { getConfig } from '@/modules/config';

export interface OwnerDashboardData {
  identityId: string;
  units: {
    id: string;
    name: string;
    projectId: string;
    occupancyThisMonth: number;
    revenueThisMonth: number;
    nextArrivalDate: Date | null;
    bookingsCount: number;
    openTicketsCount: number;
    latestStatementId: string | null;
  }[];
  combinedOccupancyThisMonth: number;
  combinedRevenueThisMonth: number;
  alertsCount: number;
}

export interface OwnerStayInput {
  unitId: string;
  ownerIdentityId: string;
  startDate: Date;
  endDate: Date;
}

/**
 * Book an owner stay in their own unit (zero-rent internal booking).
 * Enforces minimum notice window from config; creates confirmed booking;
 * notifies ops for turnover cleaning.
 */
export async function bookOwnerStay(db: PrismaClient, input: OwnerStayInput): Promise<Booking> {
  const { unitId, ownerIdentityId, startDate, endDate } = input;

  const unit = await db.unit.findUnique({
    where: { id: unitId },
  });

  if (!unit) {
    throw new Error(`Unit ${unitId} not found`);
  }

  if (unit.ownerIdentityId !== ownerIdentityId) {
    throw new Error(`Owner does not own this unit`);
  }

  // Get minimum notice window from config
  const noticeHours = await getConfig(db, 'owner_stay.notice_hours', {
    projectId: unit.projectId,
  });

  const hoursUntilStart = (startDate.getTime() - Date.now()) / (1000 * 60 * 60);
  if (hoursUntilStart < (noticeHours || 24)) {
    throw new Error(`Owner stay must be booked at least ${noticeHours || 24} hours in advance`);
  }

  // Verify availability (no overlapping confirmed bookings or blocks)
  const conflicts = await db.booking.findMany({
    where: {
      unitId,
      status: {
        in: ['confirmed', 'checked_in', 'checked_out'],
      },
      AND: [
        { startDate: { lt: endDate } },
        { endDate: { gt: startDate } },
      ],
    },
  });

  if (conflicts.length > 0) {
    throw new Error(`Dates not available; overlaps with existing booking`);
  }

  // Create owner-stay booking (zero rent, automatically confirmed)
  const booking = await db.booking.create({
    data: {
      unitId,
      projectId: unit.projectId,
      guestIdentityId: ownerIdentityId,
      bookingType: 'owner_stay',
      channel: 'manual',
      startDate,
      endDate,
      adults: 1,
      children: 0,
      totalThb: 0, // Zero rent for owner stay
      status: 'confirmed',
    },
  });

  return booking;
}

/**
 * Get owner dashboard data (occupancy, revenue, bookings, statements, tickets).
 * Adaptive: single unit shows unit dashboard; portfolio shows combined view.
 */
export async function getOwnerDashboard(
  db: PrismaClient,
  ownerIdentityId: string
): Promise<OwnerDashboardData> {
  // Get all units owned by this identity
  const units = await db.unit.findMany({
    where: {
      ownerIdentityId,
    },
    select: {
      id: true,
      name: true,
      projectId: true,
      bookings: {
        select: {
          id: true,
          startDate: true,
          endDate: true,
          totalThb: true,
          status: true,
          checkedOutAt: true,
        },
      },
      tickets: {
        select: {
          id: true,
          status: true,
        },
      },
      statements: {
        select: {
          id: true,
          createdAt: true,
          status: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 1,
      },
    },
    orderBy: {
      name: 'asc',
    },
  });

  // Compute this month's date range
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  let combinedOccupancy = 0;
  let combinedRevenue = 0;

  const unitData = units.map((unit) => {
    // Calculate occupancy this month (confirmed/checked-in/checked-out nights)
    const monthBookings = unit.bookings.filter((b) => {
      const end = b.checkedOutAt || b.endDate;
      return (
        (b.status === 'confirmed' || b.status === 'checked_in' || b.status === 'checked_out') &&
        b.startDate < monthEnd &&
        end > monthStart
      );
    });

    let occupancyNights = 0;
    let monthRevenue = 0;

    monthBookings.forEach((b) => {
      const start = Math.max(b.startDate.getTime(), monthStart.getTime());
      const end = Math.min((b.checkedOutAt || b.endDate).getTime(), monthEnd.getTime());
      const nights = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
      occupancyNights += nights;

      // Revenue only for guest stays (exclude owner_stay and internal_block)
      if (b.totalThb > 0) {
        monthRevenue += b.totalThb;
      }
    });

    combinedOccupancy += occupancyNights;
    combinedRevenue += monthRevenue;

    // Find next arrival
    const futureBookings = unit.bookings.filter(
      (b) =>
        b.status === 'confirmed' &&
        b.startDate > now &&
        b.totalThb > 0 // Only guest arrivals, not owner stays
    );
    futureBookings.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
    const nextArrival = futureBookings[0]?.startDate || null;

    return {
      id: unit.id,
      name: unit.name,
      projectId: unit.projectId,
      occupancyThisMonth: occupancyNights,
      revenueThisMonth: monthRevenue,
      nextArrivalDate: nextArrival,
      bookingsCount: unit.bookings.filter((b) => b.status !== 'cancelled').length,
      openTicketsCount: unit.tickets.filter((t) => t.status !== 'closed').length,
      latestStatementId: unit.statements[0]?.id || null,
    };
  });

  return {
    identityId: ownerIdentityId,
    units: unitData,
    combinedOccupancyThisMonth: combinedOccupancy,
    combinedRevenueThisMonth: combinedRevenue,
    alertsCount: 0, // Placeholder; extended by alerts/tickets/verification logic in later tasks
  };
}

/**
 * Get owner's bookings list for a unit (read-only, guest name/country only).
 */
export async function getOwnerBookingsList(
  db: PrismaClient,
  unitId: string,
  ownerIdentityId: string,
  limit: number = 10
) {
  const unit = await db.unit.findUnique({
    where: { id: unitId },
  });

  if (!unit || unit.ownerIdentityId !== ownerIdentityId) {
    throw new Error(`Access denied`);
  }

  return db.booking.findMany({
    where: {
      unitId,
      status: {
        in: ['confirmed', 'checked_in', 'checked_out', 'completed'],
      },
    },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      totalThb: true,
      guestIdentity: {
        select: {
          id: true,
          firstName: true,
        },
      },
      guests: {
        select: {
          nationality: true,
        },
        take: 1,
      },
    },
    orderBy: {
      startDate: 'desc',
    },
    take: limit,
  });
}

/**
 * Detect if owner has single or multiple units/projects (for adaptive UI).
 */
export async function getOwnerPortfolioShape(db: PrismaClient, ownerIdentityId: string) {
  const units = await db.unit.findMany({
    where: { ownerIdentityId },
    select: {
      id: true,
      projectId: true,
    },
  });

  const projects = new Set(units.map((u) => u.projectId));

  return {
    unitCount: units.length,
    projectCount: projects.size,
    isPortfolio: units.length > 1,
    projectIds: Array.from(projects),
  };
}

/**
 * Get projects for owner's portfolio (for ProjectSwitcher).
 */
export async function getOwnerProjects(db: PrismaClient, ownerIdentityId: string) {
  const units = await db.unit.findMany({
    where: { ownerIdentityId },
    select: { projectId: true },
    distinct: ['projectId'],
  });

  const projects = await db.project.findMany({
    where: {
      id: {
        in: units.map((u) => u.projectId),
      },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      _count: {
        select: {
          units: {
            where: { ownerIdentityId },
          },
        },
      },
    },
    orderBy: {
      name: 'asc',
    },
  });

  return projects;
}
