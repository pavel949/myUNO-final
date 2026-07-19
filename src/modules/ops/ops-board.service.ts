import { PrismaClient } from '@prisma/client';

export interface OpsBoardData {
  arrivals: OpsBooking[];
  departures: OpsBooking[];
  pendingPayment: OpsBooking[];
  pendingServiceOrders: OpsServiceOrder[];
}

interface OpsBooking {
  id: string;
  status: string;
  startDate: Date;
  endDate: Date;
  totalThb: number;
  adults: number;
  children: number;
  verificationStatus: string;
  unit: { name: string };
  guestIdentity: { firstName: string; lastName: string };
  payments: { id: string }[];
}

interface OpsServiceOrder {
  id: string;
  scheduled_start: Date;
  total_thb: number;
  service: { title: string };
  orderer: { firstName: string; lastName: string };
}

function dayRange(date: Date): { from: Date; to: Date } {
  const from = new Date(date);
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + 1);
  return { from, to };
}

/**
 * Get today's operations board data: arrivals, departures, pending payments, pending service orders
 */
export async function getOpsBoard(db: PrismaClient, date: Date = new Date()): Promise<OpsBoardData> {
  const { from, to } = dayRange(date);

  const bookingSelect = {
    id: true,
    status: true,
    startDate: true,
    endDate: true,
    totalThb: true,
    adults: true,
    children: true,
    verificationStatus: true,
    unit: { select: { name: true } },
    guestIdentity: { select: { firstName: true, lastName: true } },
    payments: {
      where: { status: 'succeeded' as const, purpose: 'stay' as const },
      select: { id: true },
    },
  };

  const [arrivals, departures, pendingPayment, pendingServiceOrders] = await Promise.all([
    db.booking.findMany({
      where: {
        startDate: { gte: from, lt: to },
        status: { in: ['confirmed', 'pending_payment'] },
      },
      select: bookingSelect,
      orderBy: { startDate: 'asc' },
    }),
    db.booking.findMany({
      where: { endDate: { gte: from, lt: to }, status: 'checked_in' },
      select: bookingSelect,
      orderBy: { endDate: 'asc' },
    }),
    db.booking.findMany({
      where: { status: 'pending_payment' },
      select: bookingSelect,
      orderBy: { startDate: 'asc' },
      take: 50,
    }),
    // Service orders awaiting cash (placed = not yet paid) — F-OPS-6 for services
    db.serviceOrder.findMany({
      where: { status: 'placed' },
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
  ]);

  return { arrivals, departures, pendingPayment, pendingServiceOrders };
}
