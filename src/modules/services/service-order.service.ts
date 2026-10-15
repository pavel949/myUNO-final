import { createHash } from 'node:crypto';
import { PrismaClient, ServiceOrderStatus, RoleType, RefundReason } from '@prisma/client';
import { getConfig } from '@/modules/config';
import { createNotification, raiseTicket } from '@/modules/comms';
import { track } from '@/modules/analytics';
import { recordServiceCommission, processRequestedCardRefund } from '@/modules/finance';
import { notifyProviderMembers } from './provider-notify';
import { resolveProjectServiceOffer } from './project-service-offer';
import { StandaloneServiceContext, parseStandaloneContext, validateStandaloneServiceContext, standaloneOrganizationId } from './standalone-context';

export interface CreateServiceOrderInput {
  serviceId: string;
  requestKey?: string;
  requestFingerprint?: string;
  projectId: string | null;
  serviceContext?: StandaloneServiceContext;
  unitId?: string;
  bookingId?: string;
  ordererIdentityId: string;
  ordererRole: RoleType;
  scheduledStart: Date;
  scheduledEnd: Date;
  quantity: number;
  /** Computed inside the domain service from the canonical Service price. */
  priceBreakdown?: Record<string, any>;
  totalThb?: number;
  tookRatePctSnapshot?: number;
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
  db: PrismaClient; serviceOrderId: string; initiatedByIdentityId: string; reason: RefundReason; targetRefundThb: number;
}) {
  if (input.targetRefundThb <= 0) return { issuedRefundThb: 0, recordsCreated: 0 };
  const reserved = await input.db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.serviceOrderId}))`;
    await tx.$queryRaw`SELECT id FROM service_order WHERE id = ${input.serviceOrderId} FOR UPDATE`;
    const payments = await tx.payment.findMany({ where: { serviceOrderId: input.serviceOrderId, status: 'succeeded', purpose: 'service_order' }, orderBy: { createdAt: 'asc' }, include: { refunds: true } });
    if (payments.some(payment => payment.refunds.some(refund => refund.status === 'failed'))) {
      // Known failed attempts require operator review, never an endless new-refund cron loop.
      return { dispatch: [] as string[], issuedRefundThb: input.targetRefundThb, recordsCreated: 0 };
    }
    let active = payments.reduce((sum, payment) => sum + payment.refunds.filter(refund => ['requested', 'processing', 'succeeded'].includes(refund.status)).reduce((value, refund) => value + refund.amountThb, 0), 0);
    let remaining = Math.max(0, input.targetRefundThb - active);
    const dispatch: string[] = payments.flatMap(payment => payment.refunds.filter(refund => refund.method === 'card_provider' && refund.status === 'requested').map(refund => refund.id));
    let created = 0;
    for (const payment of payments) {
      if (remaining <= 0) break;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${payment.id}))`;
      // Re-read after payment lock, matching every finance refund writer's source/payment order.
      const current = await tx.refund.findMany({ where: { paymentId: payment.id, status: { in: ['requested', 'processing', 'succeeded'] } }, select: { amountThb: true } });
      const aggregate = await tx.refund.aggregate({ where: { payment: { serviceOrderId: input.serviceOrderId }, status: { in: ['requested', 'processing', 'succeeded'] } }, _sum: { amountThb: true } });
      active = aggregate._sum.amountThb ?? 0;
      remaining = Math.max(0, input.targetRefundThb - active);
      const existing = current.reduce((sum, refund) => sum + refund.amountThb, 0);
      const amount = Math.min(remaining, Math.max(0, payment.amountThb - existing));
      if (amount <= 0) continue;
      const card = payment.method === 'card_provider';
      const refund = await tx.refund.create({ data: { paymentId: payment.id, method: card ? 'card_provider' : 'cash', amountThb: amount, reason: input.reason, status: 'requested', initiatedByIdentityId: input.initiatedByIdentityId } });
      if (card) dispatch.push(refund.id);
      else await tx.ledgerEntry.create({ data: { entryType: 'refund_out', amountThb: -amount, serviceOrderId: input.serviceOrderId, paymentId: payment.id, refundId: refund.id, occurredOn: new Date(), description: `Service-order refund requested: ${input.reason}` } });
      active += amount; remaining -= amount; created++;
    }
    return { dispatch, issuedRefundThb: Math.min(input.targetRefundThb, active), recordsCreated: created };
  });
  for (const id of reserved.dispatch) await processRequestedCardRefund(input.db, id);
  return reserved;
}

