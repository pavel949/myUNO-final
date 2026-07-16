/**
 * In-memory pub/sub bus for real-time thread messages.
 * Each threadId has a set of subscriber handlers that receive new messages.
 * In production with multiple workers, swap for Redis pub/sub.
 */

const threadSubscribers = new Map<
  string,
  Set<(data: any) => void>
>();

/**
 * Subscribe a handler to messages for a thread.
 * Used by SSE stream to register client connections.
 */
export function subscribe(
  threadId: string,
  handler: (data: any) => void
): () => void {
  if (!threadSubscribers.has(threadId)) {
    threadSubscribers.set(threadId, new Set());
  }
  threadSubscribers.get(threadId)!.add(handler);

  // Return unsubscribe function
  return () => {
    threadSubscribers.get(threadId)?.delete(handler);
    if (threadSubscribers.get(threadId)?.size === 0) {
      threadSubscribers.delete(threadId);
    }
  };
}

/**
 * Publish a message to all subscribers in a thread.
 */
export function publishMessage(
  threadId: string,
  message: any
): void {
  const subscribers = threadSubscribers.get(threadId);
  if (subscribers) {
    for (const handler of subscribers) {
      try {
        handler(message);
      } catch (err) {
        console.error(
          'Failed to send message to thread subscriber:',
          err
        );
      }
    }
  }
}

/**
 * Check if there are subscribers for a thread.
 */
export function hasSubscribers(threadId: string): boolean {
  return (
    threadSubscribers.has(threadId) &&
    threadSubscribers.get(threadId)!.size > 0
  );
}
