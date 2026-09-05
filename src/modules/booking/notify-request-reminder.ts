import type { PrismaClient } from '@prisma/client';
import { createNotification } from '@/modules/comms';

/**
 * Half-SLA reminder for unanswered request-to-book (doc 11 N-34).
 * Re-alerts ops/MC responders that a request still needs action.
 */
export async function notifyRequestReminder(
  db: PrismaClient,
  bookingId: string,
  hoursRemaining: number
): Promise<void> {
  try {
    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      include: {
        unit: { select: { id: true, name: true } },
        guestIdentity: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    if (!booking || !booking.guestIdentity) return;

    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const totalBaht = Math.round(booking.totalThb / 100);
    const msTotal =
      booking.requestExpiresAt && booking.createdAt
        ? booking.requestExpiresAt.getTime() - booking.createdAt.getTime()
        : hoursRemaining * 60 * 60 * 1000;
    const requestHours = Math.max(1, Math.round(msTotal / (60 * 60 * 1000)));

    const params = {
      booking_id: booking.id,
      unit_name: booking.unit?.name || '',
      start_date: booking.startDate.toISOString().slice(0, 10),
      end_date: booking.endDate.toISOString().slice(0, 10),
      total_thb: totalBaht.toLocaleString(),
      request_hours: String(requestHours),
      hours_remaining: String(hoursRemaining),
      guest_name: `${booking.guestIdentity.firstName} ${booking.guestIdentity.lastName}`.trim(),
      ops_requests_url: `${baseUrl}/ops/requests`,
      mc_requests_url: `${baseUrl}/mc/requests`,
    };

    const opsRoles = await db.roleAssignment.findMany({
      where: {
        role: { in: ['staff_ops', 'onsite_host'] },
        status: 'active',
        OR: [{ projectId: booking.projectId }, { unitId: booking.unitId }],
      },
      select: { identityId: true },
    });

    const recipients = new Set(opsRoles.map((role) => role.identityId));

    const mcEngagement = await db.unitEngagement.findFirst({
      where: {
        unitId: booking.unitId,
        status: 'active',
        engagementType: 'via_management_company',
        managementOrgId: { not: null },
      },
      select: { managementOrgId: true },
    });

    if (mcEngagement?.managementOrgId) {
      const mcMembers = await db.roleAssignment.findMany({
        where: {
          role: 'mc_member',
          status: 'active',
          organizationId: mcEngagement.managementOrgId,
        },
        select: { identityId: true },
      });
      for (const member of mcMembers) {
        recipients.add(member.identityId);
      }
    }

    recipients.delete(booking.guestIdentityId);

    await Promise.all(
      [...recipients].map((identityId) =>
        createNotification(db, {
          identityId,
          type: 'stay_request_received',
          titleKey: 'notify.stay_request_reminder.title',
          bodyKey: 'notify.stay_request_reminder.body',
          params,
        }).catch(() => null)
      )
    );
  } catch (error) {
    console.error('[requestReminder] fan-out failed (non-blocking):', error);
  }
}

/**
 * Send half-SLA reminders for request-to-book bookings still awaiting a response.
 * Returns the number of reminders sent.
 */
export async function remindUnansweredRequests(
  db: PrismaClient,
  now: Date = new Date()
): Promise<number> {
  const pending = await db.booking.findMany({
    where: {
      status: 'requested',
      requestExpiresAt: { gt: now },
    },
    select: {
      id: true,
      createdAt: true,
      requestExpiresAt: true,
    },
  });

  let reminded = 0;

  for (const booking of pending) {
    if (!booking.requestExpiresAt) continue;

    const msTotal = booking.requestExpiresAt.getTime() - booking.createdAt.getTime();
    if (msTotal <= 0) continue;

    const halfPoint = new Date(booking.createdAt.getTime() + msTotal / 2);
    if (now < halfPoint) continue;

    const alreadyReminded = await db.notification.findFirst({
      where: {
        type: 'stay_request_received',
        bodyKey: 'notify.stay_request_reminder.body',
        params: {
          path: ['booking_id'],
          equals: booking.id,
        },
      },
      select: { id: true },
    });
    if (alreadyReminded) continue;

    const msRemaining = booking.requestExpiresAt.getTime() - now.getTime();
    const hoursRemaining = Math.max(1, Math.ceil(msRemaining / (60 * 60 * 1000)));

    await notifyRequestReminder(db, booking.id, hoursRemaining);
    reminded += 1;
  }

  return reminded;
}
