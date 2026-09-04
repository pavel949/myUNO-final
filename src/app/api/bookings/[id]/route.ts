import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { computeRefundAmount, type CancellationPolicy } from '@/modules/booking';
import { getActiveDepositClaimForGuest } from '@/modules/finance';
import { handleError, createPublicError } from '@/app/libs/errorHandler';
import { hasProjectStaffAccess } from '@/app/libs/projectScope';

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
    const isStaff = hasProjectStaffAccess(user, booking.projectId);
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

    // Check if the guest has already reviewed this stay
    let hasReview = false;
    let depositClaim: Awaited<ReturnType<typeof getActiveDepositClaimForGuest>> = null;
    if (isGuest) {
      const existingReview = await prisma.review.findFirst({
        where: {
          target_type: 'stay',
          target_id: params.id,
          author_identity_id: user.identityId,
        },
        select: { id: true },
      });
      hasReview = !!existingReview;
      depositClaim = await getActiveDepositClaimForGuest(prisma, params.id);
    }

    const { unit, ...rest } = booking;
    // Display boundary: totalThb/refundAccruedThb/refundPreviewThb are all
    // computed and stored in satang (THB x 100). Convert to baht only here,
    // at the response boundary — the refund math above still ran in satang.
    return NextResponse.json({
      ...rest,
      totalThb: Math.round(rest.totalThb / 100),
      refundAccruedThb: Math.round(rest.refundAccruedThb / 100),
      unit: unit ? { id: unit.id, name: unit.name } : null,
      viewer: { isGuest, isOwner: isOwner || user.isAdmin, isStaff },
      cancellable: CANCELLABLE_STATUSES.includes(booking.status),
      refundPreviewThb: refundPreviewThb === null ? null : Math.round(refundPreviewThb / 100),
      hasReview,
      verificationStatus: booking.verificationStatus,
      depositClaim: depositClaim
        ? {
            id: depositClaim.id,
            description: depositClaim.description,
            claimedAmountThb: Math.round(depositClaim.claimedAmountThb / 100),
            status: depositClaim.status,
            filedAt: depositClaim.filedAt.toISOString(),
            responseDeadlineAt: depositClaim.responseDeadlineAt.toISOString(),
            canDispute: depositClaim.canDispute,
          }
        : null,
    });
  } catch (error) {
    return handleError(error);
  }
}
