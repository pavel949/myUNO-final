import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getConfig } from '@/modules/config';
import { expireStaleServiceOrders } from '@/modules/services';

/**
 * POST /api/cron/expire-service-orders — expire service orders past SLA.
 * Finds all orders in placed/paid status older than service.accept_sla_hours,
 * marks them expired, and refunds if payment exists.
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get('X-Cron-Secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const slaHours = (await getConfig(prisma, 'service.accept_sla_hours')) as number | null;
    const hours = slaHours ?? 12;

    const result = await expireStaleServiceOrders(prisma, hours);

    return NextResponse.json({
      success: true,
      expired: result.expired,
      refunded: result.refunded,
    });
  } catch (error) {
    console.error('Error expiring stale service orders:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
