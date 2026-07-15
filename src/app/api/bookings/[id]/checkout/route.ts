import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { createCheckout } from '@/modules/finance';
import { handleError, createPublicError } from '@/app/libs/errorHandler';

/**
 * POST /api/bookings/[id]/checkout
 * Resume/complete payment by card for a pending booking: creates a checkout
 * session for the booking's server-stored total and returns its URL.
 * Guest-only; reuses an existing pending session instead of stacking new ones.
 */
export async function POST(
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
      select: {
        id: true,
        status: true,
        totalThb: true,
        guestIdentityId: true,
        payments: {
          where: { purpose: 'stay' },
          select: { id: true, status: true, method: true },
        },
      },
    });

    if (!booking || booking.guestIdentityId !== user.identityId) {
      throw createPublicError('not found', 404);
    }

    if (booking.status !== 'pending_payment') {
      throw createPublicError('invalid request: booking is not awaiting payment', 400);
    }

    if (booking.payments.some((p) => p.status === 'succeeded')) {
      throw createPublicError('invalid request: booking already paid', 400);
    }

    // Reuse an existing pending card session if one exists
    const pending = booking.payments.find(
      (p) => p.status === 'pending' && p.method === 'card_provider'
    );
    if (pending) {
      return NextResponse.json({
        checkoutUrl: `/checkout/${pending.id}`,
        sessionId: pending.id,
        paymentId: pending.id,
      });
    }

    const checkout = await createCheckout(prisma, {
      purpose: 'stay',
      bookingId: booking.id,
      payerIdentityId: user.identityId,
      amountThb: booking.totalThb,
    });

    return NextResponse.json(checkout);
  } catch (error) {
    return handleError(error);
  }
}
