import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import {
  createBooking,
  resolveCancellationPolicy,
  resolveUnitForCategory,
} from '@/modules/booking';
import { createCheckout } from '@/modules/finance';
import { computePriceBreakdown } from '@/modules/core';
import { handleError, createPublicError } from '@/app/libs/errorHandler';

/**
 * POST /api/bookings
 * Create a new booking (instant or request-to-book).
 * Requires authentication.
 *
 * Request body:
 * - unitId: string — OR categoryKey (LY-6): book a villa CATEGORY and the
 *   server auto-assigns the first available villa of that category
 *   (hotel-style). With categoryKey, instantBook comes from the assigned
 *   unit and the client value is ignored.
 * - projectId: string
 * - startDate: ISO date string
 * - endDate: ISO date string
 * - adultsCount: number
 * - childrenCount: number
 * - instantBook: boolean (required on the unitId path)
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
      unitId: requestedUnitId,
      categoryKey,
      projectId,
      startDate: startDateStr,
      endDate: endDateStr,
      adultsCount,
      childrenCount,
      instantBook: requestedInstantBook,
      guestNote,
      paymentMethod = 'cash',
    } = body;

    // Validate required fields — either a concrete unit or a category
    if (
      (!requestedUnitId && !categoryKey) ||
      !projectId ||
      !startDateStr ||
      !endDateStr ||
      adultsCount === undefined ||
      childrenCount === undefined ||
      (requestedUnitId && !categoryKey && requestedInstantBook === undefined)
    ) {
      throw createPublicError('invalid request: missing required fields', 400);
    }

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || startDate >= endDate) {
      throw createPublicError('invalid request: startDate must be before endDate', 400);
    }

    // Category-first path (LY-6): the server picks the villa.
    let unitId: string = requestedUnitId;
    let instantBook: boolean = requestedInstantBook;
    if (!requestedUnitId && categoryKey) {
      const assigned = await resolveUnitForCategory(
        prisma,
        projectId,
        categoryKey,
        startDate,
        endDate
      );
      if (!assigned) {
        throw createPublicError(
          'no villa of this category is available for these dates',
          409
        );
      }
      unitId = assigned.id;
      // Booking type is a property of the assigned unit, never a client choice
      instantBook = assigned.instantBook;
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
    // Config is the source of truth (doc 04 §5); an unknown policy key
    // fails the booking instead of silently granting the most generous terms.
    const policy = await resolveCancellationPolicy(prisma, unit.cancellationPolicyKey, {
      projectId,
      unitId,
    });

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
