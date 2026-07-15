import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { computeRefundAmount, type CancellationPolicy } from '@/modules/booking';
import { handleError, createPublicError } from '@/app/libs/errorHandler';

const CANCELLABLE_STATUSES = ['requested', 'pending_payment', 'confirmed'];

/**
 * GET /api/bookings/[id]
 * Booking detail for the trips detail page.
 * Visible to: the guest, the unit owner, staff, admin.
 * Includes a live refund preview when the booking is cancellable.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw createPublicError('unauthorized', 401);
    }

    const booking = await prisma.booking.findUnique({
      where: { id: params.id },
      include: {
        unit: { select: { id: true, name: true, ownerIdentityId: true } },
        project: { select: { id: true, name: true } },
        payments: {
          select: {
            id: true,
            status: true,
            method: true,
            amountThb: true,
            succeededAt: true,
            receiptRef: true,
          },
        },
      },
    });

    if (!booking) {
      throw createPublicError('not found', 404);
    }

    const isGuest = booking.guestIdentityId === user.identityId;
    const isOwner = booking.unit?.ownerIdentityId === user.identityId;
    const isStaff = user.roles.some((role) => role.role === 'staff_ops');
    if (!isGuest && !isOwner && !isStaff && !user.isAdmin) {
      throw createPublicError('not found', 404);
    }

    // Live refund preview from the policy snapshotted at booking time
    let refundPreviewThb: number | null = null;
    const hasPaid = booking.payments.some((p) => p.status === 'succeeded');
    if (CANCELLABLE_STATUSES.includes(booking.status) && hasPaid) {
      const snapshot = booking.cancellationPolicySnapshot as unknown as CancellationPolicy | null;
      if (snapshot?.steps) {
        refundPreviewThb = computeRefundAmount(
          booking.totalThb,
          snapshot.steps,
          booking.startDate,
          new Date()
        );
      }
    }

    const { unit, ...rest } = booking;
    return NextResponse.json({
      ...rest,
      unit: unit ? { id: unit.id, name: unit.name } : null,
      viewer: { isGuest, isOwner: isOwner || user.isAdmin, isStaff },
      cancellable: CANCELLABLE_STATUSES.includes(booking.status),
      refundPreviewThb,
    });
  } catch (error) {
    return handleError(error);
  }
}
