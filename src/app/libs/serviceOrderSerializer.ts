/**
 * Client-facing service-order shape: camelCase, and never the internal
 * take-rate snapshot (a commercial term — audit backlog). Shared by the
 * service-order list/detail routes.
 */
export interface SerializedServiceOrder {
  id: string;
  status: string;
  scheduledStart: Date;
  scheduledEnd: Date | null;
  quantity: number;
  totalThb: number;
  refundAccruedThb: number;
  createdAt: Date;
  serviceTitle: string | null;
}

export function serializeOrder(order: {
  id: string;
  status: string;
  scheduled_start: Date;
  scheduled_end: Date | null;
  quantity: number;
  total_thb: number;
  refund_accrued_thb: number | null;
  createdAt: Date;
  service?: { title: string } | null;
}): SerializedServiceOrder {
  return {
    id: order.id,
    status: order.status,
    scheduledStart: order.scheduled_start,
    scheduledEnd: order.scheduled_end,
    quantity: order.quantity,
    totalThb: order.total_thb,
    refundAccruedThb: order.refund_accrued_thb ?? 0,
    createdAt: order.createdAt,
    serviceTitle: order.service?.title ?? null,
  };
}
