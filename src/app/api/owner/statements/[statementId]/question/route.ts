/**
 * POST /api/owner/statements/[statementId]/question
 * Start or continue a statement question thread (doc 07 F-OWN-3, F-COM-1).
 * Owner-only; links thread to statement via contextType=statement.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { findOrCreateThread, sendMessage } from '@/modules/comms';
import { OWNER_VISIBLE_STATEMENT_STATUSES } from '@/modules/finance';
import { handleError, createPublicError } from '@/app/libs/errorHandler';

export async function POST(
  req: NextRequest,
  { params }: { params: { statementId: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user?.identityId) {
      throw createPublicError('unauthorized', 401);
    }

    const body = await req.json().catch(() => ({}));
    const messageBody = typeof body.body === 'string' ? body.body.trim() : '';
    if (!messageBody) {
      throw createPublicError('invalid request: message body is required', 400);
    }

    const statement = await prisma.ownerStatement.findFirst({
      where: {
        id: params.statementId,
        ownerIdentityId: user.identityId,
        status: { in: OWNER_VISIBLE_STATEMENT_STATUSES },
      },
      include: {
        unit: { select: { projectId: true, name: true } },
      },
    });

    if (!statement) {
      throw createPublicError('not found', 404);
    }

    const participantIds = new Set<string>([user.identityId]);
    const participantRoles: Record<string, string> = {
      [user.identityId]: 'owner',
    };

    const staff = await prisma.roleAssignment.findMany({
      where: {
        role: 'staff_ops',
        status: 'active',
        projectId: statement.unit.projectId,
      },
      select: { identityId: true },
      distinct: ['identityId'],
    });
    for (const member of staff) {
      participantIds.add(member.identityId);
      participantRoles[member.identityId] = 'staff_ops';
    }

    const admins = await prisma.identity.findMany({
      where: { isAdmin: true, status: 'active' },
      select: { id: true },
    });
    for (const admin of admins) {
      participantIds.add(admin.id);
      participantRoles[admin.id] = 'admin';
    }

    const { id: threadId } = await findOrCreateThread(prisma, {
      contextType: 'statement',
      contextId: statement.id,
      projectId: statement.unit.projectId,
      participantIdentityIds: Array.from(participantIds),
      participantRoles,
    });

    const messageId = await sendMessage(prisma, {
      threadId,
      senderIdentityId: user.identityId,
      body: messageBody,
    });

    if (!messageId) {
      throw createPublicError('Could not send message', 500);
    }

    return NextResponse.json({ threadId }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
