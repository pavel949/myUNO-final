import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { createNotification } from '@/modules/comms';
import { checkOutBooking } from '@/modules/booking';
import { createConditionReport } from '@/modules/ops';
import {
  CHECK_OUT_CHECKLIST_ITEMS,
  formatCheckOutChecklistNotes,
  type CheckOutChecklistItem,
} from '@/modules/ops/check-out-checklist';
import { handleError, createPublicError } from '@/app/libs/errorHandler';
import { canRecordStayTransition, resolveBookingAccess } from '@/app/libs/bookingAccess';

/**
 * POST /api/bookings/[id]/check-out
 * Check out a stay: checked_in → checked_out (guest, scoped staff, or scoped MC).
 * Optional condition report payload (F-OPS-1 departure inspection).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw createPublicError('unauthorized', 401);
    }

    const booking = await prisma.booking.findUnique({
      where: { id: params.id },
      include: { unit: { select: { name: true, ownerIdentityId: true, id: true } } },
    });

    if (!booking) {
      throw createPublicError('not found', 404);
    }

    const access = await resolveBookingAccess(user, {
      guestIdentityId: booking.guestIdentityId,
      projectId: booking.projectId,
      unitId: booking.unitId,
      ownerIdentityId: booking.unit?.ownerIdentityId,
    });
    if (!canRecordStayTransition(access)) {
      throw createPublicError('Access denied.', 403);
    }

    // Through the booking module rather than an inline update: the state
    // machine is the tested definition of this transition, and it also records
    // `checkedOutAt` and emits `stay_checked_out`, both of which the inline
    // version dropped.
    let updated;
    try {
      updated = await checkOutBooking(prisma, booking.id);
    } catch (error) {
      throw createPublicError(
        `invalid request: ${error instanceof Error ? error.message : 'booking is not checked in'}`,
        400
      );
    }

    const body = await req.json().catch(() => ({}));
    const notesInput = typeof body.notes === 'string' ? body.notes : '';
    const photoMediaIds = Array.isArray(body.photoMediaIds)
      ? body.photoMediaIds.filter((id: unknown) => typeof id === 'string')
      : [];
    const checklistItems = Array.isArray(body.checklistItems)
      ? body.checklistItems.filter((item: unknown): item is CheckOutChecklistItem =>
          typeof item === 'string' &&
          (CHECK_OUT_CHECKLIST_ITEMS as readonly string[]).includes(item)
        )
      : [];

    if (checklistItems.length > 0 || notesInput || photoMediaIds.length > 0) {
      try {
        await createConditionReport(prisma, {
          unitId: booking.unitId,
          bookingId: booking.id,
          reportType: 'check_out',
          notes: formatCheckOutChecklistNotes(checklistItems, notesInput),
          createdByIdentityId: user.identityId,
          photoMediaIds: photoMediaIds.length > 0 ? photoMediaIds : undefined,
        });
      } catch (error) {
        console.error('Failed to create check-out condition report:', error);
      }
    }

    if (booking.unit?.ownerIdentityId) {
      await createNotification(prisma, {
        identityId: booking.unit.ownerIdentityId,
        type: 'stay_modified_ops',
        titleKey: 'notify.stay_checked_out.title',
        bodyKey: 'notify.stay_checked_out.body',
        params: { unit_name: booking.unit.name },
      });
    }

    return NextResponse.json({ booking: updated });
  } catch (error) {
    return handleError(error);
  }
}
