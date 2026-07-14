// module: comms — public interface (see docs/14_tech_spec.md §3)
// Owns: Notifications, threads, tickets, announcements (loop 2+)
// Depends on: core, finance (for order notifications)

export {
  createNotification,
  markNotificationRead,
  getUnreadNotifications,
  getRecentNotifications,
  isNotificationMuted,
  setNotificationMute,
  type CreateNotificationInput,
} from './comms.service';

export {
  subscribe,
  publishNotification,
  hasSubscribers,
} from './notification.bus';

export {
  findOrCreateThread,
  sendMessage,
  markThreadRead,
  getThreadsForIdentity,
  getThreadMessages,
  addSystemMessage,
  getUnreadCounts,
  type CreateThreadInput,
  type SendMessageInput,
} from './thread.service';

export {
  subscribe as subscribeThread,
  publishMessage,
  hasSubscribers as hasThreadSubscribers,
} from './thread.bus';
