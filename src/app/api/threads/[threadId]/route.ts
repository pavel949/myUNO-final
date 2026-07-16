import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getThreadMessages, markThreadRead, sendMessage } from '@/modules/comms';
import { handleError, createPublicError } from '@/app/libs/errorHandler';

/** GET /api/threads/[threadId] — full thread; participant-only; marks read. */
export async function GET(
  _req: NextRequest,
  { params }: { params: { threadId: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw createPublicError('unauthorized', 401);
    }

    // Participant guard lives in getThreadMessages
    const messages = await getThreadMessages(prisma, params.threadId, user.identityId, 100);
    await markThreadRead(prisma, params.threadId, user.identityId);

    const participants = await prisma.threadParticipant.findMany({
      where: { threadId: params.threadId },
      include: { identity: { select: { id: true, firstName: true, lastName: true } } },
    });

    return NextResponse.json({
      thread: {
        id: params.threadId,
        participants,
        messages: [...messages].reverse(), // service returns newest-first
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('participant')) {
      return NextResponse.json({ error: 'Resource not found.' }, { status: 404 });
    }
    return handleError(error);
  }
}

/** POST /api/threads/[threadId] — send a message; participant-only. */
export async function POST(
  req: NextRequest,
  { params }: { params: { threadId: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw createPublicError('unauthorized', 401);
    }
    const { body } = await req.json();
    if (!body || typeof body !== 'string' || !body.trim()) {
      throw createPublicError('invalid request: message body is required', 400);
    }

    // sendMessage does not guard sender membership itself — verify here
    const membership = await prisma.threadParticipant.findUnique({
      where: {
        threadId_identityId: { threadId: params.threadId, identityId: user.identityId },
      },
    });
    if (!membership) {
      return NextResponse.json({ error: 'Resource not found.' }, { status: 404 });
    }

    const message = await sendMessage(prisma, {
      threadId: params.threadId,
      senderIdentityId: user.identityId,
      body: body.trim(),
    });
    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
