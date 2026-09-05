import { PrismaClient } from '@prisma/client';
import { getTm30OnTimeRate } from '@/modules/analytics';
import {
  enrichBookingRequestInbox,
  type BookingRequestInboxItem,
} from '@/modules/booking';

export interface OpsBoardData {
  arrivals: OpsBooking[];
  departures: OpsBooking[];
  pendingRequests: BookingRequestInboxItem[];
  pendingPayment: OpsBooking[];
  pendingServiceOrders: OpsServiceOrder[];
  openTickets: OpsTicket[];
  slaMetrics: {
    tm30OnTimeRate7d: number;
    ticketsWithOpenSLA: number;
  };
}

export interface OpsBoardScope {
  projectIds?: string[];
}

export interface OpsBooking {
  id: string;
  status: string;
  startDate: Date;
  endDate: Date;
  totalThb: number;
  adults: number;
  children: number;
  verificationStatus: string;
  requestExpiresAt: Date | null;
  unit: { id: string; name: string };
  guestIdentity: { firstName: string; lastName: string };
  payments: { id: string }[];
}

export interface OpsBookingRequest extends BookingRequestInboxItem {}

const opsBookingRequestSelect = {
  id: true,
  startDate: true,
  endDate: true,
  totalThb: true,
  adults: true,
  children: true,
  requestExpiresAt: true,
  priceBreakdown: true,
  project: { select: { name: true } },
  unit: { select: { id: true, name: true } },
  guestIdentity: { select: { id: true, firstName: true, lastName: true } },
} as const;

interface OpsServiceOrder {
  id: string;
  scheduled_start: Date;
  total_thb: number;
  service: { title: string };
  orderer: { firstName: string; lastName: string };
}

interface OpsTicket {
  id: string;
  title: string;
  status: string;
  priority: string;
  slaDueAt: Date | null;
  unit: { id: string; name: string } | null;
  raisedBy: { firstName: string; lastName: string };
  assigneeIdentityId: string | null;
  assignee: { firstName: string; lastName: string } | null;
}

function dayRange(date: Date): { from: Date; to: Date } {
  const from = new Date(date);
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + 1);
  return { from, to };
}

async function getScopedTm30OnTimeRate(
  db: PrismaClient,
  from: Date,
  to: Date,
  scope?: OpsBoardScope
): Promise<number> {
  if (!scope?.projectIds?.length) {
    return getTm30OnTimeRate(db, { from, to });
  }
  if (scope.projectIds.length === 1) {
    return getTm30OnTimeRate(db, { from, to, projectId: scope.projectIds[0] });
  }

  const arrivals = await db.booking.findMany({
    where: {
      projectId: { in: scope.projectIds },
      startDate: { gte: from, lte: to },
      guests: { some: { nationality: { not: 'TH' } } },
    },
    select: {
      startDate: true,
      tm30Filings: {
        select: { filedAt: true },
        orderBy: { filedAt: 'asc' },
        take: 1,
      },
    },
  });

  if (arrivals.length === 0) return 100;
  const onTime = arrivals.filter((arrival) => {
    const filing = arrival.tm30Filings[0]?.filedAt;
    if (!filing) return false;
    const diffHours =
      (new Date(filing).getTime() - new Date(arrival.startDate).getTime()) / (1000 * 60 * 60);
    return diffHours <= 24;
  }).length;
  return Math.round((onTime / arrivals.length) * 100);
}

/**
 * Get today's operations board data: arrivals, departures, pending payments, pending service orders, SLA metrics
 */
