import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUnitPricing } from '@/app/libs/pricingGuard';
import { quoteSeasonalTariffGrid, previewAnnualLeaseTariff, annualLeaseMinimumNights, type TariffMode } from '@/modules/core/seasonal-tariff';
import { computeCanonicalPriceBreakdown } from '@/modules/core/canonical-pricing.service';
import { resolveSourceBookingTerms } from '@/modules/core/commercial-booking-terms';

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const calendarDate = (value: unknown): Date | null => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
};

/** Saved-price preview. Active stays use the exact booking calculator, including
 * fees and policy checks. Draft grids expose only an explicitly partial tariff
 * subtotal. Neither path checks availability, holds dates or authorizes booking. */
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const guard = await requireUnitPricing(params.id);
  if (!guard.ok) return guard.error;
  const body = await req.json().catch(() => null);
  if (!body || !['stay', 'daily', 'monthly', 'yearly'].includes(body.mode))
    return NextResponse.json({ error: 'Choose a stay or yearly lease preview' }, { status: 400 });
  const guests = body.guests ?? 1;
  if (!Number.isSafeInteger(guests) || guests < 1)
    return NextResponse.json({ error: 'Guest count must be a positive integer' }, { status: 400 });
  const checkIn = calendarDate(body.checkIn), checkOut = calendarDate(body.checkOut);
  if (body.mode !== 'yearly' && (!checkIn || !checkOut || checkOut <= checkIn))
    return NextResponse.json({ error: 'Valid arrival and departure dates required' }, { status: 400 });
  const nights = checkIn && checkOut ? (checkOut.getTime() - checkIn.getTime()) / 86_400_000 : 0;
  const mode: TariffMode = nights >= 30 ? 'monthly' : 'daily';
  if ((body.mode === 'daily' || body.mode === 'monthly') && body.mode !== mode)
    return NextResponse.json({ error: 'The stay length determines the nightly or monthly tariff' }, { status: 422 });
  const offers = await prisma.commercialOffering.findMany({
    where: { unitId: params.id, offeringType: { in: ['short_term_stay', 'short_stay', 'long_term_rental'] } },
    select: { id: true, status: true, offeringType: true, pricingTerms: true, rulesAndPolicies: true },
  });
  const offer = offers.find(o => o.offeringType ===
    (body.mode === 'yearly' || mode === 'monthly' ? 'long_term_rental' : 'short_term_stay'));
  try {
    if (body.mode === 'yearly') {
      const lease = previewAnnualLeaseTariff(record(offer?.pricingTerms).tariffGrid);
      return NextResponse.json({ ...lease, mode: 'yearly', pricingScope: 'lease_illustration',
        status: offer?.status, bookable: false, availabilityChecked: false });
    }
    const activeStay = offers.some(o => ['short_term_stay', 'short_stay'].includes(o.offeringType) && o.status === 'active');
    if (activeStay) {
      // Also supports the ordinary InventoryCategory/BAR/PricingRule path.
      // Never substitute an ad-hoc tariff calculation for a failed live quote.
      const quote = await computeCanonicalPriceBreakdown(prisma, params.id, checkIn!, checkOut!, guests);
      const quotedMode = quote.lines.some(line => line.applied_from === 'category_monthly') ? 'monthly' : 'daily';
      return NextResponse.json({ mode: quotedMode, pricingScope: 'canonical_quote',
        subtotalSatang: quote.subtotal_thb, totalSatang: quote.total_thb,
        cleaningFeeSatang: quote.cleaning_fee_thb, serviceFeeSatang: quote.service_fee_thb,
        taxSatang: quote.occupancy_tax_thb, discountSatang: quote.los_discount_thb + quote.early_bird_discount_thb,
        lines: quote.lines.map(line => ({ date: line.date, nightlySatang: line.nightly_thb })),
        bookingTerms: quote.commercialTerms ?? null, bookable: false, availabilityChecked: false });
    }
    if (!offer) return NextResponse.json({ error: 'Tariff offering missing' }, { status: 404 });
    const terms = record(offer.pricingTerms);
    const grid = terms.tariffGrid;
    const leaseMinimum = mode === 'monthly' ? annualLeaseMinimumNights(grid) : null;
    if (leaseMinimum !== null && nights >= leaseMinimum)
      throw new Error('This stay requires a yearly lease request');
    const result = quoteSeasonalTariffGrid(grid, body.checkIn, body.checkOut, mode);
    const arrival = (grid as Array<Record<string, unknown>>).find(row => row.sourceRateId === result.lines[0].sourceRateId);
    const rules = record(offer.rulesAndPolicies).bookingPolicies;
    const bookingTerms = terms.sourceSystem === 'layantara_os' && arrival && typeof arrival.seasonCode === 'string'
      ? resolveSourceBookingTerms(rules, mode, arrival.seasonCode) : null;
    if (bookingTerms && nights < bookingTerms.minimumNights)
      throw new Error('Stay length below booking-policy minimum of ' + bookingTerms.minimumNights);
    return NextResponse.json({ ...result, pricingScope: 'tariff_subtotal', status: offer.status,
      bookingTerms, bookable: false, availabilityChecked: false });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Tariff preview unavailable',
      bookable: false, availabilityChecked: false }, { status: 422 });
  }
}
