import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import * as financeService from '@/modules/finance';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { handleError, createPublicError } from '@/app/libs/errorHandler';

/**
 * POST /api/checkout/confirm
 * Confirm a pending payment and flip booking to confirmed.
 * Mock provider always confirms; a real provider webhook (signature-verified)
 * replaces this at live-payments go-live.
 *
 * Auth: the caller must be the payer of the session (or an admin) — an
 * unauthenticated confirm would let anyone mark a booking paid.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw createPublicError('unauthorized', 401);
    }

    const { sessionId } = await req.json();

    if (!sessionId || typeof sessionId !== 'string') {
      throw createPublicError('sessionId is required', 400);
    }

    const payment = await prisma.payment.findUnique({
      where: { id: sessionId },
      select: { payerIdentityId: true },
    });

    if (!payment) {
      throw createPublicError('not found', 404);
    }

    if (payment.payerIdentityId !== user.identityId && !user.isAdmin) {
      throw createPublicError('Access denied.', 403);
    }

    const result = await financeService.verifyAndConfirm(prisma, sessionId);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return handleError(error);
  }
}
