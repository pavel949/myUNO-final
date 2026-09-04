import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/app/libs/onboardingGuard';
import { decideDispute } from '@/modules/comms';
import { logAudit } from '@/modules/audit';
import { handleError, createPublicError } from '@/app/libs/errorHandler';

/**
 * POST /api/admin/disputes/[id]/decide — record the admin's written
 * decision and move the money it calls for, if any (doc 07 F-DIS-2).
 * Body: { resolutionAmountThb?, decisionNote }
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.error;

    const body = await req.json();
    const { resolutionAmountThb, decisionNote } = body ?? {};

    if (!decisionNote || typeof decisionNote !== 'string') {
      throw createPublicError('invalid request: decisionNote is required', 400);
    }
    if (
      resolutionAmountThb !== undefined &&
      (!Number.isInteger(resolutionAmountThb) || resolutionAmountThb < 0)
    ) {
      throw createPublicError(
        'invalid request: resolutionAmountThb must be a non-negative integer number of satang',
        400
      );
    }

    const dispute = await decideDispute(prisma, {
      disputeId: params.id,
      decidedByIdentityId: guard.actorIdentityId,
      resolutionAmountThb,
      decisionNote: decisionNote.slice(0, 2000),
    });

    await logAudit({
      actorIdentityId: guard.actorIdentityId,
      action: 'disputes:decide',
      entityType: 'Dispute',
      entityId: dispute.id,
      data: {
        resolutionAmountThb: dispute.resolutionAmountThb,
        refundId: dispute.refundId,
        ledgerEntryId: dispute.ledgerEntryId,
      },
    });

    return NextResponse.json({ dispute });
  } catch (error) {
    return handleError(error);
  }
}
