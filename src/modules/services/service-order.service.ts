import { PrismaClient, ServiceOrderStatus, RoleType } from '@prisma/client';
import { getConfig } from '@/modules/config';
import { createNotification } from '@/modules/comms';
import { track } from '@/modules/analytics';
import { recordServiceCommission } from '@/modules/finance';
import { notifyProviderMembers } from './provider-notify';

export interface CreateServiceOrderInput {
  serviceId: string;
  projectId: string;
  unitId?: string;
  bookingId?: string;
  ordererIdentityId: string;
  ordererRole: RoleType;
  scheduledStart: Date;
  scheduledEnd: Date;
  quantity: number;
  priceBreakdown: Record<string, any>;
  totalThb: number;
  tookRatePctSnapshot: number;
  noteToProvider?: string;
  addressNote?: string;
}

export interface ServiceOrderDetails {
  id: string;
  status: ServiceOrderStatus;
  totalThb: number;
  priceBreakdown: Record<string, any>;
  createdAt: Date;
  scheduledStart: Date;
  scheduledEnd: Date;
  [key: string]: any;
}

/**
 * Create a new service order (placed status).
 * Validates service availability and computes take-rate snapshot.
 */
export async function createServiceOrder(
  db: PrismaClient,
  input: CreateServiceOrderInput
): Promise<{ id: string }> {
  const {
    serviceId,
    projectId,
    unitId,
    bookingId,
    ordererIdentityId,
    ordererRole,
    scheduledStart,
    scheduledEnd,
    quantity,
    priceBreakdown,
    totalThb,
    tookRatePctSnapshot,
    noteToProvider,
    addressNote,
  } = input;

  // Validate service exists and is active
  const service = await db.service.findUnique({
    where: { id: serviceId },
    include: { provider: true },
  });

  if (!service) {
    throw new Error(`Service ${serviceId} not found`);
  }

  if (service.status !== 'active') {
    throw new Error('Service is not available for ordering');
  }

  if (!service.provider || service.provider.status !== 'active' || !service.provider.vetted_at) {
    throw new Error('Provider is not vetted');
  }

  // Create order in placed status
  const order = await db.serviceOrder.create({
    data: {
      service_id: serviceId,
      provider_id: service.provider_id,
      project_id: projectId,
      unit_id: unitId,
      booking_id: bookingId,
      orderer_identity_id: ordererIdentityId,
      orderer_role: ordererRole,
      scheduled_start: scheduledStart,
      scheduled_end: scheduledEnd,
      quantity,
      price_breakdown: priceBreakdown,
      total_thb: totalThb,
      take_rate_pct_snapshot: tookRatePctSnapshot,
      status: 'placed',
      note_to_provider: noteToProvider,
      address_note: addressNote,
    },
  });

  // Notify the provider's members of the new order (N-26)
  await notifyProviderMembers(db, service.provider_id, {
    type: 'order_new',
    titleKey: 'order.new.title',
    bodyKey: 'order.new.body',
    params: {
      order_id: order.id,
      service_title: service.title,
    },
  });

  await track(db, 'service_order_placed', {
    serviceOrderId: order.id,
    projectId,
    unitId,
    bookingId,
    identityId: ordererIdentityId,
    totalThb,
  });

  return { id: order.id };
}

/**
 * Accept a service order (placed/paid → accepted).
 * Provider confirms they will fulfill. Notifies orderer.
 */
export async function acceptServiceOrder(
  db: PrismaClient,
  serviceOrderId: string,
  acceptedByProviderId: string
): Promise<void> {
  const order = await db.serviceOrder.findUnique({
    where: { id: serviceOrderId },
    include: { service: true, provider: true },
  });

  if (!order) {
    throw new Error(`ServiceOrder ${serviceOrderId} not found`);
  }

  if (order.provider_id !== acceptedByProviderId) {
    throw new Error('Only the service provider can accept an order');
  }

  if (order.status !== 'placed' && order.status !== 'paid') {
    throw new Error(`Cannot accept order in ${order.status} status`);
  }

  await db.serviceOrder.update({
    where: { id: serviceOrderId },
    data: { status: 'accepted' },
  });

  // Track analytics event
  await track(db, 'service_order_accepted', {
    serviceOrderId: order.id,
    serviceId: order.service_id,
    projectId: order.project_id,
    unitId: order.unit_id ?? undefined,
    identityId: order.orderer_identity_id,
    totalThb: order.total_thb,
  });

  // Notify orderer of acceptance (N-21)
  await createNotification(db, {
    identityId: order.orderer_identity_id,
    type: 'order_accepted',
    titleKey: 'order.accepted.title',
    bodyKey: 'order.accepted.body',
    params: {
      order_id: order.id,
      service_title: order.service?.title || 'Service',
    },
  });
}

