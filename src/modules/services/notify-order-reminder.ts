import type { PrismaClient } from '@prisma/client';
import { getConfig } from '@/modules/config';
import { createNotification } from '@/modules/comms';
import { notifyProviderMembers } from './provider-notify';

const HOUR_MS = 60 * 60 * 1000;

/**
 * Half-SLA reminder for unanswered service orders (doc 11 N-26).
 * Re-alerts provider members that a paid/placed order still needs acceptance.
 */
export async function notifyServiceOrderReminder(
  db: PrismaClient,
  orderId: string,
  hoursRemaining: number
): Promise<void> {
  try {
    const order = await db.serviceOrder.findUnique({
      where: { id: orderId },
      include: { service: { select: { title: true } } },
    });
    if (!order) return;

    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    await notifyProviderMembers(db, order.provider_id, {
      type: 'order_new',
      titleKey: 'order.new.reminder.title',
      bodyKey: 'order.new.reminder.body',
      params: {
        order_id: order.id,
        service_title: order.service.title,
        hours_remaining: String(hoursRemaining),
        provider_orders_url: `${baseUrl}/provider`,
      },
    });
  } catch (error) {
    console.error('[serviceOrderReminder] fan-out failed (non-blocking):', error);
  }
}

/**
 * Send half-SLA reminders for service orders still awaiting provider acceptance.
 * Returns the number of reminders sent.
 */
export async function remindUnansweredServiceOrders(
  db: PrismaClient,
  now: Date = new Date()
): Promise<number> {
  const slaHours = (await getConfig(db, 'service.accept_sla_hours')) as number | null;
  const acceptSlaHours = slaHours ?? 12;

  const pending = await db.serviceOrder.findMany({
    where: {
      status: { in: ['placed', 'paid'] },
      expired_at: null,
      createdAt: { gt: new Date(now.getTime() - acceptSlaHours * 60 * 60 * 1000) },
    },
    select: {
      id: true,
      createdAt: true,
      project_id: true,
    },
  });

  let reminded = 0;

  for (const order of pending) {
    const msTotal = acceptSlaHours * 60 * 60 * 1000;
    const halfPoint = new Date(order.createdAt.getTime() + msTotal / 2);
    if (now < halfPoint) continue;

    const alreadyReminded = await db.notification.findFirst({
      where: {
        type: 'order_new',
        bodyKey: 'order.new.reminder.body',
        params: {
          path: ['order_id'],
          equals: order.id,
        },
      },
      select: { id: true },
    });
    if (alreadyReminded) continue;

    const expiresAt = new Date(order.createdAt.getTime() + msTotal);
    const msRemaining = expiresAt.getTime() - now.getTime();
    const hoursRemaining = Math.max(1, Math.ceil(msRemaining / (60 * 60 * 1000)));

    await notifyServiceOrderReminder(db, order.id, hoursRemaining);
    reminded += 1;
  }

  return reminded;
}

/**
 * Send review prompts (N-27) for fulfilled service orders past the configured
 * delay (default 12h). Skips orders that already have a review or prompt.
 */
export async function sendServiceOrderReviewPrompts(
  db: PrismaClient,
  now: Date = new Date()
): Promise<number> {
  const hoursAfter =
    ((await getConfig(db, 'notify.service_review_prompt_hours_after')) as number | null) ?? 12;
  const cutoff = new Date(now.getTime() - hoursAfter * HOUR_MS);

  const candidates = await db.serviceOrder.findMany({
    where: {
      status: 'fulfilled',
      fulfilled_at: { not: null, lte: cutoff },
    },
    include: {
      service: { select: { title: true } },
    },
  });

  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  let sent = 0;

  for (const order of candidates) {
    const existingReview = await db.review.findFirst({
      where: {
        target_type: 'service_order',
        target_id: order.id,
        author_identity_id: order.orderer_identity_id,
      },
      select: { id: true },
    });
    if (existingReview) continue;

    const alreadyPrompted = await db.notification.findFirst({
      where: {
        type: 'order_review_prompt',
        params: { path: ['order_id'], equals: order.id },
      },
      select: { id: true },
    });
    if (alreadyPrompted) continue;

    await createNotification(db, {
      identityId: order.orderer_identity_id,
      type: 'order_review_prompt',
      titleKey: 'order.review_prompt.title',
      bodyKey: 'order.review_prompt.body',
      params: {
        order_id: order.id,
        service_title: order.service?.title || 'Service',
        order_url: `${baseUrl}/services/orders/${order.id}`,
      },
    });
    sent += 1;
  }

  return sent;
}
