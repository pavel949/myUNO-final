import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { getTransferInstructions } from '@/modules/finance';
import { canViewTransferInstructions, resolveBookingAccess } from '@/app/libs/bookingAccess';

/**
 * Where to send the money for this booking.
 *
 * Scoped to the payer and to staff. Company bank details are not a secret, but
 * they are not something to serve to anyone who guesses a booking id either —
 * an account number and a matching amount is most of what an invoice-fraud
 * email needs.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const booking = await prisma.booking.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      unitId: true,
      projectId: true,
      guestIdentityId: true,
      totalThb: true,
      balanceDueThb: true,
      status: true,
    },
  });
  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

  const access = await resolveBookingAccess(user, {
    guestIdentityId: booking.guestIdentityId,
    projectId: booking.projectId,
    unitId: booking.unitId,
  });
  if (!canViewTransferInstructions(access)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // What is actually outstanding: a date change leaves a balance, and asking a
  // guest to transfer the full total again would be wrong by the amount they
  // already paid.
  const paid = await prisma.payment.aggregate({
    where: { bookingId: booking.id, status: 'succeeded' },
    _sum: { amountThb: true },
  });
  const outstanding = booking.totalThb + booking.balanceDueThb - (paid._sum.amountThb ?? 0);

  if (outstanding <= 0) {
    return NextResponse.json({ error: 'Nothing is outstanding on this booking' }, { status: 409 });
  }

  try {
    const instructions = await getTransferInstructions(prisma, {
      bookingId: booking.id,
      amountThb: outstanding,
      projectId: booking.projectId,
    });

    return NextResponse.json({
      ...instructions,
      expiresAt: instructions.expiresAt.toISOString(),
    });
  } catch (error) {
    const code = (error as { code?: string }).code;
    return NextResponse.json(
      { error: (error as Error).message },
      { status: code === 'TRANSFER_DISABLED' ? 409 : code === 'MERCHANT_NOT_CONFIGURED' ? 503 : 400 }
    );
  }
}
