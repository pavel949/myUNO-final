/**
 * Money display helpers for the service-order detail page (F-SVC-4).
 * Every money field on the order (totalThb, refundAccruedThb,
 * payments[].amountThb, priceBreakdown's *_thb entries) is satang
 * (THB × 100) straight from the DB — the detail API
 * (src/app/api/service-orders/[id]/detail/route.ts) is a straight
 * passthrough. Convert to baht only here, at final render.
 */
export function baht(satang: number): string {
  return (satang / 100).toLocaleString();
}

/**
 * Format one entry of the order's `priceBreakdown` map. Only `*_thb` keys
 * are money (satang); `quantity` and similar keys are plain counts and must
 * not be divided.
 */
export function formatBreakdownValue(key: string, value: unknown): string {
  const isMoney = key.endsWith('_thb');
  return isMoney ? `฿${baht(Number(value))}` : String(Number(value));
}

/**
 * Whether the customer-facing payment badge should read "paid".
 *
 * Card orders carry a completed payment row. Cash-on-fulfilment orders do not,
 * so a delivered order is considered paid by delivery. Both `fulfilled` and
 * terminal `closed` therefore count as delivered; closing an order must not
 * make a settled cash order appear unpaid again.
 */
const DELIVERED_STATUSES = new Set(['fulfilled', 'closed']);

export function isOrderPaid(
  status: string,
  payments: Array<{ status: string }>
): boolean {
  return payments.some((p) => p.status === 'completed') || DELIVERED_STATUSES.has(status);
}
