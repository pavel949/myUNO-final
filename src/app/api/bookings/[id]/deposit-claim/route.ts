import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { canWithAccess } from '@/modules/core/authority.service';
import { prisma } from '@/lib/prisma';
import { fileDepositClaim } from '@/modules/finance';
import { logAudit } from '@/modules/audit';

/** File a damage claim against a finished stay (doc 07 F-DIS-1). */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const identity = await prisma.identity.findUnique({ where: { id: user.identityId } });
  if (!identity) return NextResponse.json({ error: 'Identity not found' }, { status: 404 });

  const booking = await prisma.booking.findUnique({
    where: { id: params.id },
    select: { id: true, projectId: true, unitId: true },
  });
  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

  const allowed = await canWithAccess(prisma, {
    identity,
    action: 'stays:record_checkin_checkout_and_reports',
    requiredAccess: 'allow',
    resource: { projectId: booking.projectId, unitId: booking.unitId },
  });
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });

  if (typeof body.description !== 'string' || !body.description.trim()) {
    return NextResponse.json({ error: 'A description of the damage is required' }, { status: 400 });
  }

  try {
    const claim = await fileDepositClaim(prisma, {
      bookingId: params.id,
      claimantIdentityId: user.identityId,
      description: body.description.trim(),
      claimedAmountThb: Number(body.claimedAmountThb),
      evidenceMediaIds: Array.isArray(body.evidenceMediaIds) ? body.evidenceMediaIds : [],
    });

    await logAudit({
      actorIdentityId: user.identityId,
      action: 'money:deposit_claim_filed',
      entityType: 'DepositClaim',
      entityId: claim.id,
      data: { bookingId: params.id, claimedAmountThb: claim.claimedAmountThb },
    });

    return NextResponse.json({ id: claim.id, status: claim.status }, { status: 201 });
  } catch (error) {
    const code = (error as { code?: string }).code;
    return NextResponse.json(
      { error: (error as Error).message },
      { status: code === 'WINDOW_CLOSED' ? 409 : 400 }
    );
  }
}
