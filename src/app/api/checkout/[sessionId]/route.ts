import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { handleError, createPublicError } from '@/app/libs/errorHandler';

/**
 * GET /api/checkout/[sessionId]
 * Checkout session summary for the mock checkout page: amount + booking
 * context. Payer-only (or admin).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw createPublicError('unauthorized', 401);
    }

    const payment = await prisma.payment.findUnique({
      where: { id: params.sessionId },
      include: {
        booking: {
          select: {
            id: true,
            startDate: true,
            endDate: true,
            unit: { select: { name: true } },
            project: { select: { name: true } },
          },
        },
      },
    });

    if (!payment || (payment.payerIdentityId !== user.identityId && !user.isAdmin)) {
      throw createPublicError('not found', 404);
    }

    return NextResponse.json({
      sessionId: payment.id,
      amountThb: payment.amountThb,
      status: payment.status,
      booking: payment.booking
        ? {
            id: payment.booking.id,
            startDate: payment.booking.startDate,
            endDate: payment.booking.endDate,
            unitName: payment.booking.unit?.name || null,
            projectName: payment.booking.project?.name || null,
          }
        : null,
    });
  } catch (error) {
    return handleError(error);
  }
}
