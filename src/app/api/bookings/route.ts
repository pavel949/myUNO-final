import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { createBooking } from '@/modules/booking';
import { createCheckout } from '@/modules/finance';

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
 * - totalThb: number (server will validate this)
 * - instantBook: boolean
 * - guestNote?: string
 * - paymentMethod?: 'cash' | 'card_provider'
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const {
      unitId,
      projectId,
      startDate: startDateStr,
      endDate: endDateStr,
      adultsCount,
      childrenCount,
      totalThb,
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
      totalThb === undefined ||
      instantBook === undefined
    ) {
      return NextResponse.json(
        { error: 'Missing required fields' },
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

    // Create booking via booking service
    const booking = await createBooking(prisma, {
      unitId,
      projectId,
      guestIdentityId: user.identityId,
      bookingType: 'guest_stay',
      channel: 'direct',
      startDate,
      endDate,
      adults: adultsCount,
      children: childrenCount,
      totalThb,
      instantBook,
      guestNote,
      priceBreakdown: {
        total: totalThb,
      },
    });

    // If instant book and card payment method, create checkout session
    if (instantBook && paymentMethod === 'card_provider') {
      const checkout = await createCheckout(prisma, {
        purpose: 'stay',
        bookingId: booking.id,
        payerIdentityId: user.identityId,
        amountThb: totalThb,
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
    if (!instantBook) {
      return NextResponse.json(
        {
          booking,
          message: 'Request to book created. Awaiting host approval.',
        },
        { status: 201 }
      );
    }

    return NextResponse.json(
      { booking },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Booking creation error:', message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
