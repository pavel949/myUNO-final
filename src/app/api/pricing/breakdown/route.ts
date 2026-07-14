import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface PriceBreakdown {
  nights: number;
  nightlyRate: number;
  subtotal: number;
  lengthOfStayDiscount: number;
  cleaningFee: number;
  subtotalAfterFees: number;
  serviceFee: number;
  total: number;
}

/**
 * POST /api/pricing/breakdown
 * Compute price breakdown for a booking.
 * Request body:
 * - unitId: string
 * - startDate: ISO date string
 * - endDate: ISO date string
 * - guestCount: number
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { unitId, startDate: startDateStr, endDate: endDateStr } = body;

    if (!unitId || !startDateStr || !endDateStr) {
      return NextResponse.json(
        { error: 'unitId, startDate, and endDate are required' },
        { status: 400 }
      );
    }

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);

    if (startDate >= endDate) {
      return NextResponse.json(
        { error: 'startDate must be before endDate' },
        { status: 400 }
      );
    }

    // Fetch unit with pricing rules
    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      include: {
        project: {
          select: { id: true },
        },
        pricingRules: {
          where: {
            startDate: { lt: endDate },
            endDate: { gt: startDate },
          },
        },
      },
    });

    if (!unit) {
      return NextResponse.json(
        { error: 'Unit not found' },
        { status: 404 }
      );
    }

    // Calculate number of nights
    const nights = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (nights < 1) {
      return NextResponse.json(
        { error: 'Stay must be at least 1 night' },
        { status: 400 }
      );
    }

    // Calculate nightly rate based on pricing rules
    // For simplicity, use base rate for now (pricing rules would require date-by-date calculation)
    const nightlyRate = unit.baseNightlyThb || 0;
    const subtotal = nights * nightlyRate;

    // Calculate length-of-stay discount
    let lengthOfStayDiscount = 0;
    if (nights >= 28) {
      lengthOfStayDiscount = Math.round(
        subtotal * 0.2
      ); // 20% discount for monthly
    } else if (nights >= 7) {
      lengthOfStayDiscount = Math.round(
        subtotal * 0.05
      ); // 5% discount for weekly
    }

    const cleaningFee = (unit as any).cleaning_cost || 0;
    const subtotalAfterFees = subtotal - lengthOfStayDiscount + cleaningFee;

    // Service fee (0 for now, configurable)
    const serviceFee = 0;

    const total = subtotalAfterFees + serviceFee;

    const breakdown: PriceBreakdown = {
      nights,
      nightlyRate,
      subtotal,
      lengthOfStayDiscount,
      cleaningFee,
      subtotalAfterFees,
      serviceFee,
      total,
    };

    return NextResponse.json(breakdown, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
