import type { PrismaClient } from '@prisma/client';
import { createNotification } from '@/modules/comms';

export interface BookingModifiedChange {
  bookingId: string;
  previousStartDate: Date;
  previousEndDate: Date;
  startDate: Date;
  endDate: Date;
  previousTotalThb: number;
  totalThb: number;
}

/**
 * Fan-out when a stay modification is applied (doc 07 F-GUEST-9, N-11):
 * guest acknowledgement (`stay_dates_modified`) + ops/MC/owner feed (`stay_modified_ops`).
 * Best-effort — never throws into the booking path.
 */
export async function notifyBookingModified(
  db: PrismaClient,
  change: BookingModifiedChange
): Promise<void> {
  try {
    const booking = await db.booking.findUnique({
      where: { id: change.bookingId },
      include: {
        unit: { select: { id: true, name: true, ownerIdentityId: true } },
        guestIdentity: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    if (!booking || !booking.guestIdentity) return;

    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const priceDeltaBaht = Math.round((change.totalThb - change.previousTotalThb) / 100);
    const priceDeltaLabel =
      priceDeltaBaht === 0
        ? '0'
        : priceDeltaBaht > 0
          ? `+${priceDeltaBaht.toLocaleString()}`
          : priceDeltaBaht.toLocaleString();

    const params = {
      booking_id: booking.id,
      unit_name: booking.unit?.name || '',
      guest_name: `${booking.guestIdentity.firstName} ${booking.guestIdentity.lastName}`.trim(),
      old_start_date: change.previousStartDate.toISOString().slice(0, 10),
      old_end_date: change.previousEndDate.toISOString().slice(0, 10),
      start_date: change.startDate.toISOString().slice(0, 10),
      end_date: change.endDate.toISOString().slice(0, 10),
      price_delta_thb: priceDeltaLabel,
      trips_url: `${baseUrl}/trips/${booking.id}`,
      admin_bookings_url: `${baseUrl}/app/admin/bookings`,
    };

    await createNotification(db, {
      identityId: booking.guestIdentity.id,
      type: 'stay_dates_modified',
      titleKey: 'notify.stay_dates_modified.title',
      bodyKey: 'notify.stay_dates_modified.body',
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

    const feedRecipients = new Set(opsRoles.map((role) => role.identityId));

    if (booking.unit?.ownerIdentityId) {
      feedRecipients.add(booking.unit.ownerIdentityId);
    }

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
        feedRecipients.add(member.identityId);
      }
    }

    feedRecipients.delete(booking.guestIdentityId);

    await Promise.all(
      [...feedRecipients].map((identityId) =>
        createNotification(db, {
          identityId,
          type: 'stay_modified_ops',
          titleKey: 'notify.stay_modified_ops.title',
          bodyKey: 'notify.stay_modified_ops.body',
          params,
        }).catch(() => null)
      )
    );
  } catch (error) {
    console.error('[bookingModified] fan-out failed (non-blocking):', error);
  }
}