/**
 * Decline a service order (placed/paid → declined).
 * Provider refuses to fulfill. Auto-refund if paid. Notifies orderer.
 */
export async function declineServiceOrder(
  db: PrismaClient,
  serviceOrderId: string,
  declinedByProviderId: string,
  reason?: string
): Promise<void> {
  const order = await db.serviceOrder.findUnique({
    where: { id: serviceOrderId },
    include: { service: true, provider: true, payments: true },
  });

  if (!order) {
    throw new Error(`ServiceOrder ${serviceOrderId} not found`);
  }

  if (order.provider_id !== declinedByProviderId) {
    throw new Error('Only the service provider can decline an order');
  }

  if (order.status !== 'placed' && order.status !== 'paid') {
    throw new Error(`Cannot decline order in ${order.status} status`);
  }

  // Find paid payment if any
  const paidPayment = order.payments.find((p) => p.status === 'succeeded');

  // If paid, initiate refund
  if (paidPayment) {
    await db.refund.create({
      data: {
        paymentId: paidPayment.id,
        method: 'cash', // cash-first in loop one
        amountThb: paidPayment.amountThb,
        reason: 'provider_no_show', // Decline is treated as provider no-show
        status: 'succeeded',
        paidBackByIdentityId: null,
        // A provider decline is triggered by the Provider (not an Identity); the
        // refund's initiator must be a real Identity, so record the orderer, who
        // is the refund's beneficiary and always present on the order.
        initiatedByIdentityId: order.orderer_identity_id,
      },
    });

    // Write ledger entry
    await db.ledgerEntry.create({
      data: {
        entryType: 'refund_out',
        amountThb: -paidPayment.amountThb,
        serviceOrderId: order.id,
        paymentId: paidPayment.id,
        occurredOn: new Date(),
        description: `Service order declined by provider: ${reason || 'no reason'}`,
      },
    });
  }

  // Update order status
  await db.serviceOrder.update({
    where: { id: serviceOrderId },
    data: { status: 'declined' },
  });

  // Track analytics event
  await track(db, 'service_order_declined', {
    serviceOrderId: order.id,
    serviceId: order.service_id,
    projectId: order.project_id,
    unitId: order.unit_id ?? undefined,
    identityId: order.orderer_identity_id,
    totalThb: order.total_thb,
    reason: reason || 'no reason provided',
  });

  // Notify orderer of decline (N-22)
  await createNotification(db, {
    identityId: order.orderer_identity_id,
    type: 'order_declined',
    titleKey: 'order.declined.title',
    bodyKey: 'order.declined.body',
    params: {
      order_id: order.id,
      service_title: order.service?.title || 'Service',
    },
  });
}

/**
 * Mark a service order as fulfilled.
 * Transitions accepted → fulfilled. Prompts for review.
 */
