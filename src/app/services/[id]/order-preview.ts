/**
 * Client-side order total PREVIEW (SA-2). Display only — the charged total
 * is always recomputed server-side in POST /api/service-orders (doc 10:
 * client-sent totals are never trusted). Mirrors the server rule:
 * total = basePrice × quantity for priceable models; quote services have no
 * client-computable price at all.
 */
export function computeOrderPreviewThb(
  priceModel: string,
  basePriceThb: number | null,
  quantity: number
): number | null {
  if (priceModel === 'quote' || basePriceThb === null) return null;
  const qty = Math.max(1, Math.floor(quantity));
  return basePriceThb * qty;
}
