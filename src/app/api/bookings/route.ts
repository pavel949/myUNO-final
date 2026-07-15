import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { createBooking, DEFAULT_POLICIES } from '@/modules/booking';
import { createCheckout } from '@/modules/finance';
import { computePriceBreakdown } from '@/modules/core';
import { handleError, createPublicError } from '@/app/libs/errorHandler';

/**
 * POST /api/bookings
 * Create a new booking (instant or request-to-book).
 * Requires authentication.
 *
 * Request body:
 * - unitId: string
 * - projectId: string
 * - startDate: ISO date string
 * - endDate: ISO date string
 * - adultsCount: number
 * - childrenCount: number
 * - instantBook: boolean
 * - guestNote?: string
 * - paymentMethod?: 'cash' | 'card_provider'
 *
 * The total is ALWAYS computed server-side from the pricing engine —
 * any client-sent amount is ignored (doc 10: never trust client totals).
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw createPublicError('unauthorized', 401);
    }

    const body = await req.json();
    const {
      unitId,
      projectId,
      startDate: startDateStr,
      endDate: endDateStr,
      adultsCount,
      childrenCount,
      instantBook,
      guestNote,
      paymentMethod = 'cash',
    } = body;

    // Validate required fields
    if (
      !unitId ||
      !projectId ||
      !startDateStr ||
      !endDateStr ||
      adultsCount === undefined ||
      childrenCount === undefined ||
      instantBook === undefined
    ) {
      throw createPublicError('invalid request: missing required fields', 400);
    }

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || startDate >= endDate) {
      throw createPublicError('invalid request: startDate must be before endDate', 400);
    }

    // Server-computed price — the single source of truth for the charge.
    // Also validates party size and min-nights.
    const guestCount = Number(adultsCount) + Number(childrenCount);
    const breakdown = await computePriceBreakdown(
      prisma,
      unitId,
      startDate,
      endDate,
      guestCount
    );

    // Snapshot the unit's cancellation policy at booking time (doc 07 F-GUEST-8)
    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      select: { cancellationPolicyKey: true, status: true },
    });
    if (!unit || unit.status !== 'live') {
      throw createPublicError('not found', 404);
    }
    const policy =
      DEFAULT_POLICIES[unit.cancellationPolicyKey || 'flexible'] || DEFAULT_POLICIES.flexible;

    // Create booking via booking service
    const booking = await createBooking(prisma, {
      unitId,
      projectId,
      guestIdentityId: user.identityId,
      bookingType: 'guest_stay',
      channel: 'direct',
      startDate,
      endDate,
      adults: Number(adultsCount),
      children: Number(childrenCount),
      totalThb: breakdown.total_thb,
      instantBook,
      guestNote,
      priceBreakdown: { ...breakdown },
      cancellationPolicySnapshot: { ...policy },
    });

    // If instant book and card payment method, create checkout session
    if (instantBook && paymentMethod === 'card_provider') {
      const checkout = await createCheckout(prisma, {
        purpose: 'stay',
        bookingId: booking.id,
        payerIdentityId: user.identityId,
        amountThb: breakdown.total_thb,
      });

      return NextResponse.json(
        {
          booking,
          checkout,
        },
        { status: 201 }
      );
    }

    // For cash payment, return the booking (payment recorded later via ops)
    if (instantBook && paymentMethod === 'cash') {
      return NextResponse.json(
        {
          booking,
          message: 'Booking created. Payment to be recorded.',
        },
        { status: 201 }
      );
    }

    // For request-to-book, return the booking
    return NextResponse.json(
      {
        booking,
        message: 'Request to book created. Awaiting host approval.',
      },
      { status: 201 }
    );
  } catch (error) {
    // Domain errors from the pricing/booking engine carry guest-actionable
    // messages (dates unavailable, below min nights, party too large)
    if (error instanceof Error && !(error as { statusCode?: number }).statusCode) {
      const msg = error.message;
      if (
        msg.includes('unavailable') ||
        msg.includes('minimum') ||
        msg.includes('exceeds') ||
        msg.includes('not found')
      ) {
        return NextResponse.json({ error: msg }, { status: 400 });
      }
    }
    return handleError(error);
  }
}
