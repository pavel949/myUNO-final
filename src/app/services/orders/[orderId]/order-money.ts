/**
 * Money display helpers for the service-order detail page (F-SVC-4).
 * Every money field on the order (totalThb, refundAccruedThb,
 * payments[].amountThb, priceBreakdown's *_thb entries) is satang
 * (THB × 100) straight from the DB — the detail API
 * (src/app/api/service-orders/[id]/detail/route.ts) is a straight
 * passthrough. Convert to baht only here, at final render
 * (CLAUDE.md "Money rules").
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
 * Whether the order's payment badge should read "paid".
 *
 * A card order carries a `completed` payment row. A cash-on-fulfilment order
 * never does — the money changes hands at the door — so delivery itself is
 * what marks it paid. That is why the status matters here at all.
 *
 * Both delivered statuses count. `fulfilled` alone flipped a cash order's
 * badge from paid to **unpaid** the moment it closed, which is when the
 * orderer confirmed the work or the sweep finished it — telling a customer
 * their settled order is unpaid at exactly the point it completed. Statuses
 * that never delivered (`cancelled`, `declined`, `expired`, `failed`) are
 * not paid by delivery and stay dependent on an actual payment row.
 */
const DELIVERED_STATUSES = new Set(['fulfilled', 'closed']);

export function isOrderPaid(
  status: string,
  payments: Array<{ status: string }>
): boolean {
  return (
    payments.some((p) => p.status === 'completed') || DELIVERED_STATUSES.has(status)
  );
}
