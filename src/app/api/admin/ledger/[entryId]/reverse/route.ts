/**
 * POST /api/admin/ledger/[entryId]/reverse
 * Reverse a ledger entry (admin only).
 * Creates an append-only reversal entry instead of updating the original.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { reverseLedgerEntry } from '@/modules/finance';

export async function POST(req: NextRequest, { params }: { params: Promise<{ entryId: string }> }) {
  try {
    const { entryId } = await params;
    const user = await getCurrentUser();
    if (!user?.identityId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify admin role
    const isAdmin = await prisma.identity.findUnique({
      where: { id: user.identityId },
      select: { isAdmin: true },
    });

    if (!isAdmin?.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { reason } = body;

    if (!reason) {
      return NextResponse.json({ error: 'Reversal reason required' }, { status: 400 });
    }

    const reversal = await reverseLedgerEntry(prisma, entryId, reason, user.identityId);

    // Audit log the reversal
    await prisma.auditLog.create({
      data: {
        action: 'ledger_entry_reversed',
        entityType: 'ledger_entry',
        entityId: entryId,
        actorIdentityId: user.identityId,
        data: {
          reversalEntryId: reversal.id,
          reason,
        } as any,
      },
    });

    return NextResponse.json(
      {
        id: reversal.id,
        entryType: reversal.entryType,
        amountThb: reversal.amountThb,
        description: reversal.description,
        occurredOn: reversal.occurredOn,
        createdAt: reversal.createdAt,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Ledger reversal error:', error);
    return NextResponse.json({ error: 'Reversal failed' }, { status: 500 });
  }
}
