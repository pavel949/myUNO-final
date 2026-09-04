import { PrismaClient, TicketStatus, TicketPriority, TicketEventType, RoleType } from '@prisma/client';
import { assertCatalogKeys, getConfig, type ConfigKey } from '@/modules/config';
import { publishMessage } from './thread.bus';
import { track } from '@/modules/analytics';

const SLA_HOURS_BY_PRIORITY: Record<TicketPriority, ConfigKey> = {
  urgent: 'tickets.sla_hours.urgent',
  high: 'tickets.sla_hours.high',
  normal: 'tickets.sla_hours.normal',
  low: 'tickets.sla_hours.low',
};

const DEFAULT_SLA_HOURS: Record<TicketPriority, number> = {
  urgent: 4,
  high: 24,
  normal: 72,
  low: 168,
};

async function resolveTicketSlaDueAt(
  db: PrismaClient,
  projectId: string,
  unitId: string | undefined,
  priority: TicketPriority
): Promise<Date> {
  const configuredHours = await getConfig(db, SLA_HOURS_BY_PRIORITY[priority], { projectId, unitId });
  const slaHours =
    typeof configuredHours === 'number' ? configuredHours : DEFAULT_SLA_HOURS[priority];
  return new Date(Date.now() + slaHours * 60 * 60 * 1000);
}

async function resolveDefaultAssigneeIdentityId(
  db: PrismaClient,
  projectId: string
): Promise<string | null> {
  const assigneeMode =
    (await getConfig(db, 'tickets.default_assignee', { projectId })) ?? 'project_ops_lead';
  if (assigneeMode === 'unassigned') {
    return null;
  }

  const opsLead = await db.roleAssignment.findFirst({
    where: {
      projectId,
      role: 'staff_ops',
      status: 'active',
    },
    select: { identityId: true },
    orderBy: { createdAt: 'asc' },
  });

  return opsLead?.identityId ?? null;
}

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

const ALLOWED_TICKET_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  open: ['acknowledged', 'cancelled'],
  acknowledged: ['in_progress', 'cancelled'],
  in_progress: ['waiting_reporter', 'resolved', 'cancelled'],
  waiting_reporter: ['in_progress', 'cancelled'],
  resolved: ['closed', 'in_progress'],
  closed: [],
  cancelled: [],
};

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

  // Category must exist in the doc 04 §8 catalog (DM-3)
  await assertCatalogKeys(db, 'catalog.ticket_categories', categoryKey, { projectId });

  const [slaDueAt, assigneeIdentityId] = await Promise.all([
    resolveTicketSlaDueAt(db, projectId, unitId, priority),
    resolveDefaultAssigneeIdentityId(db, projectId),
  ]);

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
      slaDueAt,
      assigneeIdentityId,
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

  if (assigneeIdentityId) {
    await recordTicketEvent(db, ticket.id, 'assignment', raisedByIdentityId, {
      assignedTo: assigneeIdentityId,
      previousAssignee: null,
      autoAssigned: true,
    });
  }

  // Track analytics event for ticket raised
  await track(db, 'ticket_raised', {
    projectId,
    unitId,
    identityId: raisedByIdentityId,
    ticketId: ticket.id,
    category: categoryKey,
    priority,
  }).catch(() => null);

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
  const { ticketId, newStatus, actorIdentityId } = input;
  const note = input.note?.trim();

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
  const allowedTargets = ALLOWED_TICKET_TRANSITIONS[oldStatus];
  if (!allowedTargets.includes(newStatus)) {
    throw new Error(`invalid transition: ${oldStatus} -> ${newStatus}`);
  }

  if (newStatus === 'resolved' && !note) {
    throw new Error('invalid request: resolution note required for resolved status');
  }

  // Update ticket
  const updatePayload: {
    status: TicketStatus;
    resolvedAt?: Date | null;
    resolutionNote?: string | null;
  } = { status: newStatus };

  if (newStatus === 'resolved') {
    updatePayload.resolvedAt = new Date();
    updatePayload.resolutionNote = note;
  } else if (oldStatus === 'resolved' && newStatus === 'in_progress') {
    // Re-opened after reporter feedback: previous resolution no longer applies.
    updatePayload.resolvedAt = null;
    updatePayload.resolutionNote = null;
  }

  await db.ticket.update({
    where: { id: ticketId },
    data: updatePayload,
  });

  // Record event
  await recordTicketEvent(db, ticketId, 'status_change', actorIdentityId, {
    oldStatus,
    newStatus,
    note,
  });

  // Track analytics event if resolved
  if (newStatus === 'resolved') {
    await track(db, 'ticket_resolved', {
      ticketId,
      projectId: ticket.projectId,
      unitId: ticket.unitId ?? undefined,
      identityId: ticket.raisedByIdentityId,
      actorIdentityId,
      category: ticket.categoryKey,
      priority: ticket.priority,
    }).catch(() => null);
  }

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

