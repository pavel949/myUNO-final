import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getCancellationQuote } from '@/modules/booking/cancellation-quote';
import { getActiveDepositClaimForGuest, getBookingRefundDisplayState } from '@/modules/finance';
import { handleError, createPublicError } from '@/app/libs/errorHandler';
import { canViewBooking, resolveBookingAccess } from '@/app/libs/bookingAccess';

const CANCELLABLE_STATUSES = ['requested', 'pending_payment', 'confirmed'];

/**
 * GET /api/bookings/[id]
 * Booking detail for the trips detail page.
 * Visible to: the guest, the unit owner, staff, admin.
 * Includes a live refund preview when the booking is cancellable.
 */
export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
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
            reconciliationReason: true,
            createdAt: true,
            provider: true,
            refunds: { where: { status: 'succeeded' }, select: { amountThb: true } },
          },
        },
      },
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
    if (!canViewBooking(access)) {
      throw createPublicError('not found', 404);
    }

    const { isGuest, isOwner, isStaff } = access;

    // Live refund preview from the policy snapshotted at booking time
    const fullyRefunded = (p: typeof booking.payments[number]) => p.refunds.reduce((sum, refund) => sum + refund.amountThb, 0) >= p.amountThb;
    const paymentReviewRequired = booking.payments.some(p => (p.reconciliationReason && !fullyRefunded(p)) ||
      (p.provider !== 'mock' && p.status === 'created' && p.createdAt.getTime() + 120_000 <= Date.now()));
    const unallocatedPaymentRefunded = booking.payments.some(p => p.reconciliationReason && fullyRefunded(p));
    const hasPaid = booking.payments.some((p) => p.status === 'succeeded' && !p.reconciliationReason);
    const cancellationQuote = (isGuest || isOwner) && [...CANCELLABLE_STATUSES, 'checked_in'].includes(booking.status)
      ? await getCancellationQuote(prisma, booking) : null;
    const refundPreviewThb = hasPaid && cancellationQuote ? cancellationQuote.refundAmountSatang : null;

    // Check if the guest has already reviewed this stay
    let hasReview = false;
    let depositClaim: Awaited<ReturnType<typeof getActiveDepositClaimForGuest>> = null;
    const paymentFailed =
      isGuest &&
      !paymentReviewRequired &&
      booking.status === 'pending_payment' &&
      booking.payments.some((p) => p.status === 'failed');
    const refundDisplayState =
      booking.status === 'cancelled'
        ? await getBookingRefundDisplayState(prisma, params.id)
        : 'none';

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

    const { unit } = booking;
    // Explicit allow-list. The row carries replay keys, the staff-only note,
    // the other party's identity ids and internal pricing; none of that may
    // reach a guest or an owner just because it is a column of `booking`.
    // New columns are therefore private until someone adds them here.
    const visible = {
      id: booking.id,
      reference: booking.reference,
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt,
      unitId: booking.unitId,
      projectId: booking.projectId,
      bookingType: booking.bookingType,
      status: booking.status,
      paymentMethod: booking.paymentMethod,
      startDate: booking.startDate,
      endDate: booking.endDate,
      adults: booking.adults,
      children: booking.children,
      infants: booking.infants,
      pets: booking.pets,
      balanceDueThb: booking.balanceDueThb,
      receivableStatus: booking.receivableStatus,
      holdExpiresAt: booking.holdExpiresAt,
      requestExpiresAt: booking.requestExpiresAt,
      checkedInAt: booking.checkedInAt,
      checkedOutAt: booking.checkedOutAt,
      cancelledAt: booking.cancelledAt,
      guestNote: booking.guestNote,
      project: booking.project,
      payments: booking.payments,
    };
    // Staff see the operational columns a guest or owner must not.
    const staffOnly = isStaff
      ? {
          internalNote: booking.internalNote,
          cancellationReason: booking.cancellationReason,
          channel: booking.channel,
          externalRef: booking.externalRef,
        }
      : {};
    // Display boundary: totalThb/refundAccruedThb/refundPreviewThb are all
    // computed and stored in satang (THB x 100). Convert to baht only here,
    // at the response boundary — the refund math above still ran in satang.
    return NextResponse.json({
      ...visible,
      ...staffOnly,
      totalThb: Math.round(booking.totalThb / 100),
      refundAccruedThb: Math.round(booking.refundAccruedThb / 100),
      unit: unit ? { id: unit.id, name: unit.name } : null,
      viewer: { isGuest, isOwner, isStaff },
      cancellable: CANCELLABLE_STATUSES.includes(booking.status),
      refundPreviewThb: refundPreviewThb === null ? null : refundPreviewThb / 100,
      cancellationQuote,
      hasReview,
      verificationStatus: booking.verificationStatus,
      paymentFailed,
      paymentReviewRequired,
      unallocatedPaymentRefunded,
      refundDisplayState,
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
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return handleError(error);
  }
}

