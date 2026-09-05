import type { PrismaClient } from '@prisma/client';
import { createNotification } from '@/modules/comms';

/**
 * N-17: owner books own unit → ops/MC alert for turnover scheduling (doc 11).
 * Best-effort — never throws into the booking path.
 */
export async function notifyOwnerStayBooked(
  db: PrismaClient,
  bookingId: string
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

    if (!booking || booking.bookingType !== 'owner_stay') {
      return;
    }

    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const ownerName = booking.guestIdentity
      ? `${booking.guestIdentity.firstName} ${booking.guestIdentity.lastName}`.trim()
      : '';

    const params = {
      booking_id: booking.id,
      unit_name: booking.unit?.name || '',
      owner_name: ownerName,
      start_date: booking.startDate.toISOString().slice(0, 10),
      end_date: booking.endDate.toISOString().slice(0, 10),
      ops_board_url: `${baseUrl}/ops`,
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

    if (booking.guestIdentityId) {
      recipients.delete(booking.guestIdentityId);
    }

    await Promise.all(
      [...recipients].map((identityId) =>
        createNotification(db, {
          identityId,
          type: 'stay_owner_stay_booked',
          titleKey: 'notify.stay_owner_stay_booked.title',
          bodyKey: 'notify.stay_owner_stay_booked.body',
          params,
        }).catch(() => null)
      )
    );
  } catch (error) {
    console.error('[ownerStayBooked] fan-out failed (non-blocking):', error);
  }
}
