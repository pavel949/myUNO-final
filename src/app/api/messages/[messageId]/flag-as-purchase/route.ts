import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { flagPurchaseQuestion } from '@/modules/analytics';

export async function POST(
  req: NextRequest,
  { params }: { params: { messageId: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user?.identityId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify staff role (ops, on-site host, or admin)
    const identity = await prisma.identity.findUnique({
      where: { id: user.identityId },
      select: { isAdmin: true },
    });

    const roles = await prisma.roleAssignment.findMany({
      where: {
        identityId: user.identityId,
        role: { in: ['staff_ops', 'onsite_host'] },
      },
    });

    const isStaff = identity?.isAdmin || roles.length > 0;

    if (!isStaff) {
      return NextResponse.json({ error: 'Staff access required' }, { status: 403 });
    }

    const { notes } = await req.json();

    // Find the message and its thread
    const message = await prisma.message.findUnique({
      where: { id: params.messageId },
      include: {
        thread: true,
        sender: true,
      },
    });

    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    // Flag the sender (the person who sent the message) as interested in purchasing
    if (!message.senderIdentityId) {
      return NextResponse.json(
        { error: 'Cannot flag system message' },
        { status: 400 }
      );
    }

    const signal = await flagPurchaseQuestion(
      prisma,
      message.senderIdentityId,
      user.identityId,
      notes || `Flagged from message in thread ${message.thread?.id}`
    );

    return NextResponse.json({
      success: true,
      signal,
    });
  } catch (error) {
    console.error('[Flag as purchase] Error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
