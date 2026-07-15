import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getThread, sendMessage } from '@/modules/comms';
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
    const thread = await getThread(prisma, params.threadId, user.identityId);
    return NextResponse.json({ thread });
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
    const message = await sendMessage(prisma, {
      threadId: params.threadId,
      senderIdentityId: user.identityId,
      body: body.trim(),
    });
    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes('participant')) {
      return NextResponse.json({ error: 'Resource not found.' }, { status: 404 });
    }
    return handleError(error);
  }
}