export async function fulfillServiceOrder(
  db: PrismaClient,
  serviceOrderId: string,
  fulfilledByProviderId: string
): Promise<void> {
  const order = await db.serviceOrder.findUnique({
    where: { id: serviceOrderId },
    include: { service: true },
  });

  if (!order) {
    throw new Error(`ServiceOrder ${serviceOrderId} not found`);
  }

  if (order.provider_id !== fulfilledByProviderId) {
    throw new Error('Only the service provider can mark order fulfilled');
  }

  if (order.status !== 'accepted') {
    throw new Error(`Cannot fulfill order in ${order.status} status`);
  }

  await db.serviceOrder.update({
    where: { id: serviceOrderId },
    data: { status: 'fulfilled' },
  });

  // Prompt orderer for review (N-27)
  await createNotification(db, {
    identityId: order.orderer_identity_id,
    type: 'order_review_prompt',
    titleKey: 'order.review_prompt.title',
    bodyKey: 'order.review_prompt.body',
    params: {
      order_id: order.id,
      service_title: order.service?.title || 'Service',
    },
  });

  // Record commission on fulfillment (S5)
  const commissionThb = Math.round(
    order.total_thb * (Number(order.take_rate_pct_snapshot) / 100)
  );
  await recordServiceCommission(
    db,
    order.id,
    order.unit_id,
    order.project_id,
    commissionThb,
    new Date()
  );

  await track(db, 'service_order_fulfilled', {
    serviceOrderId: order.id,
    projectId: order.project_id,
    unitId: order.unit_id ?? undefined,
    identityId: order.orderer_identity_id,
    totalThb: order.total_thb,
  });
}

/**
 * Cancel a service order (any state → cancelled).
 * Applies refund policy: full refund within cancel_window_hours of start, none after.
 */
export async function cancelServiceOrder(
  db: PrismaClient,
  serviceOrderId: string,
  cancelledByIdentityId: string,
  reason?: string
): Promise<void> {
  const order = await db.serviceOrder.findUnique({
    where: { id: serviceOrderId },
    include: { service: true, project: true, payments: true },
  });

  if (!order) {
    throw new Error(`ServiceOrder ${serviceOrderId} not found`);
  }

  if (order.status === 'cancelled' || order.status === 'closed') {
    throw new Error(`Cannot cancel order in ${order.status} status`);
  }

  // Get cancellation window from config
  const cancelWindowHours = ((await getConfig(db, 'service.cancel_window_hours', {
    projectId: order.project_id,
  })) as number | undefined) || 24;

  const now = new Date();
  const cancelWindowMs = cancelWindowHours * 60 * 60 * 1000;
  // Cancelling with more than the window's notice before the scheduled start
  // earns a full refund; cancelling inside the window earns nothing.
  const refundPct =
    order.scheduled_start.getTime() - now.getTime() > cancelWindowMs ? 100 : 0;

  const refundThb = Math.round((order.total_thb * refundPct) / 100);

  // Find paid payment if any
  const paidPayment = order.payments.find((p) => p.status === 'succeeded');

  // If paid and refund > 0, create refund
  if (paidPayment && refundThb > 0) {
    await db.refund.create({
      data: {
        paymentId: paidPayment.id,
        method: 'cash',
        amountThb: refundThb,
        reason: 'cancellation',
        status: 'succeeded',
        paidBackByIdentityId: null,
        initiatedByIdentityId: cancelledByIdentityId,
      },
    });

    // Write ledger entry
    await db.ledgerEntry.create({
      data: {
        entryType: 'refund_out',
        amountThb: -refundThb,
        serviceOrderId: order.id,
        paymentId: paidPayment.id,
        occurredOn: now,
        description: `Service order cancelled: ${reason || 'no reason'} (refund ${refundPct}%)`,
      },
    });
  }

  // Update order
  await db.serviceOrder.update({
    where: { id: serviceOrderId },
    data: {
      status: 'cancelled',
      cancelled_at: now,
      cancelled_by_identity_id: cancelledByIdentityId,
      cancellation_reason: reason,
      refund_accrued_thb: refundThb,
    },
  });

  // Notify orderer of cancellation (staff/ops cancels included; when the
  // orderer cancelled themselves this doubles as the confirmation).
  await createNotification(db, {
    identityId: order.orderer_identity_id,
    type: 'order_cancelled',
    titleKey: 'order.cancelled.title',
    bodyKey: 'order.cancelled.body',
    params: {
      order_id: order.id,
      service_title: order.service?.title || 'Service',
      refund_thb: refundThb,
    },
  });

  // The provider's members lose a job — tell them too.
  await notifyProviderMembers(db, order.provider_id, {
    type: 'order_cancelled',
    titleKey: 'order.cancelled.title',
    bodyKey: 'order.cancelled.body',
    params: {
      order_id: order.id,
      service_title: order.service?.title || 'Service',
      refund_thb: refundThb,
    },
  });

  await track(db, 'service_order_cancelled', {
    serviceOrderId: order.id,
    projectId: order.project_id,
    unitId: order.unit_id ?? undefined,
    identityId: cancelledByIdentityId,
    totalThb: order.total_thb,
  });
}

