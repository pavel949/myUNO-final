/**
 * POST /api/bookings/[id]/checkin
 * Check in a booking: update status, create TM30 filings for foreign guests, baseline condition report.
 * Only the guest or a staff member can check in.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { createTm30Filing, createConditionReport } from '@/modules/ops';
import { createNotification } from '@/modules/comms';

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user?.identityId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await prisma.identity.findUnique({
      where: { id: user.identityId },
    });

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get the booking
    const booking = await prisma.booking.findUnique({
      where: { id: params.id },
      include: {
        guests: true,
        unit: true,
        project: true,
        guestIdentity: true,
      },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Authorization: guest or staff can check in
    const isGuest = booking.guestIdentityId === currentUser.id;
    const isStaff = await prisma.roleAssignment.findFirst({
      where: {
        identityId: currentUser.id,
        role: 'staff_ops',
        status: 'active',
      },
    });

    if (!isGuest && !isStaff) {
      return NextResponse.json(
        { error: 'Only guest or staff can check in' },
        { status: 403 }
      );
    }

    // Check status: must be confirmed to check in
    if (booking.status !== 'confirmed') {
      return NextResponse.json(
        { error: `Cannot check in a booking in ${booking.status} status` },
        { status: 400 }
      );
    }

    // Update booking status
    const checkedInAt = new Date();
    await prisma.booking.update({
      where: { id: params.id },
      data: {
        status: 'checked_in',
        checkedInAt,
      },
    });

    // Create TM30 filing for each foreign guest (not Thai nationals)
    for (const guest of booking.guests) {
      if (guest.nationality && guest.nationality !== 'TH') {
        try {
          await createTm30Filing(prisma, {
            bookingId: booking.id,
            bookingGuestId: guest.id,
          });
        } catch (error) {
          // Log but don't fail check-in; TM30 can be manually filed
          console.error(`Failed to create TM30 filing for guest ${guest.id}:`, error);
        }
      }
    }

    // Create baseline condition report
    try {
      await createConditionReport(prisma, {
        unitId: booking.unitId,
        bookingId: booking.id,
        reportType: 'check_in',
        notes: 'Check-in inspection. Photos should be attached separately.',
        createdByIdentityId: currentUser.id,
      });
    } catch (error) {
      console.error(`Failed to create condition report:`, error);
    }

    // Notify guest
    await createNotification(prisma, {
      identityId: booking.guestIdentityId,
      type: 'stay_checkin_instructions',
      titleKey: 'booking.checkin.confirmed.title',
      bodyKey: 'booking.checkin.confirmed.body',
      params: {
        unit_name: booking.unit.name,
        checkin_time: checkedInAt.toISOString(),
      },
    });

    // Notify unit owner
    if (booking.unit.ownerIdentityId) {
      await createNotification(prisma, {
        identityId: booking.unit.ownerIdentityId,
        type: 'stay_new_booking_ops',
        titleKey: 'booking.guest_checkin.title',
        bodyKey: 'booking.guest_checkin.body',
        params: {
          guest_name: booking.guestIdentity.firstName + ' ' + booking.guestIdentity.lastName,
          unit_name: booking.unit.name,
        },
      });
    }

    return NextResponse.json(
      {
        success: true,
        checkedInAt,
        tm30FilingsCreated: booking.guests.filter((g) => g.nationality !== 'TH').length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Check-in error:', error);
    return NextResponse.json(
      { error: 'Check-in failed' },
      { status: 500 }
    );
  }
}
