import { UI_LOCALE } from '@/lib/format';
/**
 * Format a service's base price for display on the service detail page
 * (F-SVC-1). `basePriceThb` is satang (THB × 100) straight from the DB via
 * services.getPublicMarketplaceServiceDetail — convert to baht only here, at final render
 * (CLAUDE.md "Money rules"). Pure/display-only: does not touch the value
 * passed to OrderWizard for order-total math.
 */
export function formatServicePriceLabel(
  priceModel: string,
  basePriceThb: number
): string {
  const baht = (basePriceThb / 100).toLocaleString(UI_LOCALE);
  return priceModel === 'fixed' ? `฿${baht}` : `from ฿${baht}`;
}
