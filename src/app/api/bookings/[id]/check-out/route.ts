import type { PrismaClient } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { createNotification } from '@/modules/comms';
import { checkOutBooking } from '@/modules/booking';
import {
  createConditionReport,
  CHECK_OUT_CHECKLIST_ITEMS,
  formatCheckOutChecklistNotes,
  type CheckOutChecklistItem,
} from '@/modules/ops';
import { handleError, createPublicError } from '@/app/libs/errorHandler';
import { canRecordBookingStayTransition } from '@/app/libs/bookingOperationsAccess';

/**
 * POST /api/bookings/[id]/check-out
 * Check out a stay: checked_in → checked_out (guest, scoped staff, or scoped MC).
 * Optional condition report payload (F-OPS-1 departure inspection).
 */
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
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

    if (!(await canRecordBookingStayTransition(user, booking))) {
      throw createPublicError('Access denied.', 403);
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


    // Through the booking module rather than an inline update: the state
    // machine is the tested definition of this transition, and it also records
    // `checkedOutAt` and emits `stay_checked_out`, both of which the inline
    // version dropped.
    let updated;
    try {
      updated = await prisma.$transaction(async tx => {
        const departure = await checkOutBooking(tx as unknown as PrismaClient, booking.id);
        if (checklistItems.length > 0 || notesInput || photoMediaIds.length > 0) {
          await createConditionReport(tx, {
            unitId: departure.unitId, bookingId: departure.id, reportType: 'check_out',
            notes: formatCheckOutChecklistNotes(checklistItems, notesInput),
            createdByIdentityId: user.identityId,
            photoMediaIds: photoMediaIds.length > 0 ? photoMediaIds : undefined,
          });
        }
        return departure;
      });
    } catch (error) {
      throw createPublicError(
        `invalid request: ${error instanceof Error ? error.message : 'booking is not checked in'}`,
        400
      );
    }

    if (booking.unit?.ownerIdentityId) {
      await createNotification(prisma, {
        identityId: booking.unit.ownerIdentityId,
        type: 'stay_modified_ops',
        titleKey: 'notify.stay_checked_out.title',
        bodyKey: 'notify.stay_checked_out.body',
        params: { unit_name: booking.unit.name },
      }).catch((error) => console.error('Check-out committed but owner notification failed:', error));
    }

    return NextResponse.json({ booking: updated });
  } catch (error) {
    return handleError(error);
  }
}