type TerminalClaim = { status: 'cancelled' | 'failed' | 'declined' | 'expired'; actorIdentityId?: string; providerId?: string; reason?: string; cutoff?: Date };
/** Commit the winning terminal state and its refund obligation before any irreversible gateway request. */
async function claimTerminalOrder(db: PrismaClient, id: string, claim: TerminalClaim) {
  return db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`;
    await tx.$queryRaw`SELECT id FROM service_order WHERE id = ${id} FOR UPDATE`;
    const order = await tx.serviceOrder.findUniqueOrThrow({ where: { id }, include: { service: true, provider: true, payments: true } });
    const allowed = claim.status === 'cancelled' ? ['placed', 'paid', 'accepted'] : claim.status === 'failed' ? ['accepted'] : ['placed', 'paid'];
    if (!allowed.includes(order.status)) throw new Error(`Cannot ${claim.status === 'cancelled' ? 'cancel' : claim.status === 'failed' ? 'report no-show for' : claim.status === 'declined' ? 'decline' : 'expire'} order in ${order.status} status`);
    if (claim.providerId && order.provider_id !== claim.providerId) throw new Error('Only the service provider can decline an order');
    if (claim.status === 'failed' && order.orderer_identity_id !== claim.actorIdentityId) throw new Error('Only the orderer can report a provider no-show');
    if (claim.status === 'failed' && new Date() < order.scheduled_start) throw new Error('The scheduled time has not started yet');
    if (claim.cutoff && order.createdAt >= claim.cutoff) throw new Error('Cannot expire order before its SLA');
    const paid = order.payments.filter(payment => payment.status === 'succeeded' && payment.purpose === 'service_order').reduce((sum, payment) => sum + payment.amountThb, 0);
    let pct = 100;
    if (claim.status === 'cancelled') {
      const snapshot = order.terms_snapshot as Record<string, unknown> | null;
      const window = typeof snapshot?.cancellationWindowHours === 'number' ? snapshot.cancellationWindowHours : Number(await getConfig(tx as unknown as PrismaClient, 'service.cancel_window_hours', { projectId: order.project_id ?? undefined }) ?? 24);
      if (!Number.isFinite(window) || window < 0) throw new Error('Configured cancellation window is invalid');
      pct = order.scheduled_start.getTime() - Date.now() > window * 3600000 ? 100 : 0;
    } else if (claim.status === 'failed') pct = Number(await getConfig(tx as unknown as PrismaClient, 'service.provider_no_show_refund_pct', { projectId: order.project_id ?? undefined }) ?? 100);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) throw new Error('Configured refund percentage is invalid');
    const target = claim.status === 'declined' ? paid : Math.min(paid, Math.round(order.total_thb * pct / 100));
    await tx.serviceOrder.update({ where: { id }, data: { status: claim.status, refund_accrued_thb: target, ...(claim.status === 'cancelled' ? { cancelled_at: new Date(), cancelled_by_identity_id: claim.actorIdentityId, cancellation_reason: claim.reason } : {}), ...(claim.status === 'failed' ? { cancellation_reason: claim.reason || 'provider_no_show' } : {}), ...(claim.status === 'expired' ? { expired_at: new Date() } : {}) } });
    let ticketId: string | undefined;
    if (claim.status === 'failed') {
      const ticket = await raiseTicket(tx as unknown as PrismaClient, {
        projectId: order.project_id, serviceOrderId: order.id,
        ...(order.project_id ? {} : { responsibleOrganizationId: standaloneOrganizationId(order.service_context) }),
        unitId: order.unit_id ?? undefined, raisedByIdentityId: order.orderer_identity_id,
        raisedByRole: order.orderer_role, categoryKey: 'complaint',
        title: `Provider no-show: ${order.service?.title || 'Service'}`,
        description: claim.reason || `Order ${order.id}: the provider did not arrive for the scheduled service.`, priority: 'high',
      });
      ticketId = ticket.id;
    }
    return { order, target, ticketId };
  });
}

/**
 * Create a new service order (placed status).
 * Validates service availability and computes take-rate snapshot.
 */

export class ServiceOrderRequestConflict extends Error {
  statusCode = 409;
  isPublic = true;
  constructor() { super('This request was already used for different service details. Review the order before trying again.'); }
}

/** Serialize retries of one customer intent. Canonical totals remain inside the writer. */
export async function createServiceOrder(db: PrismaClient, input: CreateServiceOrderInput): Promise<{ id: string }> {
  if (!input.requestKey) return createServiceOrderOnce(db, input);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.requestKey)) throw new Error('Invalid service request key');
  const fingerprint = createHash('sha256').update(JSON.stringify({
    serviceId: input.serviceId, projectId: input.projectId, unitId: input.unitId ?? null, bookingId: input.bookingId ?? null,
    serviceContext: input.serviceContext ? parseStandaloneContext(input.serviceContext) : null,
    scheduledStart: input.scheduledStart.toISOString(), scheduledEnd: input.scheduledEnd.toISOString(), quantity: input.quantity,
    noteToProvider: input.noteToProvider?.trim() || null, addressNote: input.addressNote?.trim() || null,
  })).digest('hex');
  return db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'service-order:' + input.ordererIdentityId + ':' + input.requestKey}))`;
    const existing = await tx.serviceOrder.findUnique({ where: { orderer_identity_id_request_key: { orderer_identity_id: input.ordererIdentityId, request_key: input.requestKey! } }, select: { id: true, request_fingerprint: true } });
    if (existing) {
      if (existing.request_fingerprint !== fingerprint) throw new ServiceOrderRequestConflict();
      return { id: existing.id };
    }
    return createServiceOrderOnce(tx as unknown as PrismaClient, { ...input, requestFingerprint: fingerprint });
  }, { maxWait: 10000, timeout: 20000 });
}