/**
 * Check for SLA breaches and track analytics events.
 * Called by cron job to detect tickets where slaDueAt has passed while still open.
 */
export async function checkAndTrackSLABreaches(db: PrismaClient): Promise<number> {
  const now = new Date();

  const activeStatuses: TicketStatus[] = [
    'open',
    'acknowledged',
    'in_progress',
    'waiting_reporter',
  ];

  // Find active tickets with slaDueAt in the past that have not yet been escalated.
  const breachedTickets = await db.ticket.findMany({
    where: {
      status: { in: activeStatuses },
      slaDueAt: { lt: now },
      events: {
        none: {
          eventType: 'sla_escalation',
        },
      },
    },
    select: {
      id: true,
      projectId: true,
      unitId: true,
      raisedByIdentityId: true,
      categoryKey: true,
      priority: true,
      slaDueAt: true,
      createdAt: true,
    },
  });

  let breachedCount = 0;

  for (const ticket of breachedTickets) {
    // Calculate hours to resolve (from creation to now, but should have been resolved by slaDueAt)
    const hoursElapsed = (now.getTime() - ticket.createdAt.getTime()) / (1000 * 60 * 60);

    await recordTicketEvent(db, ticket.id, 'sla_escalation', null, {
      escalatedAt: now.toISOString(),
      priority: ticket.priority,
      hoursElapsed: Math.round(hoursElapsed),
    });

    // Track the SLA breach event
    await track(db, 'ticket_sla_breached', {
      ticketId: ticket.id,
      projectId: ticket.projectId,
      unitId: ticket.unitId ?? undefined,
      identityId: ticket.raisedByIdentityId,
      category: ticket.categoryKey,
      priority: ticket.priority,
      hoursToSLA: Math.round(hoursElapsed),
    }).catch(() => null);

    breachedCount++;
  }

  return breachedCount;
}

/**
 * Auto-close resolved tickets after configured grace period (doc 09 §3).
 */
export async function autoCloseResolvedTickets(
  db: PrismaClient,
  autoCloseResolvedDays: number,
  now: Date = new Date()
): Promise<number> {
  const graceDays = Math.max(0, Math.floor(autoCloseResolvedDays));
  const closeBefore = new Date(now.getTime() - graceDays * 24 * 60 * 60 * 1000);

  const staleResolvedTickets = await db.ticket.findMany({
    where: {
      status: 'resolved',
      resolvedAt: { not: null, lte: closeBefore },
    },
    select: {
      id: true,
      threadId: true,
    },
  });

  for (const ticket of staleResolvedTickets) {
    await db.ticket.update({
      where: { id: ticket.id },
      data: { status: 'closed' },
    });

    await recordTicketEvent(db, ticket.id, 'status_change', null, {
      oldStatus: 'resolved',
      newStatus: 'closed',
      note: 'Auto-closed after resolution grace period',
    });

    if (ticket.threadId) {
      publishMessage(ticket.threadId, {
        id: `event-${ticket.id}-${Date.now()}`,
        threadId: ticket.threadId,
        body: 'Status: resolved → closed',
        messageKind: 'system',
        createdAt: new Date().toISOString(),
      });
    }
  }

  return staleResolvedTickets.length;
}
