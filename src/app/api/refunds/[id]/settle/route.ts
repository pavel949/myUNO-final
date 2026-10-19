import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { settleManualRefund } from '@/modules/finance';
import { logAudit } from '@/modules/audit';
import { handleError, createPublicError } from '@/app/libs/errorHandler';
import { canOperateBookingAsStaff, resolveBookingAccess } from '@/app/libs/bookingAccess';

/**
 * POST /api/refunds/[id]/settle
 *
 * Staff confirm they handed a cash / bank-transfer refund back to the guest.
 * The refund was created as `requested` by the cancellation; this records who
 * paid it back and writes the append-only refund_out ledger line. The amount is
 * the stored refund amount, never client-sent. Card refunds are not settled here.
 */
export async function POST(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const user = await getCurrentUser();
    if (!user) throw createPublicError('unauthorized', 401);

    const refund = await prisma.refund.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        status: true,
        amountThb: true,
        payment: {
          select: {
            method: true,
            booking: { select: { id: true, projectId: true, unitId: true, guestIdentityId: true } },
          },
        },
      },
    });
    if (!refund) throw createPublicError('not found', 404);
    if (refund.payment.method === 'card_provider') {
      throw createPublicError('invalid request: card refunds are settled by the payment provider', 400);
    }

    const booking = refund.payment.booking;
    if (booking) {
      const access = await resolveBookingAccess(user, {
        guestIdentityId: booking.guestIdentityId,
        projectId: booking.projectId,
        unitId: booking.unitId,
      });
      if (!canOperateBookingAsStaff(access)) throw createPublicError('Access denied.', 403);
    } else if (!user.isAdmin) {
      throw createPublicError('Access denied.', 403);
    }

    if (refund.status !== 'requested' && refund.status !== 'succeeded') {
      throw createPublicError('invalid request: refund is not awaiting payout', 400);
    }

    const settled = await settleManualRefund(prisma, {
      refundId: refund.id,
      paidBackByIdentityId: user.identityId,
    });
    await logAudit({
      actorIdentityId: user.identityId,
      action: 'refund.settled_manual',
      entityType: 'refund',
      entityId: refund.id,
      data: { amountThb: refund.amountThb, bookingId: booking?.id ?? null },
    });

    return NextResponse.json({ refund: settled }, { status: 200 });
  } catch (error) {
    return handleError(error);
  }
}
