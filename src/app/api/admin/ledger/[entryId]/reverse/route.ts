/**
 * POST /api/admin/ledger/[entryId]/reverse
 * Reverse a manually recorded cost (admin only).
 *
 * Append-only: a linked reversal row is created; the original is never touched.
 * One cost has at most one reversal — a second attempt, concurrent or later, is
 * a 409. Only the four manual cost kinds are reversible here; every other kind
 * of ledger entry has its own correction process.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/app/libs/onboardingGuard';
import { LedgerCorrectionError, reverseManualCost } from '@/modules/finance';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ entryId: string }> }) {
  try {
    const { entryId } = await params;
    const guard = await requireAdmin();
    if (!guard.ok) return guard.error;

    const body = await req.json().catch(() => null);
    const reason = body && typeof body.reason === 'string' ? body.reason : '';
    if (!reason.trim()) {
      return NextResponse.json({ error: 'Reversal reason required' }, { status: 400 });
    }

    const { reversal, dating } = await reverseManualCost(prisma, {
      entryId,
      reason,
      actorIdentityId: guard.actorIdentityId,
    });

    return NextResponse.json(
      {
        id: reversal.id,
        reversesEntryId: entryId,
        entryType: reversal.entryType,
        amountThb: reversal.amountThb,
        description: reversal.description,
        occurredOn: reversal.occurredOn,
        createdAt: reversal.createdAt,
        dating,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof LedgerCorrectionError) {
      const status =
        error.code === 'not_found' ? 404 : error.code === 'invalid_reason' ? 400 : 409;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    console.error('Ledger reversal error:', error);
    return NextResponse.json({ error: 'Reversal failed' }, { status: 500 });
  }
}
