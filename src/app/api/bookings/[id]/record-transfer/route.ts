import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { can } from '@/modules/core';
import { prisma } from '@/lib/prisma';
import { recordBankTransfer } from '@/modules/finance';
import { logAudit } from '@/modules/audit';

/**
 * A staff member confirming a transfer landed in the company account.
 *
 * Deliberately staff-only, and deliberately not something the payer can do for
 * themselves: the whole rail rests on a person having actually looked at the
 * bank statement. A guest able to mark their own booking paid is not a payment
 * method, it is a free stay.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const identity = await prisma.identity.findUnique({ where: { id: user.identityId } });
  if (!identity) return NextResponse.json({ error: 'Identity not found' }, { status: 404 });

  const booking = await prisma.booking.findUnique({
    where: { id: params.id },
    select: { id: true, projectId: true, unitId: true, guestIdentityId: true },
  });
  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

  if (
    !(await can({
      identity,
      action: 'money:record_costs_on_units',
      resource: { projectId: booking.projectId, unitId: booking.unitId },
    }))
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });

  const amountThb = Number(body.amountThb);
  if (!Number.isInteger(amountThb) || amountThb <= 0) {
    return NextResponse.json({ error: 'An amount in satang is required' }, { status: 400 });
  }

  try {
    const payment = await recordBankTransfer(prisma, {
      purpose: body.purpose === 'stay_balance' ? 'stay_balance' : 'stay',
      bookingId: booking.id,
      payerIdentityId: booking.guestIdentityId,
      amountThb,
      confirmedByIdentityId: user.identityId,
      bankReference: typeof body.bankReference === 'string' ? body.bankReference : '',
    });

    await logAudit({
      actorIdentityId: user.identityId,
      action: 'money:bank_transfer_recorded',
      entityType: 'Payment',
      entityId: payment.id,
      // The amount and the reference, never the payer's name — this is money,
      // not personal data (doc 12).
      data: { bookingId: booking.id, amountThb, reference: payment.receiptRef },
    });

    return NextResponse.json({ id: payment.id, status: payment.status }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