export async function getOpsBoard(
  db: PrismaClient,
  date: Date = new Date(),
  scope?: OpsBoardScope
): Promise<OpsBoardData> {
  if (scope && (!scope.projectIds || scope.projectIds.length === 0)) {
    return {
      arrivals: [],
      departures: [],
      pendingRequests: [],
      pendingPayment: [],
      pendingServiceOrders: [],
      openTickets: [],
      slaMetrics: {
        tm30OnTimeRate7d: 100,
        ticketsWithOpenSLA: 0,
      },
    };
  }

  const { from, to } = dayRange(date);
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000); // Last 7 days
  const projectFilter = scope?.projectIds?.length
    ? { in: scope.projectIds }
    : undefined;

  const bookingSelect = {
    id: true,
    status: true,
    startDate: true,
    endDate: true,
    totalThb: true,
    adults: true,
    children: true,
    verificationStatus: true,
    requestExpiresAt: true,
    unit: { select: { id: true, name: true } },
    guestIdentity: { select: { firstName: true, lastName: true } },
    payments: {
      where: { status: 'succeeded' as const, purpose: 'stay' as const },
      select: { id: true },
    },
  };

  const [arrivals, departures, pendingRequestsRaw, pendingPayment, pendingServiceOrders, openTickets, tm30OnTimeRate7d, ticketsWithOpenSLA] = await Promise.all([
    db.booking.findMany({
      where: {
        ...(projectFilter ? { projectId: projectFilter } : {}),
        startDate: { gte: from, lt: to },
        status: { in: ['confirmed', 'pending_payment'] },
      },
      select: bookingSelect,
      orderBy: { startDate: 'asc' },
    }),
    db.booking.findMany({
      where: {
        ...(projectFilter ? { projectId: projectFilter } : {}),
        endDate: { gte: from, lt: to },
        status: 'checked_in',
      },
      select: bookingSelect,
      orderBy: { endDate: 'asc' },
    }),
    db.booking.findMany({
      where: {
        ...(projectFilter ? { projectId: projectFilter } : {}),
        status: 'requested',
      },
      select: opsBookingRequestSelect,
      orderBy: [{ requestExpiresAt: 'asc' }, { createdAt: 'asc' }],
      take: 50,
    }),
    db.booking.findMany({
      where: {
        ...(projectFilter ? { projectId: projectFilter } : {}),
        status: 'pending_payment',
      },
      select: bookingSelect,
      orderBy: { startDate: 'asc' },
      take: 50,
    }),
    // Service orders awaiting cash (placed = not yet paid) — F-OPS-6 for services
    db.serviceOrder.findMany({
      where: {
        ...(projectFilter ? { project_id: projectFilter } : {}),
        status: 'placed',
      },
      select: {
        id: true,
        scheduled_start: true,
        total_thb: true,
        service: { select: { title: true } },
        orderer: { select: { firstName: true, lastName: true } },
      },
      orderBy: { scheduled_start: 'asc' },
      take: 50,
    }),
    db.ticket.findMany({
      where: {
        ...(projectFilter ? { projectId: projectFilter } : {}),
        status: { in: ['open', 'acknowledged', 'in_progress', 'waiting_reporter'] },
      },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        slaDueAt: true,
        unit: { select: { id: true, name: true } },
        raisedBy: { select: { firstName: true, lastName: true } },
        assigneeIdentityId: true,
        assignee: { select: { firstName: true, lastName: true } },
      },
      orderBy: [{ slaDueAt: 'asc' }, { createdAt: 'desc' }],
      take: 50,
    }),
    // TM30 on-time rate for the last 7 days
    getScopedTm30OnTimeRate(db, sevenDaysAgo, now, scope),
    // Count tickets with open SLA (status not closed/resolved or past slaDueAt)
    db.ticket.count({
      where: {
        ...(projectFilter ? { projectId: projectFilter } : {}),
        slaDueAt: { not: null },
        status: { in: ['open', 'acknowledged', 'in_progress'] },
        OR: [
          { slaDueAt: { lt: now } },
        ],
      },
    }),
  ]);

  const pendingRequests = await enrichBookingRequestInbox(db, pendingRequestsRaw);

  return {
    arrivals,
    departures,
    pendingRequests,
    pendingPayment,
    pendingServiceOrders,
    openTickets,
    slaMetrics: {
      tm30OnTimeRate7d,
      ticketsWithOpenSLA,
    },
  };
}

export interface OpsMobilizationUnit {
  id: string;
  name: string;
  status: string;
  projectId: string;
  projectName: string;
  completedSteps: number;
  totalSteps: number;
  nextStep: string | null;
}

/**
 * Units still in mobilization, with checklist progress (doc 06 S12).
 */
export async function getOpsMobilizationQueue(
  db: PrismaClient,
  scope?: OpsBoardScope
): Promise<OpsMobilizationUnit[]> {
  if (scope && (!scope.projectIds || scope.projectIds.length === 0)) {
    return [];
  }

  const units = await db.unit.findMany({
    where: {
      status: { in: ['draft', 'mobilizing'] },
      ...(scope?.projectIds?.length ? { projectId: { in: scope.projectIds } } : {}),
    },
    select: {
      id: true,
      name: true,
      status: true,
      projectId: true,
      project: { select: { name: true } },
      mobilizationChecklist: {
        select: { step: true, completedAt: true },
        orderBy: { step: 'asc' },
      },
    },
    orderBy: { updatedAt: 'desc' },
    take: 25,
  });

  return units.map((unit) => {
    const totalSteps = unit.mobilizationChecklist.length || 7;
    const completedSteps = unit.mobilizationChecklist.filter((item) => item.completedAt).length;
    const nextItem = unit.mobilizationChecklist.find((item) => !item.completedAt);
    return {
      id: unit.id,
      name: unit.name,
      status: unit.status,
      projectId: unit.projectId,
      projectName: unit.project.name,
      completedSteps,
      totalSteps,
      nextStep: nextItem?.step ?? null,
    };
  });
}

/**
 * Pending booking requests for staff ops inbox (doc 07 F-OPS-5).
 */
export async function getOpsBookingRequests(
  db: PrismaClient,
  scope?: OpsBoardScope
): Promise<BookingRequestInboxItem[]> {
  if (scope && (!scope.projectIds || scope.projectIds.length === 0)) {
    return [];
  }

  const projectFilter = scope?.projectIds?.length
    ? { in: scope.projectIds }
    : undefined;

  const rows = await db.booking.findMany({
    where: {
      ...(projectFilter ? { projectId: projectFilter } : {}),
      status: 'requested',
    },
    select: opsBookingRequestSelect,
    orderBy: [{ requestExpiresAt: 'asc' }, { createdAt: 'asc' }],
    take: 100,
  });

  return enrichBookingRequestInbox(db, rows);
}
