import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { can } from '@/modules/core';
import { prisma } from '@/lib/prisma';
import { approveClaim, rejectClaim } from '@/modules/finance';
import { logAudit } from '@/modules/audit';

/**
 * Adjudicate a damage claim (doc 07 F-DIS-1).
 *
 * Approving captures money from a guest's card; rejecting releases it. Both are
 * money decisions with a named human behind them, so both are audited and both
 * carry the resolution note into the record.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const identity = await prisma.identity.findUnique({ where: { id: user.identityId } });
  if (!identity) return NextResponse.json({ error: 'Identity not found' }, { status: 404 });

  if (
    !(await can({
      identity,
      action: 'money:issue_refunds_outside_policy',
      resource: { resourceType: 'platform' },
    }))
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const decision = body?.decision;
  const note = typeof body?.resolutionNote === 'string' ? body.resolutionNote.trim() : undefined;

  if (decision !== 'approve' && decision !== 'reject') {
    return NextResponse.json({ error: 'decision must be approve or reject' }, { status: 400 });
  }

  // Taking a guest's money without saying why leaves nothing to show them when
  // they ask, and nothing to defend later.
  if (decision === 'approve' && !note) {
    return NextResponse.json(
      { error: 'A note is required when approving a claim' },
      { status: 400 }
    );
  }

  try {
    const claim =
      decision === 'approve'
        ? await approveClaim(prisma, params.id, note)
        : await rejectClaim(prisma, params.id, note);

    await logAudit({
      actorIdentityId: user.identityId,
      action: decision === 'approve' ? 'money:deposit_claim_approved' : 'money:deposit_claim_rejected',
      entityType: 'DepositClaim',
      entityId: params.id,
      data: { claimedAmountThb: claim.claimedAmountThb },
    });

    return NextResponse.json({ status: claim.status });
  } catch (error) {
    const code = (error as { code?: string }).code;
    return NextResponse.json(
      { error: (error as Error).message },
      { status: code === 'WINDOW_CLOSED' || code === 'ALREADY_RESOLVED' ? 409 : 400 }
    );
  }
}
