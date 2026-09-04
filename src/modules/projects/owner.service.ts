import { PrismaClient, Booking, OwnerStatement, TicketStatus } from '@prisma/client';
import { getConfig } from '@/modules/config';
import { getUnitComplianceRecords, getUnitMobilizationChecklist } from '@/modules/core';
import { OWNER_VISIBLE_STATEMENT_STATUSES } from '@/modules/finance';

const ACTIVE_TICKET_STATUSES: TicketStatus[] = [
  'open',
  'acknowledged',
  'in_progress',
  'waiting_reporter',
];

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
    openTickets: {
      id: string;
      title: string;
      status: TicketStatus;
      createdAt: Date;
      unitName: string;
    }[];
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
          title: true,
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
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
    // Accumulated in satang (booking.totalThb's native unit); converted to
    // baht once below (CLAUDE.md money rules; Q47).
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
      // Satang -> baht at the display boundary (CLAUDE.md money rules; Q47).
      revenueThisMonth: monthRevenue / 100,
      nextArrivalDate: nextArrival,
      bookingsCount: unit.bookings.filter((b) => b.status !== 'cancelled').length,
      openTicketsCount: unit.tickets.filter((t) => ACTIVE_TICKET_STATUSES.includes(t.status)).length,
      openTickets: unit.tickets
        .filter((t) => ACTIVE_TICKET_STATUSES.includes(t.status))
        .slice(0, 5)
        .map((ticket) => ({
          id: ticket.id,
          title: ticket.title,
          status: ticket.status,
          createdAt: ticket.createdAt,
          unitName: unit.name,
        })),
      latestStatementId: unit.statements[0]?.id || null,
    };
  });

  return {
    identityId: ownerIdentityId,
    units: unitData,
    combinedOccupancyThisMonth: combinedOccupancy,
    // Satang -> baht at the display boundary (CLAUDE.md money rules; Q47).
    combinedRevenueThisMonth: combinedRevenue / 100,
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

  const bookings = await db.booking.findMany({
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

  // Satang -> baht at the display boundary (CLAUDE.md money rules; Q47).
  return bookings.map((booking) => ({ ...booking, totalThb: booking.totalThb / 100 }));
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

export interface OwnerAlert {
  id: string;
  type: 'tm30_overdue' | 'tm30_escalated' | 'unit_paused' | 'compliance_expiry' | 'ticket_sla_breach';
  severity: 'warning' | 'critical';
  unitId: string;
  unitName: string;
  titleKey: string;
  descriptionKey: string;
  titleParams?: Record<string, string>;
  descriptionParams?: Record<string, string>;
  createdAt: Date;
  actionUrl?: string;
}

export interface OwnerComplianceStatus {
  unitId: string;
  unitName: string;
  permittedUseConfirmedAt: Date | null;
  tm30OnTimePercent: number;
  complianceRecordsCount: number;
  mobilizationProgress: {
    total: number;
    completed: number;
  };
}

/**
 * Get real alerts for owner (TM30 overdue, compliance expiry, ticket SLA, paused units).
 * Replaces hardcoded alertsCount with actionable alerts.
 */
export async function getOwnerAlerts(
  db: PrismaClient,
  ownerIdentityId: string
): Promise<OwnerAlert[]> {
  const alerts: OwnerAlert[] = [];

  // Get all owner's units
  const units = await db.unit.findMany({
    where: { ownerIdentityId },
    select: {
      id: true,
      name: true,
      status: true,
    },
  });

  if (units.length === 0) {
    return [];
  }

  const unitIds = units.map((u) => u.id);

  const now = new Date();
  const tm30Sla = await getConfig(db, 'compliance.tm30_sla_hours', {}) || 24;

  // Alert 1: TM30 overdue or escalated
  const tm30Filings = await db.tm30Filing.findMany({
    where: {
      booking: {
        unit: { id: { in: unitIds } },
      },
    },
    select: {
      id: true,
      status: true,
      filedAt: true,
      escalatedAt: true,
      booking: {
        select: {
          id: true,
          unit: { select: { id: true, name: true } },
          startDate: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  for (const filing of tm30Filings) {
    if (filing.status === 'pending') {
      const hoursElapsed = (now.getTime() - filing.booking.startDate.getTime()) / (1000 * 60 * 60);
      if (hoursElapsed > tm30Sla) {
        alerts.push({
          id: `tm30-overdue-${filing.id}`,
          type: 'tm30_overdue',
          severity: 'critical',
          unitId: filing.booking.unit.id,
          unitName: filing.booking.unit.name,
          titleKey: 'owner.alert.tm30_overdue.title',
          descriptionKey: 'owner.alert.tm30_overdue.body',
          descriptionParams: {
            date: filing.booking.startDate.toLocaleDateString(),
          },
          createdAt: filing.booking.startDate,
          actionUrl: `/ops/tm30`,
        });
      }
    }

    if (filing.escalatedAt) {
      alerts.push({
        id: `tm30-escalated-${filing.id}`,
        type: 'tm30_escalated',
        severity: 'critical',
        unitId: filing.booking.unit.id,
        unitName: filing.booking.unit.name,
        titleKey: 'owner.alert.tm30_escalated.title',
        descriptionKey: 'owner.alert.tm30_escalated.body',
        createdAt: filing.escalatedAt,
        actionUrl: `/ops/tm30`,
      });
    }
  }

  // Alert 2: Paused units
  for (const unit of units) {
    if (unit.status === 'paused') {
      alerts.push({
        id: `paused-${unit.id}`,
        type: 'unit_paused',
        severity: 'warning',
        unitId: unit.id,
        unitName: unit.name,
        titleKey: 'owner.alert.unit_paused.title',
        descriptionKey: 'owner.alert.unit_paused.body',
        createdAt: new Date(),
      });
    }
  }

  // Alert 3: Compliance records expiring soon
  const complianceRecords = await db.complianceRecord.findMany({
    where: {
      unit: { id: { in: unitIds } },
    },
    select: {
      id: true,
      unit: { select: { id: true, name: true } },
      expiresOn: true,
      recordType: true,
    },
  });

  const expiryWarningDays = await getConfig(db, 'compliance.expiry_warning_days', {}) || 30;

  const warningDate = new Date(now.getTime() + expiryWarningDays * 24 * 60 * 60 * 1000);

  for (const record of complianceRecords) {
    if (record.expiresOn && record.expiresOn <= warningDate && record.expiresOn > now) {
      alerts.push({
        id: `compliance-expiry-${record.id}`,
        type: 'compliance_expiry',
        severity: 'warning',
        unitId: record.unit.id,
        unitName: record.unit.name,
        titleKey: 'owner.alert.compliance_expiry.title',
        descriptionKey: 'owner.alert.compliance_expiry.body',
        titleParams: {
          recordType: record.recordType,
        },
        descriptionParams: {
          recordType: record.recordType,
          date: record.expiresOn.toLocaleDateString(),
        },
        createdAt: now,
      });
    }
  }

  // Alert 4: Open tickets past SLA
  const tickets = await db.ticket.findMany({
    where: {
      unit: { id: { in: unitIds } },
      status: { in: ACTIVE_TICKET_STATUSES },
    },
    select: {
      id: true,
      unit: { select: { id: true, name: true } },
      slaDueAt: true,
    },
  });

  for (const ticket of tickets) {
    if (ticket.slaDueAt && ticket.slaDueAt < now && ticket.unit) {
      alerts.push({
        id: `sla-breach-${ticket.id}`,
        type: 'ticket_sla_breach',
        severity: 'warning',
        unitId: ticket.unit.id,
        unitName: ticket.unit.name,
        titleKey: 'owner.alert.ticket_sla.title',
        descriptionKey: 'owner.alert.ticket_sla.body',
        createdAt: now,
        actionUrl: `/tickets/${ticket.id}`,
      });
    }
  }

  return alerts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/**
 * Get compliance summary per unit (permitted use, TM30 on-time %, records, mobilization).
 */
export async function getOwnerComplianceSummary(
  db: PrismaClient,
  ownerIdentityId: string
): Promise<OwnerComplianceStatus[]> {
  const units = await db.unit.findMany({
    where: { ownerIdentityId },
    select: {
      id: true,
      name: true,
      permittedUseConfirmedAt: true,
      status: true,
    },
    orderBy: { name: 'asc' },
  });

  const summaries: OwnerComplianceStatus[] = [];

  for (const unit of units) {
    // Get TM30 on-time %: filed within 24h SLA ÷ total filings
    const tm30Filings = await db.tm30Filing.findMany({
      where: {
        booking: { unit: { id: unit.id } },
      },
      select: {
        id: true,
        filedAt: true,
        booking: { select: { startDate: true } },
      },
    });

    const tm30Sla = await getConfig(db, 'compliance.tm30_sla_hours', {}) || 24;
    const onTimeCount = tm30Filings.filter((f) => {
      if (!f.filedAt) return false;
      const hoursToFile = (f.filedAt.getTime() - f.booking.startDate.getTime()) / (1000 * 60 * 60);
      return hoursToFile <= tm30Sla;
    }).length;

    const tm30OnTimePercent = tm30Filings.length > 0 ? Math.round((onTimeCount / tm30Filings.length) * 100) : 0;

    // Get compliance records
    const complianceRecords = await getUnitComplianceRecords(db, unit.id);

    // Get mobilization progress
    const mobilizationChecklist = await getUnitMobilizationChecklist(db, unit.id);
    const completedItems = mobilizationChecklist.filter((item) => item.completedAt).length;

    summaries.push({
      unitId: unit.id,
      unitName: unit.name,
      permittedUseConfirmedAt: unit.permittedUseConfirmedAt,
      tm30OnTimePercent,
      complianceRecordsCount: complianceRecords.length,
      mobilizationProgress: {
        total: mobilizationChecklist.length,
        completed: completedItems,
      },
    });
  }

  return summaries;
}

/**
 * Get the statements an owner may see, across all their units, newest first.
 *
 * Every status past the admin sign-off gate, not `published` alone. Once a
 * statement can sit in `pending_owner_review` — waiting on the owner's own
 * signature — listing only `published` would hide from the owner the very
 * statement that is waiting for them, leaving sign-off reachable by direct link
 * and nowhere else. `OWNER_VISIBLE_STATEMENT_STATUSES` is the single place this
 * is decided; the statement page and the sign-off routes read the same list.
 */
export async function getOwnerStatements(
  db: PrismaClient,
  ownerIdentityId: string
): Promise<OwnerStatement[]> {
  const units = await db.unit.findMany({
    where: { ownerIdentityId },
    select: { id: true },
  });

  if (units.length === 0) {
    return [];
  }

  const allStatements = await db.ownerStatement.findMany({
    where: {
      unitId: { in: units.map((u) => u.id) },
      ownerIdentityId,
      status: { in: OWNER_VISIBLE_STATEMENT_STATUSES },
    },
    orderBy: { periodEnd: 'desc' },
  });

  return allStatements;
}
