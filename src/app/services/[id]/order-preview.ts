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

/**
 * Same preview, converted to baht for display (money rule, CLAUDE.md "Money
 * rules"): `basePriceThb` is satang (THB × 100) straight from the DB, and
 * despite its name computeOrderPreviewThb above returns satang too — this
 * wrapper divides by 100 only for the on-screen total preview. Still
 * display-only: the server always recomputes the real charge from
 * basePriceThb, never this preview.
 */
export function computeOrderPreviewBaht(
  priceModel: string,
  basePriceThb: number | null,
  quantity: number
): number | null {
  const satang = computeOrderPreviewThb(priceModel, basePriceThb, quantity);
  return satang === null ? null : satang / 100;
}