/**
 * Get a service order with full context.
 */
export async function getServiceOrder(
  db: PrismaClient,
  serviceOrderId: string
): Promise<ServiceOrderDetails> {
  const order = await db.serviceOrder.findUnique({
    where: { id: serviceOrderId },
    include: {
      service: true,
      provider: true,
      project: true,
      unit: true,
      booking: true,
      payments: true,
    },
  });

  if (!order) {
    throw new Error(`ServiceOrder ${serviceOrderId} not found`);
  }

  return order as any;
}

/**
 * Rate a service order (create a review).
 * List a provider's orders for the portal queue, newest first. Actionable
 * statuses (placed/paid/accepted) sort ahead of terminal ones so the queue
 * reads work-first.
 */
export async function getServiceOrdersByProvider(
  db: PrismaClient,
  providerId: string,
  filters?: { limit?: number }
): Promise<any[]> {
  const orders = await db.serviceOrder.findMany({
    where: { provider_id: providerId },
    include: { service: { select: { title: true } } },
    orderBy: { createdAt: 'desc' },
    take: filters?.limit ?? 100,
  });
  const actionable = new Set(['placed', 'paid', 'accepted']);
  return orders.sort(
    (a, b) =>
      Number(actionable.has(b.status)) - Number(actionable.has(a.status))
  );
}

/**
 * Creates a polymorphic Review record with target_type=service_order.
 */
export async function rateServiceOrder(
  db: PrismaClient,
  serviceOrderId: string,
  raterIdentityId: string,
  rating: number,
  comment?: string
): Promise<{ id: string }> {
  // Validate order exists
  const order = await db.serviceOrder.findUnique({
    where: { id: serviceOrderId },
  });

  if (!order) {
    throw new Error(`ServiceOrder ${serviceOrderId} not found`);
  }

  if (rating < 1 || rating > 5) {
    throw new Error('Rating must be 1-5');
  }

  // Check if already reviewed
  const existing = await db.review.findFirst({
    where: {
      target_type: 'service_order',
      target_id: serviceOrderId,
      author_identity_id: raterIdentityId,
    },
  });

  if (existing) {
    throw new Error('You have already reviewed this service order');
  }

  const review = await db.review.create({
    data: {
      target_type: 'service_order',
      target_id: serviceOrderId,
      author_identity_id: raterIdentityId,
      rating,
      comment,
      status: 'published',
    },
  });

  return { id: review.id };
}

/**
 * Cron: expire service orders past the SLA (placed/paid status).
 * Marks them expired and refunds any payment collected.
 */
export async function expireStaleServiceOrders(
  db: PrismaClient,
  slaHours: number
): Promise<{ expired: number; refunded: number }> {
  const cutoffTime = new Date(Date.now() - slaHours * 60 * 60 * 1000);

  const expiredOrders = await db.serviceOrder.findMany({
    where: {
      status: { in: ['placed', 'paid'] },
      createdAt: { lt: cutoffTime },
      expired_at: null,
    },
    include: {
      payments: true,
    },
  });

  let refunded = 0;

  for (const order of expiredOrders) {
    // Mark as expired
    await db.serviceOrder.update({
      where: { id: order.id },
      data: {
        status: 'expired' as ServiceOrderStatus,
        expired_at: new Date(),
      },
    });

    // Refund any successful payment
    if (order.payments.some((p) => p.status === 'succeeded')) {
      await db.serviceOrder.update({
        where: { id: order.id },
        data: {
          refund_accrued_thb: order.total_thb,
        },
      });
      refunded++;
    }

    // Note: order expired due to no response; provider sees it in queue (status=expired)
  }

  return {
    expired: expiredOrders.length,
    refunded,
  };
}
