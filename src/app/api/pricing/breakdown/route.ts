import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { computePriceBreakdown } from '@/modules/core';
import {
  findAvailableUnitsForInventoryCategory,
  resolveInventoryCategory,
} from '@/modules/booking';
import { handleError, createPublicError } from '@/app/libs/errorHandler';
import { checkRateLimit } from '@/app/libs/rateLimit';

/**
 * POST /api/pricing/breakdown
 * Quote through the same canonical pricing function used by booking creation.
 * `unitId` is concrete inventory; `categoryId` is canonical category inventory.
 * `categoryKey` is accepted only as a compatibility slug when projectId is supplied.
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
    const {
      unitId: requestedUnitId,
      categoryId,
      categoryKey,
      projectId,
      startDate: startDateStr,
      endDate: endDateStr,
      guestCount = 1,
    } = body;

    if ((!requestedUnitId && !categoryId && !categoryKey) || !startDateStr || !endDateStr) {
      throw createPublicError(
        'invalid request: unitId or categoryId, startDate, and endDate are required',
        400
      );
    }

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || startDate >= endDate) {
      throw createPublicError('invalid request: startDate must be before endDate', 400);
    }

    let unitId = requestedUnitId as string | undefined;
    let canonicalCategoryId: string | null = null;

    if (!unitId) {
      const category = await resolveInventoryCategory(prisma, {
        projectId,
        categoryId,
        categoryKey,
      });
      if (!category) throw createPublicError('inventory category not found', 404);
      canonicalCategoryId = category.id;
      const candidates = await findAvailableUnitsForInventoryCategory(
        prisma,
        category.id,
        startDate,
        endDate
      );
      if (!candidates.length) throw createPublicError('inventory unavailable', 409);
      unitId = candidates[0].id;
    }

    const engine = await computePriceBreakdown(
      prisma,
      unitId,
      startDate,
      endDate,
      Number(guestCount) || 1
    );

    const nights = engine.lines.length;
    const toBaht = (satang: number) => Math.round(satang / 100);
    return NextResponse.json(
      {
        unitId,
        categoryId: canonicalCategoryId,
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
    if (error instanceof Error && !(error as { statusCode?: number }).statusCode) {
      const msg = error.message;
      if (
        msg.includes('minimum') ||
        msg.includes('exceeds') ||
        msg.includes('not found') ||
        msg.includes('unavailable')
      ) {
        return NextResponse.json({ error: msg }, { status: 400 });
      }
    }
    return handleError(error);
  }
}
