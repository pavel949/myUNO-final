import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { disputeDepositClaim } from '@/modules/finance';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/modules/audit';
import type { RoleType } from '@prisma/client';

/**
 * POST /api/deposit-claims/[id]/dispute
 * Guest disputes a filed damage claim (doc 07 F-DIS-1 → F-DIS-2).
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.title?.trim() || !body?.description?.trim()) {
    return NextResponse.json({ error: 'title and description are required' }, { status: 400 });
  }

  const raisedByRole =
    user.roles.find((r) => r.role === 'guest')?.role ?? ('guest' as RoleType);

  try {
    const claim = await disputeDepositClaim(prisma, {
      claimId: params.id,
      guestIdentityId: user.identityId,
      raisedByRole: raisedByRole as RoleType,
      title: String(body.title).trim().slice(0, 200),
      description: String(body.description).trim().slice(0, 4000),
    });

    await logAudit({
      actorIdentityId: user.identityId,
      action: 'money:deposit_claim_disputed',
      entityType: 'DepositClaim',
      entityId: claim.id,
      data: { bookingId: claim.bookingId },
    });

    return NextResponse.json({ id: claim.id, status: claim.status }, { status: 200 });
  } catch (error) {
    const code = (error as { code?: string }).code;
    return NextResponse.json(
      { error: (error as Error).message },
      { status: code === 'NOT_DISPUTABLE' ? 409 : 400 }
    );
  }
}
