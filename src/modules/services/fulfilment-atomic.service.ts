import { PrismaClient } from '@prisma/client';
import { recordServiceCommission } from '@/modules/finance';
import { track } from '@/modules/analytics';

/**
 * Canonical fulfilment write seam.
 *
 * The operational state transition and the financial earning must commit
 * together. A request that marks an order fulfilled but fails before writing
 * its commission would create a permanently inconsistent ledger; a retry could
 * also double-earn unless the accepted -> fulfilled transition is guarded.
 */
export async function fulfillServiceOrderAtomic(
  db: PrismaClient,
  serviceOrderId: string,
  fulfilledByProviderId: string
): Promise<void> {
  const order = await db.serviceOrder.findUnique({
    where: { id: serviceOrderId },
    select: {
      id: true,
      provider_id: true,
      project_id: true,
      unit_id: true,
      orderer_identity_id: true,
      total_thb: true,
      take_rate_pct_snapshot: true,
      status: true,
    },
  });

  if (!order) throw new Error(`ServiceOrder ${serviceOrderId} not found`);
  if (order.provider_id !== fulfilledByProviderId) {
    throw new Error('Only the service provider can mark order fulfilled');
  }
  if (order.status !== 'accepted') {
    throw new Error(`Cannot fulfill order in ${order.status} status`);
  }

  const fulfilledAt = new Date();
  const commissionThb = Math.round(
    order.total_thb * (Number(order.take_rate_pct_snapshot) / 100)
  );

  await db.$transaction(async (tx) => {
    // The status predicate makes concurrent/repeated fulfilment idempotent at
    // the state boundary. Exactly one transaction is allowed to earn money.
    const transitioned = await tx.serviceOrder.updateMany({
      where: {
        id: order.id,
        provider_id: fulfilledByProviderId,
        status: 'accepted',
      },
      data: {
        status: 'fulfilled',
        fulfilled_at: fulfilledAt,
      },
    });

    if (transitioned.count !== 1) {
      throw new Error('Service order is no longer eligible for fulfilment');
    }

    await recordServiceCommission(
      tx,
      order.id,
      order.unit_id,
      order.project_id,
      commissionThb,
      fulfilledAt
    );
  });

  // Analytics is intentionally after the financial transaction. It is a
  // derived observation, not part of the source-of-truth money write.
  await track(db, 'service_order_fulfilled', {
    serviceOrderId: order.id,
    projectId: order.project_id,
    unitId: order.unit_id ?? undefined,
    identityId: order.orderer_identity_id,
    totalThb: order.total_thb,
  });
}
