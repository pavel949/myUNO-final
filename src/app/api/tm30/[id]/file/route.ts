/**
 * POST /api/tm30/[id]/file
 * Mark a TM30 filing as filed with receipt.
 * Staff only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { markTm30FilingFiled } from '@/modules/ops';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user?.identityId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await prisma.identity.findUnique({
      where: { id: user.identityId },
    });

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get the filing
    const filing = await prisma.tm30Filing.findUnique({
      where: { id: params.id },
      include: { booking: true },
    });

    if (!filing) {
      return NextResponse.json({ error: 'Filing not found' }, { status: 404 });
    }

    // Check authorization: staff only
    const isStaff = await prisma.roleAssignment.findFirst({
      where: {
        identityId: currentUser.id,
        projectId: filing.booking.projectId,
        role: 'staff_ops',
        status: 'active',
      },
    });

    if (!isStaff) {
      return NextResponse.json(
        { error: 'Only staff can file TM30' },
        { status: 403 }
      );
    }

    // Parse request body for optional receipt media
    const body = await req.json();
    const { receiptMediaId } = body;

    // Mark as filed
    await markTm30FilingFiled(prisma, params.id, currentUser.id, receiptMediaId);

    // Log action
    await prisma.auditLog.create({
      data: {
        action: 'filed_tm30',
        entityType: 'tm30_filing',
        entityId: params.id,
        actorIdentityId: currentUser.id,
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
