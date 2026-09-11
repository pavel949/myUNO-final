import { PrismaClient } from '@prisma/client';
import { getConfig } from '@/modules/config';
import { track } from '@/modules/analytics';
import { fulfilmentConfirmDeadline } from './service-order.service';

/**
 * Serialize orderer confirmation with dispute creation and automatic close.
 * The service-order row is the mutex shared by all three flows.
 */
export async function confirmServiceOrderFulfilment(
  db: PrismaClient,
  serviceOrderId: string,
  confirmedByIdentityId: string
): Promise<void> {
  const closed = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM service_order WHERE id = ${serviceOrderId} FOR UPDATE`;

    const order = await tx.serviceOrder.findUnique({ where: { id: serviceOrderId } });
    if (!order) throw new Error(`ServiceOrder ${serviceOrderId} not found`);

    if (order.orderer_identity_id !== confirmedByIdentityId) {
      throw new Error('Only the orderer can confirm this order was fulfilled');
    }
    if (order.status !== 'fulfilled') {
      throw new Error(`Cannot confirm an order in ${order.status} status`);
    }

    const configured = (await getConfig(tx as any, 'service.fulfilment_confirm_window_hours', {
      projectId: order.project_id,
    })) as number | undefined;
    const windowHours = configured ?? 48;
    if (!Number.isInteger(windowHours) || windowHours <= 0) {
      throw new Error('Invalid fulfilment confirmation window configuration');
    }

    const deadline = fulfilmentConfirmDeadline(order.fulfilled_at, windowHours);
    if (deadline && deadline <= new Date()) {
      throw new Error(`The ${windowHours}-hour window for confirming this order has passed`);
    }

    const openDispute = await tx.dispute.findFirst({
      where: {
        subjectType: 'service_order',
        subjectId: order.id,
        decidedAt: null,
      },
      select: { id: true },
    });
    if (openDispute) {
      throw new Error('Cannot confirm this order while an open dispute exists');
    }

    await tx.serviceOrder.update({
      where: { id: serviceOrderId },
      data: {
        status: 'closed',
        closed_at: new Date(),
        closed_by_identity_id: confirmedByIdentityId,
      },
    });

    return order;
  });

  await track(db, 'service_order_closed', {
    serviceOrderId: closed.id,
    projectId: closed.project_id,
    unitId: closed.unit_id ?? undefined,
    identityId: confirmedByIdentityId,
    totalThb: closed.total_thb,
  });
}
