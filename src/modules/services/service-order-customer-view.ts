import type { PrismaClient } from '@prisma/client';

export type ServiceOrderCustomerViewResult = Awaited<ReturnType<typeof getServiceOrderCustomerView>>;
export type ServiceOrderCustomerView = Extract<ServiceOrderCustomerViewResult, { kind: 'ok' }>['order'];

/**
 * The orderer's view of one service order (F-SVC-4). Shared by the detail API
 * and the order page, so the page reads the database directly instead of
 * fetching its own API — a server-side relative fetch cannot resolve and left
 * the page permanently 404 (audit wiring finding).
 */
export async function getServiceOrderCustomerView(db: PrismaClient, id: string, identityId: string) {
  const order = await db.serviceOrder.findUnique({
    where: { id },
    include: {
      service: {
        select: {
          id: true,
          title: true,
          description: true,
          categoryKey: true,
          priceModel: true,
          basePriceThb: true,
          durationMin: true,
          advanceNoticeHours: true,
        },
      },
      provider: {
        select: {
          id: true,
          name: true,
          description: true,
          contactPhone: true,
          contactEmail: true,
          status: true,
          vetted_at: true,
        },
      },
      project: {
        select: {
          id: true,
          name: true,
        },
      },
      unit: {
        select: {
          id: true,
          name: true,
          addressSupplement: true,
        },
      },
      orderer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
      payments: {
        select: {
          id: true,
          method: true,
          amountThb: true,
          status: true,
          createdAt: true,
          receiptRef: true,
        },
      },
    },
  });

  if (!order) return { kind: 'not_found' as const };

  // Verify orderer is the current user
  if (order.orderer_identity_id !== identityId) return { kind: 'forbidden' as const };

  // Has the orderer already rated it? The rating route refuses a second
  // review, so the surface must not offer one.
  const existingReview = await db.review.findFirst({
    where: {
      target_type: 'service_order',
      target_id: order.id,
      author_identity_id: identityId,
    },
    select: { id: true },
  });

  // Parse price breakdown
  const priceBreakdown = typeof order.price_breakdown === 'string'
    ? JSON.parse(order.price_breakdown)
    : order.price_breakdown;

  const view = {
    id: order.id,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    status: order.status,
    quantity: order.quantity,
    scheduledStart: order.scheduled_start.toISOString(),
    scheduledEnd: order.scheduled_end.toISOString(),
    totalThb: order.total_thb,
    takeRatePctSnapshot: Number(order.take_rate_pct_snapshot),
    priceBreakdown,
    refundAccruedThb: order.refund_accrued_thb,
    noteToProvider: order.note_to_provider,
    addressNote: order.address_note,
    cancelledAt: order.cancelled_at?.toISOString() || null,
    cancellationReason: order.cancellation_reason,
    rated: Boolean(existingReview),
    service: {
      id: order.service.id,
      title: order.service.title,
      description: order.service.description,
      categoryKey: order.service.categoryKey,
      priceModel: order.service.priceModel,
      basePriceThb: order.service.basePriceThb,
    },
    provider: {
      id: order.provider.id,
      name: order.provider.name,
      description: order.provider.description,
      phone: order.provider.contactPhone,
      email: order.provider.contactEmail,
      vetted: Boolean(order.provider.vetted_at),
    },
    project: order.project,
    unit: order.unit,
    orderer: {
      id: order.orderer.id,
      firstName: order.orderer.firstName,
      lastName: order.orderer.lastName,
      email: order.orderer.email,
      phone: order.orderer.phone,
    },
    payments: order.payments.map((p) => ({
      id: p.id,
      type: p.method,
      amountThb: p.amountThb,
      status: p.status,
      createdAt: p.createdAt.toISOString(),
      receiptNumber: p.receiptRef,
    })),
  };
  return { kind: 'ok' as const, order: view };
}
