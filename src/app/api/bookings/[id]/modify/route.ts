import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { createCheckout } from '@/modules/finance';
import { requestExtension, changeBookingDates } from '@/modules/booking';
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

    // A stay already under way takes the F-GUEST-7 in-stay branch: the only
    // date move left is pushing the end later, so it goes through the booking
    // module's extension rather than the general re-shape below.
    if (booking.status === 'checked_in') {
      if (!newEndDateStr) {
        return NextResponse.json(
          { error: 'An extension needs a new end date' },
          { status: 400 }
        );
      }

      const extension = await requestExtension(
        prisma,
        bookingId,
        new Date(newEndDateStr),
        user.identityId
      );

      // The added nights are collected as a stay balance, never bundled back
      // into the original stay payment (doc 10).
      const checkout = await createCheckout(prisma, {
        purpose: 'stay_balance',
        bookingId,
        payerIdentityId: user.identityId,
        amountThb: extension.addedThb,
      });

      return NextResponse.json(
        {
          extension,
          pricing: {
            oldTotalThb: booking.totalThb,
            newTotalThb: extension.newTotalThb,
            balanceThb: extension.addedThb,
            checkoutUrl: checkout?.checkoutUrl || null,
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

    // Party size is not part of the dates transition, so it is applied here —
    // and only when asked for, so an unchanged party is left alone.
    if (adultsCount !== undefined || childrenCount !== undefined) {
      updated = await prisma.booking.update({
        where: { id: bookingId },
        data: {
          ...(adultsCount !== undefined && { adults: adultsCount }),
          ...(childrenCount !== undefined && { children: childrenCount }),
        },
        include: { unit: true },
      });
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
