/**
 * POST /api/bookings/[id]/checkin
 * Check in a booking: update status, create TM30 filings for foreign guests, baseline condition report.
 * Only the guest, scoped staff, or scoped MC member can check in.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { createTm30Filing, createConditionReport } from '@/modules/ops';
import {
  CHECK_IN_CHECKLIST_ITEMS,
  formatCheckInChecklistNotes,
  type CheckInChecklistItem,
} from '@/modules/ops/check-in-checklist';
import { checkInBooking } from '@/modules/booking';
import { createNotification } from '@/modules/comms';
import { hasManagedUnitMcAccess, hasProjectStaffAccess } from '@/app/libs/projectScope';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user?.identityId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

    // Authorization: guest, scoped staff, or scoped MC can check in
    const isGuest = booking.guestIdentityId === user.identityId;
    const isStaff = hasProjectStaffAccess(user, booking.projectId);
    const isManagedMc = await hasManagedUnitMcAccess(user, {
      projectId: booking.projectId,
      unitId: booking.unitId,
    });

    if (!isGuest && !isStaff && !isManagedMc) {
      return NextResponse.json(
        { error: 'Only guest, staff, or management company can check in' },
        { status: 403 }
      );
    }

    // The transition itself belongs to the booking module, not to this route.
    // It used to be repeated here as a status check plus an inline update, which
    // meant the state machine in booking.service.ts was tested while this was
    // the code that actually ran — two implementations, one of them unverified.
    // Going through the service also emits `stay_checked_in`, which the inline
    // version silently omitted.
    let checkedInAt: Date;
    try {
      const checkedIn = await checkInBooking(prisma, params.id);
      checkedInAt = checkedIn.checkedInAt ?? new Date();
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Cannot check in this booking' },
        { status: 400 }
      );
    }

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

    // Optional condition report payload from staff check-in flow (F-OPS-1)
    const body = await req.json().catch(() => ({}));
    const notesInput = typeof body.notes === 'string' ? body.notes : '';
    const photoMediaIds = Array.isArray(body.photoMediaIds)
      ? body.photoMediaIds.filter((id: unknown) => typeof id === 'string')
      : [];
    const checklistItems = Array.isArray(body.checklistItems)
      ? body.checklistItems.filter((item: unknown): item is CheckInChecklistItem =>
          typeof item === 'string' &&
          (CHECK_IN_CHECKLIST_ITEMS as readonly string[]).includes(item)
        )
      : [];

    // Create baseline condition report
    try {
      await createConditionReport(prisma, {
        unitId: booking.unitId,
        bookingId: booking.id,
        reportType: 'check_in',
        notes: formatCheckInChecklistNotes(checklistItems, notesInput),
        createdByIdentityId: user.identityId,
        photoMediaIds: photoMediaIds.length > 0 ? photoMediaIds : undefined,
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
