import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { computePriceBreakdown } from '@/modules/core';
import { findAvailableUnitsForCategory } from '@/modules/booking';
import {
  createCategoryStayQuoteToken,
} from '@/modules/booking/category-quote';
import { handleError, createPublicError } from '@/app/libs/errorHandler';
import { checkRateLimit } from '@/app/libs/rateLimit';

export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'unknown';
    const limit = checkRateLimit(`category-quote:ip:${ip}`, {
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
      inventoryCategoryId,
      startDate: startDateStr,
      endDate: endDateStr,
      adultsCount = 1,
      childrenCount = 0,
      petsCount = 0,
    } = body;

    if (!inventoryCategoryId || !startDateStr || !endDateStr) {
      throw createPublicError(
        'invalid request: inventoryCategoryId, startDate, and endDate are required',
        400
      );
    }

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    const adults = Number(adultsCount);
    const children = Number(childrenCount);
    const pets = Number(petsCount);
    const guestCount = adults + children;

    if (
      isNaN(startDate.getTime()) ||
      isNaN(endDate.getTime()) ||
      startDate >= endDate ||
      !Number.isInteger(adults) ||
      !Number.isInteger(children) ||
      !Number.isInteger(pets) ||
      adults < 1 ||
      children < 0 ||
      pets < 0
    ) {
      throw createPublicError('invalid request: dates or party composition are invalid', 400);
    }

    const category = await prisma.inventoryCategory.findUnique({
      where: { id: inventoryCategoryId },
      select: {
        id: true,
        projectId: true,
        categoryKey: true,
        name: true,
        status: true,
      },
    });
    if (!category || category.status !== 'live') {
      throw createPublicError('inventory category not found', 404);
    }

    const candidates = await findAvailableUnitsForCategory(
      prisma,
      category.projectId,
      category.categoryKey,
      startDate,
      endDate
    );
    if (candidates.length === 0) {
      throw createPublicError('no home in this category is available for these dates', 409);
    }

    let selected:
      | {
          unitId: string;
          instantBook: boolean;
          breakdown: Awaited<ReturnType<typeof computePriceBreakdown>>;
        }
      | undefined;

    for (const candidate of candidates) {
      try {
        const breakdown = await computePriceBreakdown(
          prisma,
          candidate.id,
          startDate,
          endDate,
          guestCount,
          undefined,
          pets
        );
        selected = {
          unitId: candidate.id,
          instantBook: candidate.instantBook,
          breakdown,
        };
        break;
      } catch {
        // One physical unit can have a stricter occupancy/rate rule than its
        // siblings. A category quote uses the first actually bookable unit in
        // the same stable order as allocation rather than failing the category.
      }
    }

    if (!selected) {
      throw createPublicError('no home in this category can accept this stay', 409);
    }

    const acceptedTotalSatang = selected.breakdown.total_thb;
    const { token, expiresAtMs } = createCategoryStayQuoteToken({
      inventoryCategoryId: category.id,
      projectId: category.projectId,
      startDate: startDateStr,
      endDate: endDateStr,
      adultsCount: adults,
      childrenCount: children,
      petsCount: pets,
      acceptedTotalSatang,
      quotedUnitId: selected.unitId,
    });

    const toBaht = (satang: number) => satang / 100;
    const engine = selected.breakdown;
    const nights = engine.lines.length;

    return NextResponse.json(
      {
        inventoryCategoryId: category.id,
        projectId: category.projectId,
        categoryName: category.name,
        quoteToken: token,
        expiresAt: new Date(expiresAtMs).toISOString(),
        acceptedTotalSatang,
        instantBook: selected.instantBook,
        breakdown: {
          nights,
          subtotal: toBaht(engine.subtotal_thb),
          lengthOfStayDiscount: toBaht(engine.los_discount_thb),
          earlyBirdDiscount: toBaht(engine.early_bird_discount_thb),
          cleaningFee: toBaht(engine.cleaning_fee_thb),
          serviceFee: toBaht(engine.service_fee_thb),
          occupancyTax: toBaht(engine.occupancy_tax_thb),
          total: toBaht(engine.total_thb),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    return handleError(error);
  }
}
