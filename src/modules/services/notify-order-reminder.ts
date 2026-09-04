import type { PrismaClient } from '@prisma/client';
import { getConfig } from '@/modules/config';
import { notifyProviderMembers } from './provider-notify';

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
