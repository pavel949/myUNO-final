import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/app/libs/onboardingGuard';
import { quoteSeasonalTariffGrid, type TariffMode } from '@/modules/core/seasonal-tariff';
import { toCalendarDay } from '@/lib/date';

/**
 * Admin-only pricing preview for a DRAFT commercial offering.
 * Shares the pure calculator used by the live canonical pricing service.
 * It does not modify status, authorize source cutover, hold dates or charge.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;
  let body: { checkIn?: string; checkOut?: string; mode?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (body.mode !== 'daily' && body.mode !== 'monthly')
    return NextResponse.json({ error: 'Choose daily or monthly tariff' }, { status: 400 });
  if (typeof body.checkIn !== 'string' || typeof body.checkOut !== 'string')
    return NextResponse.json({ error: 'Stay dates required' }, { status: 400 });
  const mode = body.mode as TariffMode;
  const type = mode === 'daily' ? 'short_term_stay' : 'long_term_rental';
  const offer = await prisma.commercialOffering.findFirst({
    where: { unitId: params.id, offeringType: type },
    select: { id: true, unitId: true, status: true, pricingTerms: true },
  });
  if (!offer) return NextResponse.json({ error: 'Tariff offering missing' }, { status: 404 });
  const terms = offer.pricingTerms;
  const grid = typeof terms === 'object' && terms && !Array.isArray(terms)
    ? (terms as Record<string, unknown>).tariffGrid : null;
  try {
    const result = quoteSeasonalTariffGrid(grid, body.checkIn, body.checkOut, mode);
    return NextResponse.json({
      offeringId: offer.id, unitId: offer.unitId, status: offer.status,
      source: 'canonical_commercial_offering', bookable: offer.status === 'active',
      ...result, checkIn: toCalendarDay(new Date(body.checkIn)),
      checkOut: toCalendarDay(new Date(body.checkOut)),
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Tariff preview unavailable',
      bookable: false,
    }, { status: 422 });
  }
}
