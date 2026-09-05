/**
 * POST /api/tm30/[id]/fail
 * Mark a TM30 filing as failed with a staff note (doc 07 F-OPS-2).
 * Staff / MC with unit scope only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { markTm30FilingFailed } from '@/modules/ops';
import { canAccessTm30Filing } from '@/app/libs/projectScope';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user?.identityId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const filing = await prisma.tm30Filing.findUnique({
      where: { id: params.id },
      include: { booking: { select: { projectId: true, unitId: true } } },
    });

    if (!filing) {
      return NextResponse.json({ error: 'Filing not found' }, { status: 404 });
    }

    if (!(await canAccessTm30Filing(user, filing.booking))) {
      return NextResponse.json(
        { error: 'Only staff or MC members with unit scope can update TM30 filings' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const failureNote = typeof body.failureNote === 'string' ? body.failureNote.trim() : '';
    if (!failureNote) {
      return NextResponse.json({ error: 'failureNote is required' }, { status: 400 });
    }

    await markTm30FilingFailed(prisma, params.id, failureNote);

    await prisma.auditLog.create({
      data: {
        action: 'failed_tm30',
        entityType: 'tm30_filing',
        entityId: params.id,
        actorIdentityId: user.identityId,
        data: { failureNote } as any,
      },
    });

    return NextResponse.json({ success: true, status: 'failed' }, { status: 200 });
  } catch (error) {
    console.error('TM30 fail error:', error);
    return NextResponse.json({ error: 'Fail operation failed' }, { status: 500 });
  }
}