async function createServiceOrderOnce(
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

  if (!projectId && (unitId || bookingId)) throw new Error('Standalone orders cannot contain a property or booking');
  const standalone = !projectId ? await validateStandaloneServiceContext(db, serviceId, input.serviceContext) : null;
  if (projectId && input.serviceContext) throw new Error('Choose a stay or a standalone address, not both');

  const serviceProjects = await db.serviceProject.findMany({
    where: { service_id: serviceId },
    select: {
      project_id: true, enabled: true, public: true, price_override_thb: true,
      take_rate_pct: true, lead_time_hours: true, terms_version: true,
      effective_from: true, effective_to: true,
    },
  });
  const offer = standalone ? { available: true, publiclyVisible: true, source: 'global' as const, unitPriceThb: service.basePriceThb, leadTimeHours: service.advanceNoticeHours, takeRatePct: null, termsVersion: standalone.offer.termsVersion } : resolveProjectServiceOffer({
    rows: serviceProjects,
    projectId: projectId ?? '',
    basePriceThb: service.basePriceThb,
    baseLeadTimeHours: service.advanceNoticeHours,
    at: scheduledStart,
  });
  const internalOrderRole = ['staff_ops', 'onsite_host', 'mc_member'].includes(ordererRole);
  if (!offer.available || (!offer.publiclyVisible && !internalOrderRole)) {
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

  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
    throw new Error('Order quantity must be an integer between 1 and 20');
  }
  if (!Number.isFinite(scheduledStart.getTime()) || !Number.isFinite(scheduledEnd.getTime()) || scheduledEnd <= scheduledStart) {
    throw new Error('Service schedule is invalid');
  }
  const unitPriceThb = offer.unitPriceThb;
  if (service.priceModel === 'quote' || !unitPriceThb || unitPriceThb <= 0) {
    throw new Error('Service requires a quote and cannot be ordered at a fixed price');
  }

  const noticeDeadline = Date.now() + offer.leadTimeHours * 60 * 60 * 1000;
  if (offer.leadTimeHours > 0 && scheduledStart.getTime() < noticeDeadline) {
    throw new Error(`Service requires ${offer.leadTimeHours}h advance notice`);
  }

  // The domain owns the commercial snapshot. Project-specific price/take-rate
  // terms are resolved here, so public cards, checkout and the immutable order
  // snapshot all use the same money source.
  const totalThb = unitPriceThb * quantity;
  const configuredTakeRate =
    ((await getConfig(db, 'services.take_rate_pct', { projectId: projectId ?? undefined })) as number | undefined) ?? 15;
  const tookRatePctSnapshot = standalone?.offer.takeRatePct ?? offer.takeRatePct ?? configuredTakeRate;
  if (!Number.isFinite(tookRatePctSnapshot) || tookRatePctSnapshot < 0 || tookRatePctSnapshot > 100) {
    throw new Error('Configured service take rate is invalid');
  }
  const priceBreakdown = {
    price_model: service.priceModel,
    unit_price_thb: unitPriceThb,
    quantity,
    total_thb: totalThb,
    offer_source: offer.source,
    terms_version: offer.termsVersion,
    lead_time_hours: offer.leadTimeHours,
  };

  const cancellationWindowHours = standalone ? Number(await getConfig(db, 'service.cancel_window_hours', { fresh: true }) ?? 24) : undefined;
  if (standalone && (!Number.isFinite(cancellationWindowHours) || cancellationWindowHours! < 0)) throw new Error('Configured cancellation window is invalid');
  const standaloneContext = standalone ? { ...standalone.context, responsibleOrganizationId: standalone.offer.responsibleOrganizationId } : undefined;
  const termsSnapshot = standalone ? { version: standalone.offer.termsVersion, responsibleOrganizationId: standalone.offer.responsibleOrganizationId, responsibleOrganizationName: standalone.offer.responsibleOrganizationName ?? '', providerId: service.provider_id, collector: 'myuno', fulfilmentMode: service.fulfilmentMode, unitPriceThb, totalThb, takeRatePct: tookRatePctSnapshot, cancellationWindowHours: cancellationWindowHours!, acceptedAt: new Date().toISOString() } : undefined;

  // Create order in placed status
  const order = await db.serviceOrder.create({
    data: {
      service_id: serviceId,
      ...(input.requestKey ? { request_key: input.requestKey, request_fingerprint: input.requestFingerprint } : {}),
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
      address_note: standalone?.context.address ?? addressNote,
      ...(standaloneContext ? { service_context: standaloneContext, terms_snapshot: termsSnapshot } : {}),
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
    projectId: projectId ?? undefined,
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
export async function acceptServiceOrder(db: PrismaClient, serviceOrderId: string, acceptedByProviderId: string): Promise<void> {
  await db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${serviceOrderId}))`;
    await tx.$queryRaw`SELECT id FROM service_order WHERE id = ${serviceOrderId} FOR UPDATE`;
    await acceptServiceOrderOnce(tx as unknown as PrismaClient, serviceOrderId, acceptedByProviderId);
  });
}
async function acceptServiceOrderOnce(db: PrismaClient, serviceOrderId: string, acceptedByProviderId: string): Promise<void> {
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

  if (order.status !== 'paid') {
    throw new Error(`Cannot accept order in ${order.status} status; payment is required first`);
  }

  await db.serviceOrder.update({
    where: { id: serviceOrderId },
    data: { status: 'accepted' },
  });

  // Track analytics event
  await track(db, 'service_order_accepted', {
    serviceOrderId: order.id,
    serviceId: order.service_id,
    projectId: order.project_id ?? undefined,
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
  const { order, target } = await claimTerminalOrder(db, serviceOrderId, { status: 'declined', providerId: declinedByProviderId });
  const { issuedRefundThb } = await issueServiceOrderRefunds({
    db,
    serviceOrderId: order.id,
    initiatedByIdentityId: order.orderer_identity_id,
    reason: 'provider_no_show',
    targetRefundThb: target,
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
    projectId: order.project_id ?? undefined,
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
export async function fulfillServiceOrder(db: PrismaClient, serviceOrderId: string, fulfilledByProviderId: string): Promise<void> {
  await db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${serviceOrderId}))`;
    await tx.$queryRaw`SELECT id FROM service_order WHERE id = ${serviceOrderId} FOR UPDATE`;
    await fulfillServiceOrderOnce(tx as unknown as PrismaClient, serviceOrderId, fulfilledByProviderId);
  });
}

