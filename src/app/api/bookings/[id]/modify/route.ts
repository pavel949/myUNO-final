import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { createCheckout } from '@/modules/finance';

/**
 * POST /api/bookings/[id]/modify
 * Modify a booking's dates and/or party size.
 * Recalculates price, handles balance due (new checkout) or refund (auto-credited).
 * Requires authentication (guest who booked).
 *
 * Request body:
 * - startDate?: ISO date string (optional, keep existing if omitted)
 * - endDate?: ISO date string (optional, keep existing if omitted)
 * - adultsCount?: number (optional)
 * - childrenCount?: number (optional)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const bookingId = params.id;
    const body = await req.json();
    const {
      startDate: newStartDateStr,
      endDate: newEndDateStr,
      adultsCount,
      childrenCount,
    } = body;

    // Fetch the booking (guestIdentityId lives on the row; never pull the raw identity)
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { unit: true },
    });

    if (!booking) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      );
    }

    // Authorization: only guest who booked can modify
    if (booking.guestIdentityId !== user.identityId) {
      return NextResponse.json(
        { error: 'Not authorized to modify this booking' },
        { status: 403 }
      );
    }

    // Check if booking is in a modifiable state (confirmed only)
    if (booking.status !== 'confirmed') {
      return NextResponse.json(
        { error: `Cannot modify booking with status ${booking.status}` },
        { status: 400 }
      );
    }

    // Determine new dates (keep existing if not provided)
    const newStartDate = newStartDateStr ? new Date(newStartDateStr) : booking.startDate;
    const newEndDate = newEndDateStr ? new Date(newEndDateStr) : booking.endDate;

    if (newStartDate >= newEndDate) {
      return NextResponse.json(
        { error: 'startDate must be before endDate' },
        { status: 400 }
      );
    }

    // Validate availability (excluding this booking; expired unpaid holds don't block)
    const conflicting = await prisma.booking.findFirst({
      where: {
        unitId: booking.unitId,
        id: { not: bookingId },
        startDate: { lt: newEndDate },
        endDate: { gt: newStartDate },
        OR: [
          { status: { in: ['confirmed', 'checked_in'] } },
          { status: 'pending_payment', holdExpiresAt: { gt: new Date() } },
        ],
      },
    });

    if (conflicting) {
      return NextResponse.json(
        { error: 'Dates are unavailable due to another booking' },
        { status: 400 }
      );
    }

    // Calculate new price (using the same pricing logic as booking creation)
    // For now, use simple calculation: nights × unit price
    const daysCount = Math.ceil(
      (newEndDate.getTime() - newStartDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    const unit = booking.unit!;
    const basePrice = unit.baseNightlyThb || 0;
    const newTotalThb = daysCount * basePrice;

    // Calculate balance
    const oldTotalThb = booking.totalThb;
    const balanceThb = newTotalThb - oldTotalThb;

    // If balance > 0, guest needs to pay the difference
    let checkoutUrl: string | null = null;
    if (balanceThb > 0) {
      const checkout = await createCheckout(prisma, {
        purpose: 'stay_balance',
        bookingId,
        payerIdentityId: user.identityId,
        amountThb: balanceThb,
      });
      checkoutUrl = checkout?.checkoutUrl || null;
    }

    // Update the booking atomically
    const newAdults = adultsCount ?? booking.adults;
    const newChildren = childrenCount ?? booking.children;

    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        startDate: newStartDate,
        endDate: newEndDate,
        adults: newAdults,
        children: newChildren,
        totalThb: newTotalThb,
        ...(balanceThb < 0 && { refundAccruedThb: (booking.refundAccruedThb || 0) + Math.abs(balanceThb) }),
      },
      include: { unit: true },
    });

    // Create a booking change record for audit
    await prisma.bookingChange.create({
      data: {
        bookingId,
        changeType: 'dates',
        oldValue: {
          startDate: booking.startDate.toISOString(),
          endDate: booking.endDate.toISOString(),
          adults: booking.adults,
          children: booking.children,
          totalThb: oldTotalThb,
        },
        newValue: {
          startDate: newStartDate.toISOString(),
          endDate: newEndDate.toISOString(),
          adults: newAdults,
          children: newChildren,
          totalThb: newTotalThb,
        },
        priceDeltaThb: balanceThb,
        actorIdentityId: user.identityId,
      },
    });

    return NextResponse.json(
      {
        booking: updated,
        pricing: {
          oldTotalThb,
          newTotalThb,
          balanceThb,
          checkoutUrl,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Booking modification error:', message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
