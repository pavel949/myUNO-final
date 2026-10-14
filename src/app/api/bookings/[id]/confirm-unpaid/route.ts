import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { canConfirmUnpaidBooking } from '@/app/libs/bookingOperatorAccess';
import { prisma } from '@/lib/prisma';
import { confirmBooking } from '@/modules/booking';
import { outstandingStayBalanceSatang } from '@/modules/booking/outstanding-balance';

/** Commercial acceptance only. This endpoint never records receipt of money. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body.reason !== 'string' || !body.reason.trim() || body.reason.trim().length > 500 ||
      typeof body.commandId !== 'string' || !/^[A-Za-z0-9_-]{16,128}$/.test(body.commandId) ||
      typeof body.expectedUpdatedAt !== 'string' || !Number.isFinite(Date.parse(body.expectedUpdatedAt))) {
    return NextResponse.json({ error: 'A reason, command ID and current booking revision are required' }, { status: 400 });
  }
  try {
    const booking = await confirmBooking(prisma, {
      bookingId: params.id, mode: 'operator_unpaid', actorIdentityId: user.identityId,
      reason: body.reason, commandId: body.commandId, expectedUpdatedAt: new Date(body.expectedUpdatedAt),
      authorizeCandidate: (db, scope) => canConfirmUnpaidBooking(db, user.identityId, scope),
    });
    return NextResponse.json({ booking: {
      id: booking.id, status: booking.status, updatedAt: booking.updatedAt.toISOString(),
      balanceDueSatang: outstandingStayBalanceSatang(booking), holdExpiresAt: booking.holdExpiresAt,
    } });
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === 'BOOKING_FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (code === 'BOOKING_NOT_FOUND') return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    if (code === 'INVALID_CONFIRMATION') return NextResponse.json({ error: 'Invalid confirmation details' }, { status: 400 });
    if (code && ['BOOKING_STATE_CHANGED', 'BOOKING_NOT_PENDING', 'BOOKING_HOLD_EXPIRED',
      'BOOKING_DATES_BLOCKED', 'BOOKING_DATES_OCCUPIED', 'BOOKING_NOT_UNPAID', 'DOUBLE_BOOK'].includes(code)) {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Review the current booking', code,
        ...((error as { blockReason?: string }).blockReason === 'source_authority' ? { blockReason: 'source_authority' } : {}),
      }, { status: 409 });
    }
    return NextResponse.json({ error: 'Reservation confirmation failed' }, { status: 500 });
  }
}
