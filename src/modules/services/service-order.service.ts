import { PrismaClient, ServiceOrderStatus, RoleType, RefundReason } from '@prisma/client';
import { getConfig } from '@/modules/config';
import { createNotification, raiseTicket } from '@/modules/comms';
import { track } from '@/modules/analytics';
import { recordServiceCommission, refund as requestPaymentRefund } from '@/modules/finance';
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

async function issueServiceOrderRefunds(input: {
  db: PrismaClient;
  serviceOrderId: string;
  initiatedByIdentityId: string;
  reason: RefundReason;
  targetRefundThb: number;
}) {
  if (input.targetRefundThb <= 0) {
    return { issuedRefundThb: 0, recordsCreated: 0 };
  }

  const succeededPayments = await input.db.payment.findMany({
    where: {
      serviceOrderId: input.serviceOrderId,
      status: 'succeeded',
      purpose: 'service_order',
    },
    include: {
      refunds: {
        where: { status: { in: ['requested', 'processing', 'succeeded'] } },
        select: { amountThb: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  let remaining = input.targetRefundThb;
  let issuedRefundThb = 0;
  let recordsCreated = 0;

  for (const payment of succeededPayments) {
    if (remaining <= 0) {
      break;
    }

    const alreadyRefunded = payment.refunds.reduce((sum, row) => sum + row.amountThb, 0);
    const refundableOnPayment = Math.max(0, payment.amountThb - alreadyRefunded);
    const refundAmount = Math.min(refundableOnPayment, remaining);
    if (refundAmount <= 0) {
      continue;
    }

    if (payment.method === 'card_provider') {
      await requestPaymentRefund(
        input.db,
        payment.id,
        refundAmount,
        input.reason,
        input.initiatedByIdentityId
      );
    } else {
      // For cash/manual rails this records the refund obligation; a real
      // operator payout marks it succeeded later through finance flows.
      const refund = await input.db.refund.create({
        data: {
          paymentId: payment.id,
          method: 'cash',
          amountThb: refundAmount,
          reason: input.reason,
          status: 'requested',
          initiatedByIdentityId: input.initiatedByIdentityId,
        },
      });
      await input.db.ledgerEntry.create({
        data: {
          entryType: 'refund_out',
          amountThb: -refundAmount,
          serviceOrderId: input.serviceOrderId,
          paymentId: payment.id,
          refundId: refund.id,
          occurredOn: new Date(),
          description: `Service-order refund requested: ${input.reason}`,
        },
      });
    }

    issuedRefundThb += refundAmount;
    recordsCreated += 1;
    remaining -= refundAmount;
  }

  return { issuedRefundThb, recordsCreated };
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

  const serviceProjects = await db.serviceProject.findMany({
    where: { service_id: serviceId },
    select: { project_id: true },
  });
  if (
    serviceProjects.length > 0 &&
    !serviceProjects.some((available) => available.project_id === projectId)
  ) {
    throw new Error('Service is not available in this project');
  }

  if (unitId) {
    const unit = await db.unit.findUnique({
      where: { id: unitId },
      select: { projectId: true },
    });
    if (!unit || unit.projectId !== projectId) {
      throw new Error('Unit does not belong to this project');
    }
  }

  if (bookingId) {
    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      select: { projectId: true, unitId: true, guestIdentityId: true },
    });
    if (
      !booking ||
      booking.projectId !== projectId ||
      booking.unitId !== unitId ||
      booking.guestIdentityId !== ordererIdentityId
    ) {
      throw new Error('Booking context is invalid for this order');
    }
  }

  if (!Number.isInteger(quantity) || quantity < 1 || !Number.isInteger(totalThb) || totalThb <= 0) {
    throw new Error('Order quantity and total must be positive integers');
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
  const paidAmount = order.payments
    .filter((payment) => payment.status === 'succeeded')
    .reduce((sum, payment) => sum + payment.amountThb, 0);
  const { issuedRefundThb } = await issueServiceOrderRefunds({
    db,
    serviceOrderId: order.id,
    initiatedByIdentityId: order.orderer_identity_id,
    reason: 'provider_no_show',
    targetRefundThb: paidAmount,
  });

  // Update order status
  await db.serviceOrder.update({
    where: { id: serviceOrderId },
    data: { status: 'declined', refund_accrued_thb: issuedRefundThb },
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
 * Transitions accepted → fulfilled. Review prompt (N-27) is sent by cron 12h later.
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

  const fulfilledAt = new Date();
  await db.serviceOrder.update({
    where: { id: serviceOrderId },
    data: { status: 'fulfilled', fulfilled_at: fulfilledAt },
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
 * The confirm/dispute window (doc 07 F-PROV-3).
 *
 * `fulfilled` is not the end of an order. The orderer gets
 * `[cfg] service.fulfilment_confirm_window_hours` to say the work was
 * actually done — or to dispute it — and only then does the order reach its
 * terminal `closed` state. Before this existed the `closed` status was dead
 * and a fulfilled order stayed disputable forever, which is an unbounded
 * liability sitting behind every provider remittance.
 *
 * The deadline is computed, never stored: the window is a config value that
 * a project may tighten, and a stored deadline would freeze the old value on
 * every order already in flight.
 */
export async function getFulfilmentConfirmWindowHours(
  db: PrismaClient,
  projectId: string
): Promise<number> {
  const hours = (await getConfig(db, 'service.fulfilment_confirm_window_hours', {
    projectId,
  })) as number | undefined;
  return hours ?? 48;
}

/** When the orderer's confirm/dispute window closes, or null if not fulfilled. */
export function fulfilmentConfirmDeadline(
  fulfilledAt: Date | null,
  windowHours: number
): Date | null {
  if (!fulfilledAt) return null;
  return new Date(fulfilledAt.getTime() + windowHours * 60 * 60 * 1000);
}

/**
 * Nightly sweep: close fulfilled orders whose window has lapsed.
 *
 * An order carrying an open dispute is left alone — closing it would end the
 * window the dispute is still being argued inside. It closes when the dispute
 * is decided, or on the next sweep after that.
 */
export async function closeSettledServiceOrders(
  db: PrismaClient
): Promise<{ closed: number }> {
  const fulfilled = await db.serviceOrder.findMany({
    where: { status: 'fulfilled', fulfilled_at: { not: null } },
    select: { id: true, project_id: true, unit_id: true, total_thb: true, fulfilled_at: true },
  });

  if (fulfilled.length === 0) return { closed: 0 };

  // One config read per project, not per order — a nightly sweep over a busy
  // project would otherwise hammer the resolver with identical lookups.
  const windowByProject = new Map<string, number>();
  for (const projectId of new Set(fulfilled.map((o) => o.project_id))) {
    windowByProject.set(projectId, await getFulfilmentConfirmWindowHours(db, projectId));
  }

  const openDisputes = await db.dispute.findMany({
    where: {
      subjectType: 'service_order',
      subjectId: { in: fulfilled.map((o) => o.id) },
      decidedAt: null,
    },
    select: { subjectId: true },
  });
  const disputed = new Set(openDisputes.map((d) => d.subjectId));

  const now = new Date();
  let closed = 0;

  for (const order of fulfilled) {
    // The batch read above is a cheap filter, not the decision. A dispute
    // request that passed its own validation a moment ago may still be
    // mid-flight — it creates its rows after `openDisputes` was read — so
    // closing on that read alone can strand a `closed` order under an open
    // dispute. The lock below is what actually decides.
    if (disputed.has(order.id)) continue;

    const deadline = fulfilmentConfirmDeadline(
      order.fulfilled_at,
      windowByProject.get(order.project_id) ?? 48
    );
    if (!deadline || deadline > now) continue;

    const didClose = await db.$transaction(async (tx) => {
      // Same row lock `raiseDispute` takes. Whichever arrives second blocks
      // here and then reads what the first actually wrote, so the pair can
      // never both succeed.
      await tx.$queryRaw`SELECT id FROM service_order WHERE id = ${order.id} FOR UPDATE`;

      const fresh = await tx.serviceOrder.findUnique({
        where: { id: order.id },
        select: { status: true },
      });
      if (fresh?.status !== 'fulfilled') return false;

      const openDispute = await tx.dispute.findFirst({
        where: { subjectType: 'service_order', subjectId: order.id, decidedAt: null },
        select: { id: true },
      });
      if (openDispute) return false;

      await tx.serviceOrder.update({
        where: { id: order.id },
        // No `closed_by_identity_id`: nobody confirmed, the window lapsed.
        data: { status: 'closed', closed_at: now },
      });
      return true;
    });

    if (!didClose) continue;

    await track(db, 'service_order_closed', {
      serviceOrderId: order.id,
      projectId: order.project_id,
      unitId: order.unit_id ?? undefined,
      totalThb: order.total_thb,
    });

    closed++;
  }

  return { closed };
}

/**
 * Orderer reports that the provider did not show (doc 07 F-PROV-3).
 * accepted → failed, refund per `[cfg] service.provider_no_show_refund_pct`,
 * auto-ticket for ops, provider notified.
 */
export async function reportProviderNoShow(
  db: PrismaClient,
  serviceOrderId: string,
  reportedByIdentityId: string,
  note?: string
): Promise<{ ticketId: string; refundThb: number }> {
  const order = await db.serviceOrder.findUnique({
    where: { id: serviceOrderId },
    include: { service: true, provider: true, payments: true },
  });

  if (!order) {
    throw new Error(`ServiceOrder ${serviceOrderId} not found`);
  }

  if (order.orderer_identity_id !== reportedByIdentityId) {
    throw new Error('Only the orderer can report a provider no-show');
  }

  if (order.status !== 'accepted') {
    throw new Error(`Cannot report no-show for an order in ${order.status} status`);
  }

  const now = new Date();
  if (now < order.scheduled_start) {
    throw new Error('The scheduled time has not started yet');
  }

  const refundPct =
    ((await getConfig(db, 'service.provider_no_show_refund_pct', {
      projectId: order.project_id,
    })) as number | undefined) ?? 100;

  const refundTargetThb = Math.round((order.total_thb * refundPct) / 100);

  const { issuedRefundThb } = await issueServiceOrderRefunds({
    db,
    serviceOrderId: order.id,
    initiatedByIdentityId: reportedByIdentityId,
    reason: 'provider_no_show',
    targetRefundThb: refundTargetThb,
  });

  await db.serviceOrder.update({
    where: { id: serviceOrderId },
    data: {
      status: 'failed',
      cancellation_reason: note?.trim() || 'provider_no_show',
      refund_accrued_thb: issuedRefundThb,
    },
  });

  const serviceTitle = order.service?.title || 'Service';
  const { id: ticketId } = await raiseTicket(db, {
    projectId: order.project_id,
    unitId: order.unit_id ?? undefined,
    raisedByIdentityId: reportedByIdentityId,
    raisedByRole: order.orderer_role,
    categoryKey: 'complaint',
    title: `Provider no-show: ${serviceTitle}`,
    description:
      note?.trim() ||
      `Order ${order.id}: the provider did not arrive for the scheduled service.`,
    priority: 'high',
  });

  await createNotification(db, {
    identityId: order.orderer_identity_id,
    type: 'order_failed_no_show',
    titleKey: 'order.no_show.title',
    bodyKey: 'order.no_show.body',
    params: {
      service_title: serviceTitle,
      refund_thb: issuedRefundThb,
    },
  });

  await notifyProviderMembers(db, order.provider_id, {
    type: 'order_failed_no_show',
    titleKey: 'order.provider_no_show.title',
    bodyKey: 'order.provider_no_show.body',
    params: {
      order_id: order.id,
      service_title: serviceTitle,
    },
  });

  await track(db, 'service_order_no_show', {
    serviceOrderId: order.id,
    projectId: order.project_id,
    unitId: order.unit_id ?? undefined,
    identityId: order.orderer_identity_id,
    totalThb: order.total_thb,
    refundThb: issuedRefundThb,
  });

  return { ticketId, refundThb: issuedRefundThb };
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

  const refundTargetThb = Math.round((order.total_thb * refundPct) / 100);
  const { issuedRefundThb } = await issueServiceOrderRefunds({
    db,
    serviceOrderId: order.id,
    initiatedByIdentityId: cancelledByIdentityId,
    reason: 'cancellation',
    targetRefundThb: refundTargetThb,
  });

  // Update order
  await db.serviceOrder.update({
    where: { id: serviceOrderId },
    data: {
      status: 'cancelled',
      cancelled_at: now,
      cancelled_by_identity_id: cancelledByIdentityId,
      cancellation_reason: reason,
      refund_accrued_thb: issuedRefundThb,
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
      refund_thb: issuedRefundThb,
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
      refund_thb: issuedRefundThb,
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

  if (order.orderer_identity_id !== raterIdentityId) {
    throw new Error('Only the orderer can rate this service order');
  }

  // `closed` counts as much as `fulfilled`: the work was delivered either
  // way, and an order the orderer confirmed closes within minutes — long
  // before the review prompt is due. Refusing here would make that prompt a
  // dead end and lose the ratings of the customers who confirmed.
  if (order.status !== 'fulfilled' && order.status !== 'closed') {
    throw new Error(`Cannot rate order in ${order.status} status`);
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

    const { issuedRefundThb } = await issueServiceOrderRefunds({
      db,
      serviceOrderId: order.id,
      initiatedByIdentityId: order.orderer_identity_id,
      reason: 'provider_no_show',
      targetRefundThb: order.total_thb,
    });
    if (issuedRefundThb > 0) {
      await db.serviceOrder.update({
        where: { id: order.id },
        data: {
          refund_accrued_thb: issuedRefundThb,
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
