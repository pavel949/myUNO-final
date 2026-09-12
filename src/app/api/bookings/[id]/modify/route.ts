import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { createCheckout } from '@/modules/finance';
import {
  requestExtension,
  changeBookingDates,
  createBookingReschedule,
  attachReschedulePayment,
  commitBookingReschedule,
} from '@/modules/booking';
import { track } from '@/modules/analytics';

/**
 * POST /api/bookings/[id]/modify
 *
 * Confirmed date changes use AT09 replacement-hold semantics: the old booking
 * remains untouched while the new interval is held and any positive price delta
 * is funded. Checked-in stays continue through the dedicated extension flow.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const bookingId = params.id;
    const body = await req.json();
    const { startDate: newStartDateStr, endDate: newEndDateStr, adultsCount, childrenCount } = body;
    const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: { unit: true } });
    if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    if (booking.guestIdentityId !== user.identityId) {
      return NextResponse.json({ error: 'Not authorized to modify this booking' }, { status: 403 });
    }

    if (booking.status === 'checked_in') {
      if (!newEndDateStr) return NextResponse.json({ error: 'An extension needs a new end date' }, { status: 400 });
      const extension = await requestExtension(prisma, bookingId, new Date(newEndDateStr), user.identityId);
      const checkout = await createCheckout(prisma, {
        purpose: 'stay_balance',
        bookingId,
        payerIdentityId: user.identityId,
        amountThb: extension.addedThb,
      });
      return NextResponse.json({
        extension,
        pricing: {
          oldTotalThb: booking.totalThb,
          newTotalThb: extension.newTotalThb,
          balanceThb: extension.addedThb,
          checkoutUrl: checkout?.checkoutUrl || null,
        },
      });
    }

    if (booking.status !== 'confirmed') {
      return NextResponse.json({ error: `Cannot modify booking with status ${booking.status}` }, { status: 400 });
    }

    const datesChanged = Boolean(newStartDateStr || newEndDateStr);
    if (datesChanged) {
      if (adultsCount !== undefined || childrenCount !== undefined) {
        return NextResponse.json(
          { error: 'Change dates first, then change the party after the reschedule is committed.' },
          { status: 400 }
        );
      }
      const newStartDate = newStartDateStr ? new Date(newStartDateStr) : booking.startDate;
      const newEndDate = newEndDateStr ? new Date(newEndDateStr) : booking.endDate;
      if (Number.isNaN(newStartDate.getTime()) || Number.isNaN(newEndDate.getTime()) || newStartDate >= newEndDate) {
        return NextResponse.json({ error: 'startDate must be before endDate' }, { status: 400 });
      }

      const created = await createBookingReschedule(prisma, {
        bookingId,
        requestedByIdentityId: user.identityId,
        startDate: newStartDate,
        endDate: newEndDate,
      });

      if (created.reschedule.priceDeltaThb <= 0) {
        const committed = await commitBookingReschedule(prisma, created.reschedule.id);
        return NextResponse.json({
          reschedule: committed.request,
          booking: committed.booking,
          pricing: {
            oldTotalThb: created.reschedule.previousTotalThb,
            newTotalThb: created.reschedule.newTotalThb,
            balanceThb: created.reschedule.priceDeltaThb,
            checkoutUrl: null,
          },
        });
      }

      const checkout = await createCheckout(prisma, {
        purpose: 'stay_balance',
        bookingId,
        payerIdentityId: user.identityId,
        amountThb: created.reschedule.priceDeltaThb,
      });
      await attachReschedulePayment(prisma, created.reschedule.id, checkout.paymentId);

      return NextResponse.json({
        reschedule: { ...created.reschedule, paymentId: checkout.paymentId },
        booking,
        pricing: {
          oldTotalThb: created.reschedule.previousTotalThb,
          newTotalThb: created.reschedule.newTotalThb,
          balanceThb: created.reschedule.priceDeltaThb,
          checkoutUrl: checkout.checkoutUrl,
        },
      });
    }

    // Party-only changes keep the existing canonical repricing path. AT09 is
    // specifically the date/capacity replacement workflow.
    if (adultsCount === undefined && childrenCount === undefined) {
      return NextResponse.json({ error: 'No modification supplied' }, { status: 400 });
    }
    const result = await changeBookingDates(prisma, {
      bookingId,
      startDate: booking.startDate,
      endDate: booking.endDate,
      actorIdentityId: user.identityId,
      adults: adultsCount,
      children: childrenCount,
    });
    const updated = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId }, include: { unit: true } });
    const balanceThb = result.totalThb - result.previousTotalThb;
    let checkoutUrl: string | null = null;
    if (balanceThb > 0) {
      const checkout = await createCheckout(prisma, {
        purpose: 'stay_balance', bookingId, payerIdentityId: user.identityId, amountThb: balanceThb,
      });
      checkoutUrl = checkout.checkoutUrl;
    }
    await track(prisma, 'stay_modified', {
      bookingId: updated.id,
      unitId: updated.unitId,
      projectId: updated.projectId,
      identityId: booking.guestIdentityId,
      priceDeltaThb: balanceThb,
      oldTotalThb: booking.totalThb,
      newTotalThb: updated.totalThb,
    }).catch(() => null);
    return NextResponse.json({
      booking: updated,
      pricing: { oldTotalThb: booking.totalThb, newTotalThb: updated.totalThb, balanceThb, checkoutUrl },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const code = (error as { code?: string }).code;
    console.error('Booking modification error:', message);
    return NextResponse.json({ error: message }, { status: code === 'DOUBLE_BOOK' ? 409 : 400 });
  }
}
