import type { PrismaClient } from '@prisma/client';
import { createNotification } from '@/modules/comms';
import { sendEmail } from '@/modules/auth';
import { getLabels } from '@/lib/i18n';

/**
 * Fan-out when a stay booking is cancelled (doc 07 F-GUEST-8, N-09):
 * in-app + email to guest; in-app to unit owner and project ops staff.
 * Best-effort — never throws into the cancellation path.
 */
export async function notifyBookingCancelled(
  db: PrismaClient,
  bookingId: string,
  refundAmountThb: number
): Promise<void> {
  try {
    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      include: {
        unit: { select: { id: true, name: true, ownerIdentityId: true } },
        project: { select: { name: true } },
        guestIdentity: {
          select: { id: true, email: true, firstName: true, preferredLocale: true },
        },
      },
    });

    if (!booking || !booking.guestIdentity) return;

    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const refundBaht = Math.round(refundAmountThb / 100);
    const params = {
      booking_id: booking.id,
      unit_name: booking.unit?.name || '',
      start_date: booking.startDate.toISOString().slice(0, 10),
      end_date: booking.endDate.toISOString().slice(0, 10),
      refund_thb: refundBaht.toLocaleString(),
      trips_url: `${baseUrl}/trips/${booking.id}`,
    };

    const guestBodyKey =
      refundBaht > 0 ? 'notify.stay_cancelled.body' : 'notify.stay_cancelled.body_no_refund';

    await createNotification(db, {
      identityId: booking.guestIdentity.id,
      type: 'stay_cancelled',
      titleKey: 'notify.stay_cancelled.title',
      bodyKey: guestBodyKey,
      params,
    });

    const ownerBodyKey =
      refundBaht > 0
        ? 'notify.stay_cancelled.owner_body'
        : 'notify.stay_cancelled.owner_body_no_refund';

    const opsRoles = await db.roleAssignment.findMany({
      where: {
        role: { in: ['staff_ops', 'onsite_host'] },
        status: 'active',
        OR: [{ projectId: booking.projectId }, { unitId: booking.unitId }],
      },
      select: { identityId: true },
    });

    const feedRecipients = new Set<string>();
    if (booking.unit?.ownerIdentityId) {
      feedRecipients.add(booking.unit.ownerIdentityId);
    }
    for (const role of opsRoles) {
      feedRecipients.add(role.identityId);
    }
    feedRecipients.delete(booking.guestIdentity.id);

    await Promise.all(
      [...feedRecipients].map((identityId) =>
        createNotification(db, {
          identityId,
          type: 'stay_cancelled',
          titleKey: 'notify.stay_cancelled.owner_title',
          bodyKey: ownerBodyKey,
          params,
        }).catch(() => null)
      )
    );

    if (booking.guestIdentity.email) {
      const locale = (booking.guestIdentity.preferredLocale || 'en') as 'ru' | 'en' | 'th' | 'zh';
      const labels = await getLabels(
        {
          'email.stay_cancelled.subject': 'Your booking was cancelled — {unit_name}',
          'email.stay_cancelled.body':
            'Hi {first_name},\n\nYour stay at {unit_name} ({start_date} — {end_date}) has been cancelled.\n\nRefund by your cancellation policy: ฿{refund_thb}\n\nSee your trip: {trips_url}\n\nmyUNO — serviced living in Phuket',
          'email.stay_cancelled.body_no_refund':
            'Hi {first_name},\n\nYour stay at {unit_name} ({start_date} — {end_date}) has been cancelled. No payment was due.\n\nSee your trip: {trips_url}\n\nmyUNO — serviced living in Phuket',
        },
        locale
      );

      const fillIn = (template: string) =>
        template
          .replace(/\{first_name\}/g, booking.guestIdentity!.firstName)
          .replace(/\{unit_name\}/g, params.unit_name)
          .replace(/\{start_date\}/g, params.start_date)
          .replace(/\{end_date\}/g, params.end_date)
          .replace(/\{refund_thb\}/g, params.refund_thb)
          .replace(/\{trips_url\}/g, params.trips_url);

      const bodyKey =
        refundBaht > 0 ? 'email.stay_cancelled.body' : 'email.stay_cancelled.body_no_refund';

      await sendEmail({
        to: booking.guestIdentity.email,
        subject: fillIn(labels['email.stay_cancelled.subject']),
        html: fillIn(labels[bodyKey]).replace(/\n/g, '<br>'),
      });
    }
  } catch (error) {
    console.error('[bookingCancelled] fan-out failed (non-blocking):', error);
  }
}
