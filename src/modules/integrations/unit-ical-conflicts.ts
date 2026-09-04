import { PrismaClient } from '@prisma/client';

export interface UnitIcalConflictAlert {
  bookingId: string;
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

/**
 * Surface unresolved OTA-vs-platform calendar clashes for a unit (F-OPS-4 / N-25).
 * Conflicts are raised at import time via ops_ical_conflict notifications; the
 * platform booking remains authoritative until ops corrects the OTA channel.
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
      guestIdentity: { select: { firstName: true, lastName: true } },
    },
  });
  if (bookings.length === 0) {
    return [];
  }

  const bookingById = new Map(bookings.map((booking) => [booking.id, booking]));
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
