import { canAccessThread } from '@/modules/comms/statement-thread-access';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { subscribeThread as subscribe } from '@/modules/comms';
import { handleError, createPublicError } from '@/app/libs/errorHandler';

/** SSE authorizes at subscription and before every event, so an open stream
 * rechecks financial-statement authority before emitting any message.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { threadId: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) throw createPublicError('unauthorized', 401);
    const threadId = params.threadId;
    if (!(await canAccessThread(prisma, threadId, user.identityId))) {
      throw createPublicError('not found', 404);
    }

    const encoder = new TextEncoder();
    let unsubscribe: (() => void) | null = null;
    let closed = false;
    let pending = Promise.resolve();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(':heartbeat\n\n'));
        const close = () => {
          if (closed) return;
          closed = true;
          unsubscribe?.();
          controller.close();
        };
        unsubscribe = subscribe(threadId, message => {
          // Serialize asynchronous checks to preserve event order. Errors fail
          // closed and are caught here because the in-memory bus is synchronous.
          pending = pending.then(async () => {
            if (closed) return;
            if (!(await canAccessThread(prisma, threadId, user.identityId))) {
              close();
              return;
            }
            if (!closed) controller.enqueue(encoder.encode(`data: ${JSON.stringify(message)}\n\n`));
          }).catch(close);
        });
      },
      cancel() {
        closed = true;
        unsubscribe?.();
      },
    });
    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'private, no-store',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
