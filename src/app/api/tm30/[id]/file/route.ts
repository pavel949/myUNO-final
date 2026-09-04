/**
 * POST /api/tm30/[id]/file
 * Mark a TM30 filing as filed with receipt.
 * Staff only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { markTm30FilingFiled } from '@/modules/ops';
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

    // Get the filing
    const filing = await prisma.tm30Filing.findUnique({
      where: { id: params.id },
      include: { booking: { select: { projectId: true, unitId: true } } },
    });

    if (!filing) {
      return NextResponse.json({ error: 'Filing not found' }, { status: 404 });
    }

    if (!(await canAccessTm30Filing(user, filing.booking))) {
      return NextResponse.json(
        { error: 'Only staff or MC members with unit scope can file TM30' },
        { status: 403 }
      );
    }

    // Parse request body for optional receipt media
    const body = await req.json();
    const { receiptMediaId } = body;

    // Mark as filed
    await markTm30FilingFiled(prisma, params.id, user.identityId, receiptMediaId);

    // Log action
    await prisma.auditLog.create({
      data: {
        action: 'filed_tm30',
        entityType: 'tm30_filing',
        entityId: params.id,
        actorIdentityId: user.identityId,
        data: {
          receiptMediaId,
        } as any,
      },
    });

    return NextResponse.json(
      {
        success: true,
        status: 'filed',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('TM30 file error:', error);
    return NextResponse.json(
      { error: 'File operation failed' },
      { status: 500 }
    );
  }
}
