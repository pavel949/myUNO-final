import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { can } from '@/modules/core';
import { approveBookingRequest, declineBookingRequest } from '@/modules/booking';
import { getConfig } from '@/modules/config';
import { createNotification } from '@/modules/comms';

/**
 * POST /api/bookings/[id]/respond
 * Approve or decline a request-to-book booking (doc 07 F-GUEST-4).
 * Body: { action: 'approve' | 'decline' }
 *
 * Permission: stays:approve_decline_booking_requests (staff_ops, onsite_host,
 * mc_member scoped to their units; admin bypasses via can()).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const identity = await prisma.identity.findUnique({
      where: { id: user.identityId },
    });
    if (!identity) {
      return NextResponse.json({ error: 'Identity not found' }, { status: 404 });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        status: true,
        unitId: true,
        projectId: true,
        guestIdentityId: true,
        startDate: true,
        endDate: true,
        unit: { select: { name: true } },
      },
    });
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const allowed = await can({
      identity,
      action: 'stays:approve_decline_booking_requests',
      resource: { projectId: booking.projectId, unitId: booking.unitId },
    });
    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const action = body?.action;
    if (action !== 'approve' && action !== 'decline') {
      return NextResponse.json(
        { error: "action must be 'approve' or 'decline'" },
        { status: 400 }
      );
    }

    if (booking.status !== 'requested') {
      return NextResponse.json(
        { error: `Cannot respond to booking with status ${booking.status}` },
        { status: 409 }
      );
    }

    const notifyParams = {
      booking_id: booking.id,
      unit_name: booking.unit?.name ?? '',
      start_date: booking.startDate.toISOString().slice(0, 10),
      end_date: booking.endDate.toISOString().slice(0, 10),
    };

    if (action === 'approve') {
      const holdMinutes = await getConfig(prisma, 'booking.hold_minutes', {
        projectId: booking.projectId,
        unitId: booking.unitId,
      });
      const updated = await approveBookingRequest(prisma, {
        bookingId: booking.id,
        holdMinutes: typeof holdMinutes === 'number' ? holdMinutes : 30,
      });
      // N-05 — guest: request approved, payment window open
      await createNotification(prisma, {
        identityId: booking.guestIdentityId,
        type: 'stay_request_approved',
        titleKey: 'notify.stay_request_approved.title',
        bodyKey: 'notify.stay_request_approved.body',
        params: notifyParams,
      });
      return NextResponse.json({ booking: updated }, { status: 200 });
    }

    const updated = await declineBookingRequest(prisma, {
      bookingId: booking.id,
      declinedByIdentityId: user.identityId,
    });
    // N-06 — guest: request declined
    await createNotification(prisma, {
      identityId: booking.guestIdentityId,
      type: 'stay_request_declined',
      titleKey: 'notify.stay_request_declined.title',
      bodyKey: 'notify.stay_request_declined.body',
      params: notifyParams,
    });
    return NextResponse.json({ booking: updated }, { status: 200 });
  } catch (error) {
    console.error(
      'Booking respond error:',
      error instanceof Error ? error.message : error
    );
    return NextResponse.json(
      { error: 'Failed to respond to booking request' },
      { status: 500 }
    );
  }
}
