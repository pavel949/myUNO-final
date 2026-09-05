import type { PrismaClient } from '@prisma/client';
import { createNotification } from '@/modules/comms';
import { sendEmail } from '@/modules/auth';
import { getLabels } from '@/lib/i18n';

async function notifyOpsNewBooking(
  db: PrismaClient,
  booking: {
    id: string;
    projectId: string;
    unitId: string;
    guestIdentityId: string;
    startDate: Date;
    endDate: Date;
    totalThb: number;
    unit: { name: string | null } | null;
    guestIdentity: { firstName: string; lastName: string } | null;
  }
): Promise<void> {
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const totalBaht = Math.round(booking.totalThb / 100);
  const params = {
    booking_id: booking.id,
    unit_name: booking.unit?.name || '',
    start_date: booking.startDate.toISOString().slice(0, 10),
    end_date: booking.endDate.toISOString().slice(0, 10),
    total_thb: totalBaht.toLocaleString(),
    guest_name: booking.guestIdentity
      ? `${booking.guestIdentity.firstName} ${booking.guestIdentity.lastName}`.trim()
      : '',
    admin_bookings_url: `${baseUrl}/app/admin/bookings`,
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
        type: 'stay_new_booking_ops',
        titleKey: 'notify.stay_new_booking_ops.title',
        bodyKey: 'notify.stay_new_booking_ops.body',
        params,
      }).catch(() => null)
    )
  );
}

/**
 * Fan-out when a stay booking becomes confirmed (cash recorded or card
 * verified): in-app notifications to guest and owner + confirmation email
 * to the guest; ops/MC alert (N-03). Best-effort — never throws into the
 * payment path. Notification catalog: N-02 stay_confirmed, N-03
 * stay_new_booking_ops (doc 11).
 */
export async function notifyBookingConfirmed(
  db: PrismaClient,
  bookingId: string
): Promise<void> {
  try {
    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      include: {
        unit: { select: { id: true, name: true, ownerIdentityId: true } },
        project: { select: { name: true } },
        guestIdentity: {
          select: { id: true, email: true, firstName: true, lastName: true, preferredLocale: true },
        },
      },
    });

    if (!booking || !booking.guestIdentity) return;

    const params = {
      unit_name: booking.unit?.name || '',
      start_date: booking.startDate.toISOString().slice(0, 10),
      end_date: booking.endDate.toISOString().slice(0, 10),
      total_thb: booking.totalThb.toLocaleString(),
    };

    await createNotification(db, {
      identityId: booking.guestIdentity.id,
      type: 'stay_confirmed',
      titleKey: 'notify.stay_confirmed.title',
      bodyKey: 'notify.stay_confirmed.body',
      params,
    });

    if (booking.unit?.ownerIdentityId) {
      await createNotification(db, {
        identityId: booking.unit.ownerIdentityId,
        type: 'stay_confirmed',
        titleKey: 'notify.stay_confirmed.owner_title',
        bodyKey: 'notify.stay_confirmed.owner_body',
        params,
      });
    }

    await notifyOpsNewBooking(db, {
      id: booking.id,
      projectId: booking.projectId,
      unitId: booking.unitId,
      guestIdentityId: booking.guestIdentityId,
      startDate: booking.startDate,
      endDate: booking.endDate,
      totalThb: booking.totalThb,
      unit: booking.unit,
      guestIdentity: booking.guestIdentity,
    });

    if (booking.guestIdentity.email) {
      const locale = (booking.guestIdentity.preferredLocale || 'en') as 'ru' | 'en' | 'th' | 'zh';
      const labels = await getLabels(
        {
          'email.stay_confirmed.subject': 'Your stay is confirmed — {unit_name}',
          'email.stay_confirmed.body':
            'Hi {first_name},\n\nYour booking at {unit_name} is confirmed.\n\nCheck-in: {start_date}\nCheck-out: {end_date}\nTotal: ฿{total_thb}\n\nSee your trip and prepare for arrival: {trips_url}\n\nmyUNO — serviced living in Phuket',
        },
        locale
      );

      const fillIn = (template: string) =>
        template
          .replace(/\{first_name\}/g, booking.guestIdentity!.firstName)
          .replace(/\{unit_name\}/g, params.unit_name)
          .replace(/\{start_date\}/g, params.start_date)
          .replace(/\{end_date\}/g, params.end_date)
          .replace(/\{total_thb\}/g, params.total_thb)
          .replace(
            /\{trips_url\}/g,
            `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/trips`
          );

      await sendEmail({
        to: booking.guestIdentity.email,
        subject: fillIn(labels['email.stay_confirmed.subject']),
        html: fillIn(labels['email.stay_confirmed.body']).replace(/\n/g, '<br>'),
      });
    }
  } catch (error) {
    console.error('[bookingConfirmed] fan-out failed (non-blocking):', error);
  }
}
