import type { PrismaClient, RoleType, TicketPriority } from '@prisma/client';
import { createNotification } from './notification.service';

/**
 * Tickets (doc 09 §2): raise, list, and read with full event history —
 * reporter-visible transparency for remote owners.
 */

export interface CreateTicketInput {
  projectId: string;
  unitId?: string;
  raisedByIdentityId: string;
  raisedByRole: RoleType;
  categoryKey: string;
  title: string;
  description?: string;
  priority?: TicketPriority;
}

export async function createTicket(db: PrismaClient, input: CreateTicketInput) {
  const ticket = await db.ticket.create({
    data: {
      projectId: input.projectId,
      unitId: input.unitId,
      raisedByIdentityId: input.raisedByIdentityId,
      raisedByRole: input.raisedByRole,
      categoryKey: input.categoryKey,
      title: input.title,
      description: input.description,
      priority: input.priority || 'normal',
      status: 'open',
      events: {
        create: {
          eventType: 'status_change',
          actorIdentityId: input.raisedByIdentityId,
          data: { from: null, to: 'open' },
        },
      },
    },
  });

  // Notify staff so the ticket is picked up (N-31)
  const staff = await db.roleAssignment.findMany({
    where: { role: 'staff_ops', status: 'active' },
    select: { identityId: true },
    distinct: ['identityId'],
  });
  for (const member of staff) {
    await createNotification(db, {
      identityId: member.identityId,
      type: 'ticket_status_changed',
      titleKey: 'notify.ticket_opened.title',
      bodyKey: 'notify.ticket_opened.body',
      params: { title: input.title },
    });
  }

  return ticket;
}

export async function listTicketsFor(db: PrismaClient, identityId: string) {
  return db.ticket.findMany({
    where: { raisedByIdentityId: identityId },
    include: {
      unit: { select: { name: true } },
      project: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Reporter (or staff/admin — enforced by the caller) view with the full
 * event timeline.
 */
export async function getTicket(db: PrismaClient, ticketId: string) {
  return db.ticket.findUnique({
    where: { id: ticketId },
    include: {
      unit: { select: { name: true } },
      project: { select: { name: true } },
      events: {
        orderBy: { createdAt: 'asc' },
        include: { actor: { select: { firstName: true, lastName: true } } },
      },
    },
  });
}
