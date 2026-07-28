import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { can } from '@/modules/core';

/**
 * POST /api/bookings/[id]/internal-note (LY-9)
 * Set the staff-only internal note on a booking. The guest's own note
 * (guest_note) is never editable from here — it is the guest's words.
 *
 * Permission: stays:record_checkin_checkout_and_reports — the staff/ops
 * action closest to operational booking annotations (admin bypasses).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const identity = await prisma.identity.findUnique({
      where: { id: user.identityId },
    });
    if (!identity) {
      return NextResponse.json({ error: 'Identity not found' }, { status: 404 });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: params.id },
      select: { id: true, unitId: true, projectId: true },
    });
    if (!booking) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const allowed = await can({
      identity,
      action: 'stays:record_checkin_checkout_and_reports',
      resource: { resourceType: 'unit', unitId: booking.unitId, projectId: booking.projectId },
    });
    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const internalNote = typeof body.internalNote === 'string' ? body.internalNote : '';

    await prisma.booking.update({
      where: { id: booking.id },
      data: { internalNote: internalNote || null },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
