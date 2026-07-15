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

    // Shape consumed by the booking widget; keep engine fields alongside
    return NextResponse.json(
      {
        nights,
        nightlyRate: nights > 0 ? Math.round(engine.subtotal_thb / nights) : 0,
        subtotal: engine.subtotal_thb,
        lengthOfStayDiscount: engine.los_discount_thb,
        cleaningFee: engine.cleaning_fee_thb,
        serviceFee: engine.service_fee_thb,
        occupancyTax: engine.occupancy_tax_thb,
        subtotalAfterFees:
          engine.subtotal_thb - engine.los_discount_thb + engine.cleaning_fee_thb,
        total: engine.total_thb,
        lines: engine.lines,
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
