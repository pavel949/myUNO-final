import type { PrismaClient } from '@prisma/client';
import { createNotification } from '@/modules/comms';

/**
 * Fan-out when a request-to-book is created (doc 07 F-GUEST-4):
 * N-33 guest acknowledgement + N-34 ops/host responder alert.
 * Best-effort — never throws into the booking path.
 */
export async function notifyBookingRequested(
  db: PrismaClient,
  bookingId: string,
  requestHours: number
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
    const params = {
      booking_id: booking.id,
      unit_name: booking.unit?.name || '',
      start_date: booking.startDate.toISOString().slice(0, 10),
      end_date: booking.endDate.toISOString().slice(0, 10),
      total_thb: totalBaht.toLocaleString(),
      request_hours: String(requestHours),
      guest_name: `${booking.guestIdentity.firstName} ${booking.guestIdentity.lastName}`.trim(),
      ops_requests_url: `${baseUrl}/ops/requests`,
      mc_requests_url: `${baseUrl}/mc/requests`,
    };

    await createNotification(db, {
      identityId: booking.guestIdentity.id,
      type: 'stay_request_placed',
      titleKey: 'notify.stay_request_placed.title',
      bodyKey: 'notify.stay_request_placed.body',
      params,
    });

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
          titleKey: 'notify.stay_request_received.title',
          bodyKey: 'notify.stay_request_received.body',
          params,
        }).catch(() => null)
      )
    );
  } catch (error) {
    console.error('[bookingRequested] fan-out failed (non-blocking):', error);
  }
}
