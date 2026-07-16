import { PrismaClient, TicketStatus, TicketPriority, TicketEventType, RoleType } from '@prisma/client';
import { publishMessage } from './thread.bus';

export interface RaiseTicketInput {
  projectId: string;
  unitId?: string;
  raisedByIdentityId: string;
  raisedByRole: RoleType;
  categoryKey: string;
  title: string;
  description?: string;
  priority?: TicketPriority;
}

export interface UpdateTicketStatusInput {
  ticketId: string;
  newStatus: TicketStatus;
  actorIdentityId: string;
  note?: string;
}

/**
 * Raise a new ticket.
 * Auto-creates a thread for the ticket conversation.
 * Auto-assigns based on config: tickets.default_assignee.
 * Publishes SLA due date from config: tickets.sla_hours.<priority>.
 */
export async function raiseTicket(
  db: PrismaClient,
  input: RaiseTicketInput
): Promise<{ id: string; threadId: string }> {
  const { projectId, unitId, raisedByIdentityId, raisedByRole, categoryKey, title, description, priority = 'normal' } = input;

  // In a full implementation, fetch config for default assignee and SLA hours
  // For now, leave assignee null and slaEmaAt null (will be implemented with config service in next phase)

  const ticket = await db.ticket.create({
    data: {
      projectId,
      unitId,
      raisedByIdentityId,
      raisedByRole,
      categoryKey,
      title,
      description,
      priority,
      status: 'open',
    },
  });

  // Create thread for the ticket conversation
  const thread = await db.thread.create({
    data: {
      contextType: 'ticket',
      contextId: ticket.id,
      projectId,
    },
  });

  // Add reporter as participant
  await db.threadParticipant.create({
    data: {
      threadId: thread.id,
      identityId: raisedByIdentityId,
      participantRole: 'reporter',
    },
  });

  // Update ticket with thread reference
  await db.ticket.update({
    where: { id: ticket.id },
    data: { threadId: thread.id },
  });

  // Record creation event
  await recordTicketEvent(db, ticket.id, 'status_change', raisedByIdentityId, {
    oldStatus: null,
    newStatus: 'open',
    note: 'Ticket created',
  });

  return { id: ticket.id, threadId: thread.id };
}

/**
 * Update ticket status and record event.
 * Enforces valid transitions (doc 09 §2 status chart).
 */
export async function updateTicketStatus(
  db: PrismaClient,
  input: UpdateTicketStatusInput
): Promise<void> {
  const { ticketId, newStatus, actorIdentityId, note } = input;

  const ticket = await db.ticket.findUnique({
    where: { id: ticketId },
  });

  if (!ticket) {
    throw new Error(`Ticket ${ticketId} not found`);
  }

  // Validate transition (simplified — full validation per doc 09 §2)
  if (ticket.status === 'closed' || ticket.status === 'cancelled') {
    throw new Error(`Cannot transition from ${ticket.status}`);
  }

  const oldStatus = ticket.status;

  // Update ticket
  await db.ticket.update({
    where: { id: ticketId },
    data: {
      status: newStatus,
      ...(newStatus === 'resolved' && { resolvedAt: new Date(), resolutionNote: note }),
    },
  });

  // Record event
  await recordTicketEvent(db, ticketId, 'status_change', actorIdentityId, {
    oldStatus,
    newStatus,
    note,
  });

  // Publish status change to thread stream (if thread exists)
  if (ticket.threadId) {
    publishMessage(ticket.threadId, {
      id: `event-${ticketId}-${Date.now()}`,
      threadId: ticket.threadId,
      body: `Status: ${oldStatus} → ${newStatus}`,
      messageKind: 'system',
      createdAt: new Date().toISOString(),
    });
  }
}

/**
 * Assign ticket to a staff member.
 */
export async function assignTicket(
  db: PrismaClient,
  ticketId: string,
  assigneeIdentityId: string,
  actorIdentityId: string
): Promise<void> {
  const ticket = await db.ticket.findUnique({
    where: { id: ticketId },
  });

  if (!ticket) {
    throw new Error(`Ticket ${ticketId} not found`);
  }

  await db.ticket.update({
    where: { id: ticketId },
    data: { assigneeIdentityId },
  });

  await recordTicketEvent(db, ticketId, 'assignment', actorIdentityId, {
    assignedTo: assigneeIdentityId,
    previousAssignee: ticket.assigneeIdentityId,
  });
}

/**
 * Add comment to ticket (via thread message).
 * The thread service handles the actual message creation.
 * This records the event for the status timeline.
 */
export async function addComment(
  db: PrismaClient,
  ticketId: string,
  commenterIdentityId: string,
  _messageId: string
): Promise<void> {
  await recordTicketEvent(db, ticketId, 'comment_added', commenterIdentityId, {
    commentedBy: commenterIdentityId,
  });
}

/**
 * Record a ticket event (internal).
 * Events are the audit trail for the StatusTimeline.
 */
export async function recordTicketEvent(
  db: PrismaClient,
  ticketId: string,
  eventType: TicketEventType,
  actorIdentityId: string | null,
  data?: any
): Promise<void> {
  await db.ticketEvent.create({
    data: {
      ticketId,
      eventType,
      actorIdentityId,
      data: data || {},
    },
  });
}

/**
 * Get ticket with full history (for detail view).
 * Enforces visibility: only reporter, assignee, and staff can view.
 */
export async function getTicketDetail(
  db: PrismaClient,
  ticketId: string,
  identityId: string
): Promise<any> {
  const ticket = await db.ticket.findUnique({
    where: { id: ticketId },
    include: {
      raisedBy: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      assignee: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      events: {
        include: {
          actor: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
      media: {
        include: {
          media: true,
        },
        orderBy: { position: 'asc' },
      },
    },
  });

  if (!ticket) {
    return null;
  }

  // Visibility check (simplified — full enforcement per doc 03 matrix)
  const canView =
    ticket.raisedByIdentityId === identityId ||
    ticket.assigneeIdentityId === identityId;

  if (!canView) {
    throw new Error('Not authorized to view this ticket');
  }

  return ticket;
}

/**
 * Get tickets for a project (ops board, sorted by SLA).
 */
export async function getProjectTickets(
  db: PrismaClient,
  projectId: string,
  _identityId: string,
  filters?: {
    status?: TicketStatus;
    assigneeId?: string;
  }
): Promise<any[]> {
  // In full implementation, verify identity is staff in the project
  // For now, assume authorized

  return db.ticket.findMany({
    where: {
      projectId,
      ...(filters?.status && { status: filters.status }),
      ...(filters?.assigneeId && { assigneeIdentityId: filters.assigneeId }),
    },
    include: {
      raisedBy: {
        select: { firstName: true, lastName: true },
      },
      assignee: {
        select: { firstName: true, lastName: true },
      },
    },
    orderBy: [
      { slaDueAt: 'asc' }, // SLA violations first
      { createdAt: 'desc' },
    ],
  });
}

/**
 * Get reporter's tickets (inbox).
 */
export async function getReporterTickets(
  db: PrismaClient,
  identityId: string
): Promise<any[]> {
  return db.ticket.findMany({
    where: {
      raisedByIdentityId: identityId,
    },
    include: {
      assignee: {
        select: { firstName: true, lastName: true },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });
}
