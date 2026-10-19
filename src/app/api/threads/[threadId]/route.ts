import { sendHumanReply } from '@/modules/comms/thread.service';
import { getAuthorizedThreadParticipants, requireThreadAccess } from '@/modules/comms/statement-thread-access';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getThreadMessages, markThreadRead } from '@/modules/comms';
import { handleError, createPublicError } from '@/app/libs/errorHandler';

/** GET /api/threads/[threadId] — full thread; participant-only; marks read. */
export async function GET(_req: NextRequest, props: { params: Promise<{ threadId: string }> }) {
  const params = await props.params;
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw createPublicError('unauthorized', 401);
    }

    // Participant guard lives in getThreadMessages
    const messages = await getThreadMessages(prisma, params.threadId, user.identityId, 100);
    // Only acknowledge messages actually included in this response. A reply
    // arriving after the query must remain unread, even if marking is delayed.
    await markThreadRead(prisma, params.threadId, user.identityId, messages[0]?.createdAt ?? new Date(0));

    const thread = await prisma.thread.findUniqueOrThrow({ where: { id: params.threadId } });
    const participants = await getAuthorizedThreadParticipants(prisma, thread);

    return NextResponse.json({
      thread: {
        id: params.threadId,
        participants: participants.map(participant => ({
          ...participant,
          // Authority checks need status/admin flags; the public DTO does not.
          identity: {
            id: participant.identity.id,
            firstName: participant.identity.firstName,
            lastName: participant.identity.lastName,
          },
        })),
        messages: [...messages].reverse().map(message => ({
          id: message.id,
          body: message.body,
          messageKind: message.messageKind,
          createdAt: message.createdAt,
          sender: message.sender ? {
            id: message.sender.id,
            firstName: message.sender.firstName,
            lastName: message.sender.lastName,
          } : null,
        })), // service returns newest-first; account contacts stay private
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
export async function POST(req: NextRequest, props: { params: Promise<{ threadId: string }> }) {
  const params = await props.params;
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw createPublicError('unauthorized', 401);
    }
    const input = await req.json().catch(() => null);
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw createPublicError('invalid_request', 400);
    const { body, requestId } = input;
    if (requestId !== undefined && (typeof requestId !== 'string' || !/^[a-zA-Z0-9_-]{16,128}$/.test(requestId))) throw createPublicError('invalid_request_id', 400);
    if (!body || typeof body !== 'string' || !body.trim() || body.length > 4000) {
      throw createPublicError('invalid request: message body is required', 400);
    }

    await requireThreadAccess(prisma, params.threadId, user.identityId);

    const message = await sendHumanReply(prisma, {
      threadId: params.threadId,
      senderIdentityId: user.identityId,
      body: body.trim(),
      requestId,
    });
    if (!message) throw createPublicError('not found', 404);
    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
