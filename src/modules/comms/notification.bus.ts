/**
 * In-memory pub/sub bus for real-time notifications.
 * Each identityId has a set of subscriber handlers that receive new notifications.
 * In production with multiple workers, swap for Redis pub/sub.
 */

const notificationSubscribers = new Map<
  string,
  Set<(data: any) => void>
>();

/**
 * Subscribe a handler to notifications for an identity.
 * Used by SSE stream to register client connections.
 */
export function subscribe(
  identityId: string,
  handler: (data: any) => void
): () => void {
  if (!notificationSubscribers.has(identityId)) {
    notificationSubscribers.set(identityId, new Set());
  }
  notificationSubscribers.get(identityId)!.add(handler);

  // Return unsubscribe function
  return () => {
    notificationSubscribers.get(identityId)?.delete(handler);
    if (notificationSubscribers.get(identityId)?.size === 0) {
      notificationSubscribers.delete(identityId);
    }
  };
}

/**
 * Publish a notification to all subscribers (internal use).
 */
export function publishNotification(
  identityId: string,
  notification: any
): void {
  const subscribers = notificationSubscribers.get(identityId);
  if (subscribers) {
    for (const handler of subscribers) {
      try {
        handler(notification);
      } catch (err) {
        console.error(
          'Failed to send notification to subscriber:',
          err
        );
      }
    }
  }
}

/**
 * Check if there are subscribers for an identity.
 */
export function hasSubscribers(identityId: string): boolean {
  return (
    notificationSubscribers.has(identityId) &&
    notificationSubscribers.get(identityId)!.size > 0
  );
}
