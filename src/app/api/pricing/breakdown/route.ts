import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { computePriceBreakdown } from '@/modules/core';
import { handleError, createPublicError } from '@/app/libs/errorHandler';
import { checkRateLimit } from '@/app/libs/rateLimit';

/**
 * POST /api/pricing/breakdown
 * Quote a stay using the SAME pricing engine the booking endpoint charges
 * with (per-night rules/seasons, LOS discounts, cleaning fee, service fee,
 * occupancy tax — all from config). Quoted price === charged price.
 *
 * Request body:
 * - unitId: string
 * - startDate: ISO date string
 * - endDate: ISO date string
 * - guestCount?: number (defaults to 1)
 */
export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'unknown';
    const limit = checkRateLimit(`pricing:ip:${ip}`, {
      maxAttempts: 60,
      windowMs: 60 * 1000,
      backoffMs: 30 * 1000,
    });
    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { unitId, startDate: startDateStr, endDate: endDateStr, guestCount = 1 } = body;

    if (!unitId || !startDateStr || !endDateStr) {
      throw createPublicError('invalid request: unitId, startDate, and endDate are required', 400);
    }

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || startDate >= endDate) {
      throw createPublicError('invalid request: startDate must be before endDate', 400);
    }

    const engine = await computePriceBreakdown(
      prisma,
      unitId,
      startDate,
      endDate,
      Number(guestCount) || 1
    );

    const nights = engine.lines.length;

    // Display boundary: the engine computes every *_thb figure in satang
    // (THB x 100) — the same domain unit the booking endpoint charges with.
    // This response quotes the guest for the booking widget only (nothing
    // here is ever sent back to a payment/booking endpoint — the widget
    // resubmits just dates/guest counts and the server recomputes the total
    // in satang independently), so it's safe to convert every money field
    // to baht here, at the response boundary.
    const toBaht = (satang: number) => Math.round(satang / 100);
    return NextResponse.json(
      {
        nights,
        nightlyRate: nights > 0 ? toBaht(Math.round(engine.subtotal_thb / nights)) : 0,
        subtotal: toBaht(engine.subtotal_thb),
        lengthOfStayDiscount: toBaht(engine.los_discount_thb),
        earlyBirdDiscount: toBaht(engine.early_bird_discount_thb),
        cleaningFee: toBaht(engine.cleaning_fee_thb),
        serviceFee: toBaht(engine.service_fee_thb),
        occupancyTax: toBaht(engine.occupancy_tax_thb),
        subtotalAfterFees: toBaht(
          engine.subtotal_thb - engine.los_discount_thb + engine.cleaning_fee_thb
        ),
        total: toBaht(engine.total_thb),
        lines: engine.lines.map((line) => ({ ...line, nightly_thb: toBaht(line.nightly_thb) })),
      },
      { status: 200 }
    );
  } catch (error) {
    // Guest-actionable validation errors from the engine
    if (error instanceof Error && !(error as { statusCode?: number }).statusCode) {
      const msg = error.message;
      if (msg.includes('minimum') || msg.includes('exceeds') || msg.includes('not found')) {
        return NextResponse.json({ error: msg }, { status: 400 });
      }
    }
    return handleError(error);
  }
}