async function fulfillServiceOrderOnce(
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
  const paidTotal = await db.payment.aggregate({
    where: { serviceOrderId, status: 'succeeded' },
    _sum: { amountThb: true },
  });
  if ((paidTotal._sum.amountThb ?? 0) < order.total_thb) {
    throw new Error('Cannot fulfill an unpaid or underpaid service order');
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
    projectId: order.project_id ?? undefined,
    unitId: order.unit_id ?? undefined,
    identityId: order.orderer_identity_id,
    totalThb: order.total_thb,
  });
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
  const { order, target, ticketId } = await claimTerminalOrder(db, serviceOrderId, { status: 'failed', actorIdentityId: reportedByIdentityId, reason: note?.trim() });
  const { issuedRefundThb } = await issueServiceOrderRefunds({
    db,
    serviceOrderId: order.id,
    initiatedByIdentityId: reportedByIdentityId,
    reason: 'provider_no_show',
    targetRefundThb: target,
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
    projectId: order.project_id ?? undefined,
    unitId: order.unit_id ?? undefined,
    identityId: order.orderer_identity_id,
    totalThb: order.total_thb,
    refundThb: issuedRefundThb,
  });

  return { ticketId: ticketId!, refundThb: issuedRefundThb };
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
  const { order, target } = await claimTerminalOrder(db, serviceOrderId, { status: 'cancelled', actorIdentityId: cancelledByIdentityId, reason });
  const now = new Date();
  const { issuedRefundThb } = await issueServiceOrderRefunds({
    db,
    serviceOrderId: order.id,
    initiatedByIdentityId: cancelledByIdentityId,
    reason: 'cancellation',
    targetRefundThb: target,
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
    projectId: order.project_id ?? undefined,
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

  if (order.status !== 'fulfilled') {
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

  let expired = 0;
  for (const order of expiredOrders) {
    let target: number;
    try { ({ target } = await claimTerminalOrder(db, order.id, { status: 'expired', cutoff: cutoffTime })); expired++; }
    catch (error) { if (error instanceof Error && error.message.startsWith('Cannot ')) continue; throw error; }

    const { issuedRefundThb } = await issueServiceOrderRefunds({
      db,
      serviceOrderId: order.id,
      initiatedByIdentityId: order.orderer_identity_id,
      reason: 'provider_no_show',
      targetRefundThb: target,
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

  const pending = await db.$queryRaw<Array<{ id: string; status: string; orderer_identity_id: string; cancelled_by_identity_id: string | null; refund_accrued_thb: number }>>`
    SELECT o.id, o.status, o.orderer_identity_id, o.cancelled_by_identity_id, o.refund_accrued_thb
    FROM service_order o
    LEFT JOIN payment p ON p.service_order_id = o.id AND p.status = 'succeeded' AND p.purpose = 'service_order'
    LEFT JOIN refund r ON r.payment_id = p.id AND r.status IN ('requested', 'processing', 'succeeded')
    WHERE o.status IN ('cancelled', 'failed', 'declined', 'expired') AND o.refund_accrued_thb > 0
      AND NOT EXISTS (SELECT 1 FROM refund failed_refund JOIN payment failed_payment ON failed_payment.id = failed_refund.payment_id WHERE failed_payment.service_order_id = o.id AND failed_refund.status = 'failed')
    GROUP BY o.id
    HAVING COALESCE(SUM(r.amount_thb), 0) < o.refund_accrued_thb OR BOOL_OR(r.method = 'card_provider' AND r.status = 'requested')
    ORDER BY o.updated_at ASC LIMIT 100`;

  for (const order of pending) await issueServiceOrderRefunds({ db, serviceOrderId: order.id, initiatedByIdentityId: order.cancelled_by_identity_id ?? order.orderer_identity_id, reason: order.status === 'cancelled' ? 'cancellation' : 'provider_no_show', targetRefundThb: order.refund_accrued_thb });

  return {
    expired,
    refunded,
  };
}
