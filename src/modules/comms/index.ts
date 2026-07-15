// module: comms — public interface (see docs/14_tech_spec.md §3)
// Owns: Thread, Message, Ticket, Announcement, Notification
// Used by: all modules (notify)

export {
  createNotification,
  type CreateNotificationInput,
} from './notification.service';

export {
  findOrCreateThread,
  sendMessage,
  listThreadsFor,
  getThread,
  type ThreadParticipantInput,
  type FindOrCreateThreadInput,
} from './thread.service';

export {
  createTicket,
  listTicketsFor,
  getTicket,
  type CreateTicketInput,
} from './ticket.service';
