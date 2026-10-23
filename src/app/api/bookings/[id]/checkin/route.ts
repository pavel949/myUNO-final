/**
 * POST /api/bookings/[id]/checkin
 * Check in a booking: update status, create TM30 filings for foreign guests, baseline condition report.
 * Only the guest, scoped staff, or scoped MC member can check in.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import {
  createTm30Filing,
  createConditionReport,
  CHECK_IN_CHECKLIST_ITEMS,
  formatCheckInChecklistNotes,
  type CheckInChecklistItem,
} from '@/modules/ops';
import type { PrismaClient } from '@prisma/client';
import { checkInBooking, CheckInBlockedError } from '@/modules/booking';
import { getLabels } from '@/lib/i18n';
import { createNotification } from '@/modules/comms';
import { canRecordBookingStayTransition } from '@/app/libs/bookingOperationsAccess';

const CHECK_IN_BLOCK_LABELS = {
  'booking.checkin.blocked.party_unknown': 'Guest counts are unknown. Check-in is blocked until the party has been verified.',
  'booking.checkin.blocked.not_confirmed': 'Only a confirmed booking can be checked in.',
  'booking.checkin.blocked.before_arrival': 'Check-in opens on the arrival date.',
  'booking.checkin.blocked.after_departure': 'The stay has ended; this booking can no longer be checked in.',
  'booking.checkin.blocked.guests_incomplete': 'Register every guest in the party (adults, children and infants) before check-in.',
  'booking.checkin.blocked.passport_missing': 'Every foreign guest needs a passport number on file before check-in (TM30).',
};

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
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

    if (!(await canRecordBookingStayTransition(user, booking))) {
      return NextResponse.json(
        { error: 'Only the guest or an authorized front-desk operator can check in' },
        { status: 403 }
      );
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


    // The transition itself belongs to the booking module, not to this route,
    // and so does the rule deciding whether it may happen (`assessCheckIn`:
    // inside the stay window, full party registered, passports for foreign
    // guests). The TM30 filings are created in the SAME transaction: check-in
    // starts the 24h immigration clock, so a check-in whose filings could not
    // be created must not commit (it used to log the failure and carry on).
    let checkedInAt: Date;
    let tm30FilingsCreated = 0;
    try {
      checkedInAt = await prisma.$transaction(async (tx) => {
        const db = tx as unknown as PrismaClient;
        const checkedIn = await checkInBooking(db, params.id);
        // The booking source lock is still held; party writers use the same lock.
        const currentGuests = await tx.bookingGuest.findMany({ where: { bookingId: checkedIn.id } });
        for (const guest of currentGuests) {
          if (guest.nationality && guest.nationality.trim().toUpperCase() !== 'TH') {
            await createTm30Filing(db, { bookingId: checkedIn.id, bookingGuestId: guest.id });
            tm30FilingsCreated++;
          }
        }
        await createConditionReport(tx, {
          unitId: checkedIn.unitId, bookingId: checkedIn.id, reportType: 'check_in',
          notes: formatCheckInChecklistNotes(checklistItems, notesInput),
          createdByIdentityId: user.identityId,
          photoMediaIds: photoMediaIds.length > 0 ? photoMediaIds : undefined,
        });
        return checkedIn.checkedInAt ?? new Date();
      });
    } catch (error) {
      if (error instanceof CheckInBlockedError) {
        const labels = await getLabels(CHECK_IN_BLOCK_LABELS, undefined, {
          'booking.checkin.blocked.party_unknown': {
            en: 'Guest counts are unknown. Check-in is blocked until the party has been verified.',
            ru: 'Количество гостей неизвестно. Заселение недоступно до проверки состава гостей.',
            th: 'ยังไม่ทราบจำนวนผู้เข้าพัก ไม่สามารถเช็คอินได้จนกว่าจะตรวจสอบจำนวนผู้เข้าพักแล้ว',
          },
        });
        return NextResponse.json(
          { error: labels[`booking.checkin.blocked.${error.code}`], code: error.code },
          { status: 409 }
        );
      }
      // The unit itself is not ready for occupancy (readiness gate).
      const coded = error as Error & { code?: string; blockers?: unknown[] };
      if (coded?.code === 'UNIT_NOT_READY') {
        return NextResponse.json(
          {
            error: coded.message,
            code: coded.code,
            blockers: coded.blockers ?? [],
          },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Cannot check in this booking' },
        { status: 400 }
      );
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
    }).catch((error) => console.error('Check-in committed but guest notification failed:', error));

    // Notify unit owner that the guest has arrived (not N-03 — that fires on confirmation).
    if (booking.unit.ownerIdentityId) {
      await createNotification(prisma, {
        identityId: booking.unit.ownerIdentityId,
        type: 'stay_modified_ops',
        titleKey: 'notify.stay_guest_checked_in.title',
        bodyKey: 'notify.stay_guest_checked_in.body',
        params: {
          guest_name: booking.guestIdentity.firstName + ' ' + booking.guestIdentity.lastName,
          unit_name: booking.unit.name,
        },
      }).catch((error) => console.error('Check-in committed but owner notification failed:', error));
    }

    return NextResponse.json(
      {
        success: true,
        checkedInAt,
        tm30FilingsCreated,
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
