import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { subscribe } from '@/modules/comms/thread.bus';

/**
 * GET /api/threads/[id]/stream
 * Server-Sent Events stream of new messages in a thread.
 * Participant-only access (verified at subscription).
 * Client reconnection is the responsibility of the SSE client (exponential backoff).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const threadId = params.id;

    // Verify participant access
    const isParticipant = await prisma.threadParticipant.findUnique({
      where: {
        threadId_identityId: {
          threadId,
          identityId: user.identityId,
        },
      },
    });

    if (!isParticipant) {
      return NextResponse.json(
        { error: 'Not a participant in this thread' },
        { status: 403 }
      );
    }

    // Set up SSE response
    const encoder = new TextEncoder();
    let unsubscribe: (() => void) | null = null;

    const stream = new ReadableStream({
      start(controller) {
        // Send initial heartbeat
        controller.enqueue(encoder.encode(':heartbeat\n\n'));

        // Subscribe to new messages
        unsubscribe = subscribe(threadId, (message) => {
          const data = JSON.stringify(message);
          controller.enqueue(
            encoder.encode(`data: ${data}\n\n`)
          );
        });
      },
      cancel() {
        if (unsubscribe) {
          unsubscribe();
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Thread stream error:', message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
