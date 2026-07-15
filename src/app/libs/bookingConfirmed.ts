import type { PrismaClient } from '@prisma/client';
import { createNotification } from '@/modules/comms';
import { sendEmail } from '@/modules/auth';
import { getLabels } from '@/lib/i18n';

/**
 * Fan-out when a stay booking becomes confirmed (cash recorded or card
 * verified): in-app notifications to guest and owner + confirmation email
 * to the guest. Best-effort — never throws into the payment path.
 * Notification catalog: N-02 stay_confirmed (doc 11).
 */
export async function notifyBookingConfirmed(
  db: PrismaClient,
  bookingId: string
): Promise<void> {
  try {
    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      include: {
        unit: { select: { name: true, ownerIdentityId: true } },
        project: { select: { name: true } },
        guestIdentity: { select: { id: true, email: true, firstName: true, preferredLocale: true } },
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

    if (booking.guestIdentity.email) {
      const locale = (booking.guestIdentity.preferredLocale || 'en') as 'ru' | 'en' | 'th';
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
