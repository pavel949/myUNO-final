import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { createCheckout } from '@/modules/finance';
import { changeBookingDates } from '@/modules/booking';
import { track } from '@/modules/analytics';

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

    // A checked-in stay may only move its departure. Use the same canonical
    // repricing seam as every other date change so added nights respect
    // InventoryCategory, RatePlan, PricingRule, LOS discounts and taxes. The
    // price delta, not nights × Unit.baseNightlyThb, is what becomes due.
    if (booking.status === 'checked_in') {
      if (!newEndDateStr) {
        return NextResponse.json(
          { error: 'An extension needs a new end date' },
          { status: 400 }
        );
      }

      const newEndDate = new Date(newEndDateStr);
      if (Number.isNaN(newEndDate.getTime()) || newEndDate <= booking.endDate) {
        return NextResponse.json(
          { error: 'New end date must be after current end date' },
          { status: 400 }
        );
      }

      const result = await changeBookingDates(prisma, {
        bookingId,
        startDate: booking.startDate,
        endDate: newEndDate,
        actorIdentityId: user.identityId,
      });

      const additionalNights = Math.ceil(
        (result.endDate.getTime() - result.previousEndDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      const priceDeltaThb = result.totalThb - result.previousTotalThb;
      const addedThb = Math.max(0, priceDeltaThb);

      let checkoutUrl: string | null = null;
      if (addedThb > 0) {
        const checkout = await createCheckout(prisma, {
          purpose: 'stay_balance',
          bookingId,
          payerIdentityId: user.identityId,
          amountThb: addedThb,
        });
        checkoutUrl = checkout?.checkoutUrl || null;
      }

      const extension = {
        bookingId,
        currentEndDate: result.previousEndDate,
        newEndDate: result.endDate,
        additionalNights,
        addedThb,
        balanceDueThb: result.balanceDueThb,
        newTotalThb: result.totalThb,
      };

      return NextResponse.json(
        {
          extension,
          pricing: {
            oldTotalThb: result.previousTotalThb,
            newTotalThb: result.totalThb,
            balanceThb: priceDeltaThb,
            checkoutUrl,
          },
        },
        { status: 200 }
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

    // The date change itself belongs to the booking module. This route used to
    // repeat it inline, and the inline version was materially worse in three
    // ways: it repriced as `nights × baseNightlyThb`, ignoring seasonal rules,
    // length-of-stay discounts and the cleaning fee that computePriceBreakdown
    // applies — so a change charged the wrong amount; it checked conflicts with
    // a plain findFirst and no advisory lock, so two concurrent changes raced;
    // and it never checked BlockedDate, so a change could move a stay onto dates
    // the operator had closed.
    let updated;
    let balanceThb: number;
    const oldTotalThb = booking.totalThb;
    try {
      const result = await changeBookingDates(prisma, {
        bookingId,
        startDate: newStartDate,
        endDate: newEndDate,
        actorIdentityId: user.identityId,
        adults: adultsCount,
        children: childrenCount,
      });
      balanceThb = result.totalThb - result.previousTotalThb;
      updated = await prisma.booking.findUniqueOrThrow({
        where: { id: bookingId },
        include: { unit: true },
      });
    } catch (error) {
      const code = (error as { code?: string }).code;
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Could not change these dates' },
        { status: code === 'DOUBLE_BOOK' ? 409 : 400 }
      );
    }

    // An increase is collected through the same checkout seam as any other
    // money, after the change has committed rather than before it.
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

    // Track analytics event
    const nights = Math.ceil(
      (newEndDate.getTime() - newStartDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    await track(prisma, 'stay_modified', {
      bookingId: updated.id,
      unitId: updated.unitId,
      projectId: updated.projectId,
      identityId: booking.guestIdentityId,
      nights,
      priceDeltaThb: balanceThb,
      oldTotalThb,
      newTotalThb: updated.totalThb,
    }).catch(() => null);

    return NextResponse.json(
      {
        booking: updated,
        pricing: {
          oldTotalThb,
          newTotalThb: updated.totalThb,
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
