import { PrismaClient } from '@prisma/client';
import { getConfig } from '@/modules/config';
import { createNotification } from '@/modules/comms';

/**
 * Guest lifecycle automation (LY-8 / N-12): scheduled touchpoints driven from
 * the cron dispatcher.
 *
 * - Pre-arrival (T − notify.prearrival_days_before): passports reminder +
 *   the way into the home space (doc 07 F-GUEST-6 pre-arrival step).
 * - Checkout day (08:00 project time, N-12): departure instructions to guest.
 * - Post-stay (T + notify.review_prompt_days_after): review prompt with the
 *   green-season return offer (doc 11).
 *
 * Idempotency: one notification of the type per booking, guarded by the
 * booking_id kept in Notification.params — reruns and overlapping cron
 * invocations never double-send.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const CHECKOUT_REMINDER_HOUR = 8;

function dateKeyInTimezone(date: Date, timeZone: string): string {
  return date.toLocaleDateString('en-CA', { timeZone });
}

function hourInTimezone(date: Date, timeZone: string): number {
  return Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: 'numeric',
      hour12: false,
    }).format(date)
  );
}

async function alreadySent(
  db: PrismaClient,
  identityId: string,
  type: 'stay_prearrival_passports' | 'stay_checkout_reminder' | 'stay_review_prompt',
  bookingId: string
): Promise<boolean> {
  const existing = await db.notification.findFirst({
    where: {
      identityId,
      type,
      params: { path: ['booking_id'], equals: bookingId },
    },
    select: { id: true },
  });
  return existing !== null;
}

/**
 * Send the pre-arrival reminder for confirmed bookings whose check-in is
 * within the project's notify.prearrival_days_before window.
 * Returns the number of reminders sent.
 */
export async function sendPrearrivalReminders(
  db: PrismaClient,
  now: Date = new Date()
): Promise<number> {
  // Candidate window bounded to 30 days — per-project offsets are applied below
  const candidates = await db.booking.findMany({
    where: {
      status: 'confirmed',
      bookingType: 'guest_stay',
      startDate: { gt: now, lte: new Date(now.getTime() + 30 * DAY_MS) },
    },
    include: {
      unit: { select: { name: true, project: { select: { id: true, name: true } } } },
    },
  });

  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  let sent = 0;

  for (const booking of candidates) {
    const daysBefore =
      (await getConfig(db, 'notify.prearrival_days_before', {
        projectId: booking.projectId,
      })) ?? 5;
    const daysUntil = (booking.startDate.getTime() - now.getTime()) / DAY_MS;
    if (daysUntil > daysBefore) continue;

    if (
      await alreadySent(db, booking.guestIdentityId, 'stay_prearrival_passports', booking.id)
    ) {
      continue;
    }

    await createNotification(db, {
      identityId: booking.guestIdentityId,
      type: 'stay_prearrival_passports',
      titleKey: 'notify.stay_prearrival.title',
      bodyKey: 'notify.stay_prearrival.body',
      params: {
        booking_id: booking.id,
        unit_name: booking.unit.name,
        project_name: booking.unit.project.name,
        start_date: booking.startDate.toISOString().split('T')[0],
        home_space_url: `${baseUrl}/bookings/${booking.id}/home-space`,
      },
    });
    sent += 1;
  }

  return sent;
}

/**
 * Send checkout-day reminders (N-12) to guests still checked in on their
 * departure date. Fires once per booking at or after 08:00 in the unit's
 * project timezone on endDate.
 */
export async function sendCheckoutReminders(
  db: PrismaClient,
  now: Date = new Date()
): Promise<number> {
  const candidates = await db.booking.findMany({
    where: {
      status: 'checked_in',
      bookingType: 'guest_stay',
      endDate: {
        gte: new Date(now.getTime() - DAY_MS),
        lte: new Date(now.getTime() + DAY_MS),
      },
    },
    include: {
      unit: {
        select: {
          name: true,
          project: { select: { id: true, name: true, timezone: true } },
        },
      },
    },
  });

  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  let sent = 0;

  for (const booking of candidates) {
    const timeZone = booking.unit.project.timezone || 'Asia/Bangkok';
    const departureKey = dateKeyInTimezone(booking.endDate, timeZone);
    const todayKey = dateKeyInTimezone(now, timeZone);
    if (departureKey !== todayKey) continue;
    if (hourInTimezone(now, timeZone) < CHECKOUT_REMINDER_HOUR) continue;

    const checkoutHour =
      (await getConfig(db, 'booking.checkout_hour', {
        projectId: booking.projectId,
        unitId: booking.unitId,
      })) ?? 11;

    if (
      await alreadySent(db, booking.guestIdentityId, 'stay_checkout_reminder', booking.id)
    ) {
      continue;
    }

    await createNotification(db, {
      identityId: booking.guestIdentityId,
      type: 'stay_checkout_reminder',
      titleKey: 'notify.stay_checkout.title',
      bodyKey: 'notify.stay_checkout.body',
      params: {
        booking_id: booking.id,
        unit_name: booking.unit.name,
        project_name: booking.unit.project.name,
        end_date: booking.endDate.toISOString().split('T')[0],
        checkout_hour: String(checkoutHour),
        home_space_url: `${baseUrl}/bookings/${booking.id}/home-space`,
      },
    });
    sent += 1;
  }

  return sent;
}

/**
 * Send the post-stay review prompt (with the green-season return offer) for
 * stays checked out at least notify.review_prompt_days_after days ago.
 * Returns the number of prompts sent.
 */
export async function sendPostStayPrompts(
  db: PrismaClient,
  now: Date = new Date()
): Promise<number> {
  // Look back 14 days at most — older stays never get a late prompt
  const candidates = await db.booking.findMany({
    where: {
      status: { in: ['checked_out', 'completed'] },
      bookingType: 'guest_stay',
      checkedOutAt: {
        not: null,
        gte: new Date(now.getTime() - 14 * DAY_MS),
        lte: now,
      },
    },
    include: {
      unit: { select: { name: true, project: { select: { id: true, name: true } } } },
    },
  });

  let sent = 0;

  for (const booking of candidates) {
    const daysAfter =
      (await getConfig(db, 'notify.review_prompt_days_after', {
        projectId: booking.projectId,
      })) ?? 1;
    const daysSince =
      (now.getTime() - (booking.checkedOutAt as Date).getTime()) / DAY_MS;
    if (daysSince < daysAfter) continue;

    if (await alreadySent(db, booking.guestIdentityId, 'stay_review_prompt', booking.id)) {
      continue;
    }

    await createNotification(db, {
      identityId: booking.guestIdentityId,
      type: 'stay_review_prompt',
      titleKey: 'notify.stay_review_prompt.title',
      bodyKey: 'notify.stay_review_prompt.body',
      params: {
        booking_id: booking.id,
        unit_name: booking.unit.name,
        project_name: booking.unit.project.name,
      },
    });
    sent += 1;
  }

  return sent;
}
