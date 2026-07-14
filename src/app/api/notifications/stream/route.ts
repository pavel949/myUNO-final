import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { subscribe } from '@/modules/comms/notification.bus';

/**
 * GET /api/notifications/stream
 * Server-Sent Events stream for real-time in-app notifications.
 * Requires authentication.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const identityId = user.identityId;

  // Set SSE headers
  const headers = new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const stream = new ReadableStream({
    start(controller) {
      // Handler for new notifications
      const handler = (notification: any) => {
        controller.enqueue(
          new TextEncoder().encode(
            `data: ${JSON.stringify(notification)}\n\n`
          )
        );
      };

      // Subscribe this stream to the notification bus
      const unsubscribe = subscribe(identityId, handler);

      // Heartbeat to keep connection alive
      const heartbeatInterval = setInterval(() => {
        controller.enqueue(new TextEncoder().encode(': heartbeat\n\n'));
      }, 30000);

      // Cleanup on disconnect
      const originalClose = controller.close.bind(controller);
      controller.close = function () {
        clearInterval(heartbeatInterval);
        unsubscribe();
        return originalClose();
      };
    },
  });

  return new NextResponse(stream, {
    headers,
    status: 200,
  });
}
