import { PrismaClient } from '@prisma/client';

export interface UnitIcalConflictAlert {
  bookingId: string;
  unitId: string;
  unitName: string;
  startDate: string;
  endDate: string;
  guestName: string;
  notifiedAt: Date;
}

const ACTIVE_BOOKING_STATUSES = [
  'pending_payment',
  'confirmed',
  'checked_in',
] as const;

type ScopedBooking = {
  id: string;
  startDate: Date;
  endDate: Date;
  unitId: string;
  unit: { name: string };
  guestIdentity: { firstName: string; lastName: string };
};

function alertsFromBookings(
  bookings: ScopedBooking[],
  notifications: Array<{ createdAt: Date; params: unknown }>
): UnitIcalConflictAlert[] {
  if (bookings.length === 0) {
    return [];
  }

  const bookingById = new Map(bookings.map((booking) => [booking.id, booking]));
  const seen = new Set<string>();
  const alerts: UnitIcalConflictAlert[] = [];

  for (const notification of notifications) {
    const params = notification.params as {
      booking_id?: string;
      start_date?: string;
      end_date?: string;
    };
    const bookingId = params.booking_id;
    if (!bookingId || seen.has(bookingId)) {
      continue;
    }
    const booking = bookingById.get(bookingId);
    if (!booking) {
      continue;
    }
    seen.add(bookingId);
    alerts.push({
      bookingId,
      unitId: booking.unitId,
      unitName: booking.unit.name,
      startDate:
        params.start_date ?? booking.startDate.toISOString().slice(0, 10),
      endDate: params.end_date ?? booking.endDate.toISOString().slice(0, 10),
      guestName: `${booking.guestIdentity.firstName} ${booking.guestIdentity.lastName}`,
      notifiedAt: notification.createdAt,
    });
  }

  return alerts.sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  );
}

/**
 * Surface unresolved OTA-vs-platform calendar clashes for a unit (F-OPS-4 / N-25).
 */
export async function getUnitIcalConflictAlerts(
  db: PrismaClient,
  unitId: string
): Promise<UnitIcalConflictAlert[]> {
  const bookings = await db.booking.findMany({
    where: {
      unitId,
      status: { in: [...ACTIVE_BOOKING_STATUSES] },
    },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      unitId: true,
      unit: { select: { name: true } },
      guestIdentity: { select: { firstName: true, lastName: true } },
    },
  });

  if (bookings.length === 0) {
    return [];
  }

  const notifications = await db.notification.findMany({
    where: {
      type: 'ops_ical_conflict',
      OR: bookings.map((booking) => ({
        params: { path: ['booking_id'], equals: booking.id },
      })),
    },
    orderBy: { createdAt: 'desc' },
    select: {
      createdAt: true,
      params: true,
    },
  });

  return alertsFromBookings(bookings, notifications);
}

/**
 * Project-scoped OTA conflict alerts for the ops board (F-OPS-4 / N-25).
 */
export async function getProjectIcalConflictAlerts(
  db: PrismaClient,
  scope?: { projectIds?: string[] }
): Promise<UnitIcalConflictAlert[]> {
  if (scope && (!scope.projectIds || scope.projectIds.length === 0)) {
    return [];
  }

  const bookings = await db.booking.findMany({
    where: {
      status: { in: [...ACTIVE_BOOKING_STATUSES] },
      ...(scope?.projectIds?.length
        ? { projectId: { in: scope.projectIds } }
        : {}),
    },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      unitId: true,
      unit: { select: { name: true } },
      guestIdentity: { select: { firstName: true, lastName: true } },
    },
    take: 200,
  });

  if (bookings.length === 0) {
    return [];
  }

  const notifications = await db.notification.findMany({
    where: {
      type: 'ops_ical_conflict',
      OR: bookings.map((booking) => ({
        params: { path: ['booking_id'], equals: booking.id },
      })),
    },
    orderBy: { createdAt: 'desc' },
    select: {
      createdAt: true,
      params: true,
    },
  });

  return alertsFromBookings(bookings, notifications);
}
