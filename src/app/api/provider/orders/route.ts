import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServiceOrdersByProvider } from '@/modules/services';
import { getConfig } from '@/modules/config';
import { requireProviderMember } from '@/app/libs/providerGuard';
import { handleError } from '@/app/libs/errorHandler';
import { serializeOrder } from '@/app/libs/serviceOrderSerializer';

/**
 * GET /api/provider/orders — the caller's provider's order queue.
 * Each unaccepted order carries its accept deadline (createdAt +
 * `service.accept_sla_hours`) so the portal can count down the SLA.
 */
export async function GET() {
  try {
    const { providerId } = await requireProviderMember();
    const orders = await getServiceOrdersByProvider(prisma, providerId);
    const slaHours =
      ((await getConfig(prisma, 'service.accept_sla_hours')) as number) ?? 12;

    return NextResponse.json({
      orders: orders.map((order) => ({
        ...serializeOrder(order),
        noteToProvider: order.note_to_provider ?? null,
        acceptDeadline:
          order.status === 'placed' || order.status === 'paid'
            ? new Date(order.createdAt.getTime() + slaHours * 60 * 60 * 1000)
            : null,
      })),
    });
  } catch (error) {
    return handleError(error);
  }
}
