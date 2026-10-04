import type { PrismaClient } from '@prisma/client';
import { createNotification } from '@/modules/comms';

/**
 * Proactive operational alert for a newly-created instant booking that is
 * holding inventory while payment is still pending.
 *
 * Reuses the existing operational booking notification type so no schema
 * migration is required; distinct content keys describe the payment-pending
 * state. Staff/host and MC recipients receive links to surfaces they can
 * actually open.
 */
export async function notifyBookingPendingPayment(
  db: PrismaClient,
  bookingId: string
): Promise<void> {
  try {
    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        status: true,
        projectId: true,
        unitId: true,
        guestIdentityId: true,
        startDate: true,
        endDate: true,
        holdExpiresAt: true,
        totalThb: true,
        unit: { select: { name: true } },
        guestIdentity: { select: { firstName: true, lastName: true } },
      },
    });
    if (!booking || booking.status !== 'pending_payment') return;

    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const baseParams = {
      booking_id: booking.id,
      unit_name: booking.unit?.name || '',
      guest_name: booking.guestIdentity
        ? [booking.guestIdentity.firstName, booking.guestIdentity.lastName].filter(Boolean).join(' ')
        : '',
      start_date: booking.startDate.toISOString().slice(0, 10),
      end_date: booking.endDate.toISOString().slice(0, 10),
      total_thb: Math.round(booking.totalThb / 100).toLocaleString(),
      hold_expires_at: booking.holdExpiresAt?.toISOString() || '',
    };

    const opsRoles = await db.roleAssignment.findMany({
      where: {
        role: { in: ['staff_ops', 'onsite_host'] },
        status: 'active',
        OR: [{ projectId: booking.projectId }, { unitId: booking.unitId }],
      },
      select: { identityId: true },
    });
    const opsRecipients = new Set(opsRoles.map((row) => row.identityId));
    const mcRecipients = new Set<string>();

    const engagement = await db.unitEngagement.findFirst({
      where: {
        unitId: booking.unitId,
        status: 'active',
        engagementType: 'via_management_company',
        managementOrgId: { not: null },
      },
      select: { managementOrgId: true },
    });
    if (engagement?.managementOrgId) {
      const members = await db.roleAssignment.findMany({
        where: {
          role: 'mc_member',
          status: 'active',
          organizationId: engagement.managementOrgId,
        },
        select: { identityId: true },
      });
      for (const member of members) mcRecipients.add(member.identityId);
    }

    opsRecipients.delete(booking.guestIdentityId);
    mcRecipients.delete(booking.guestIdentityId);
    for (const identityId of opsRecipients) mcRecipients.delete(identityId);

    const opsUrl = `${baseUrl}/ops/stays/${encodeURIComponent(booking.id)}`;
    const mcUrl = `${baseUrl}/mc/properties/${encodeURIComponent(booking.unitId)}?tab=reservations`;

    await Promise.all([
      ...[...opsRecipients].map((identityId) =>
        createNotification(db, {
          identityId,
          type: 'stay_new_booking_ops',
          titleKey: 'notify.stay_payment_pending_ops.title',
          bodyKey: 'notify.stay_payment_pending_ops.body',
          params: { ...baseParams, booking_url: opsUrl, admin_bookings_url: opsUrl },
        }).catch(() => null)
      ),
      ...[...mcRecipients].map((identityId) =>
        createNotification(db, {
          identityId,
          type: 'stay_new_booking_ops',
          titleKey: 'notify.stay_payment_pending_ops.title',
          bodyKey: 'notify.stay_payment_pending_ops.body',
          params: { ...baseParams, booking_url: mcUrl, admin_bookings_url: mcUrl },
        }).catch(() => null)
      ),
    ]);
  } catch (error) {
    console.error('[bookingPendingPayment] fan-out failed (non-blocking):', error);
  }
}
