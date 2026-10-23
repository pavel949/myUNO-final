import { getBookingThreadParticipants } from './booking-thread-access';
import { materializeInquiryThreadAudience } from './inquiry-thread-access';
import type { PrismaClient, Thread } from '@prisma/client';
import { OWNER_VISIBLE_STATEMENT_STATUSES } from '@/modules/finance/statement-signoff.service';
import { standaloneTicketAuthority } from './standalone-ticket-access';

export async function getStatementThreadParticipants(db: PrismaClient, statementId: string) {
  const statement = await db.ownerStatement.findFirst({
    where: { id: statementId, status: { in: OWNER_VISIBLE_STATEMENT_STATUSES } },
    select: { ownerIdentityId: true, unit: { select: { projectId: true } } },
  });
  if (!statement) return null;
  const identities = await db.identity.findMany({
    where: { status: 'active', OR: [{ id: statement.ownerIdentityId }, { isAdmin: true }] },
    select: { id: true, isAdmin: true },
  });
  const participantRoles: Record<string, string> = {};
  for (const identity of identities) {
    participantRoles[identity.id] = identity.id === statement.ownerIdentityId ? 'owner' : 'admin';
  }
  return {
    projectId: statement.unit.projectId,
    participantIdentityIds: identities.map(identity => identity.id),
    participantRoles,
  };
}

export function hasLiveThreadAuthority(thread: Pick<Thread, 'contextType' | 'contextId'>): boolean {
  return thread.contextType === 'statement' || thread.contextType === 'booking' || thread.contextType === 'ticket' ||
    (thread.contextType === 'general' && Boolean(thread.contextId?.startsWith('lead-')));
}

/** Financial, inquiry and booking conversations use live contextual authority.
 * Other contexts retain their existing policy until separately reviewed. */
export async function getAuthorizedThreadParticipants(db: PrismaClient, thread: Pick<Thread, 'id' | 'contextType' | 'contextId'>) {
  const ticket = thread.contextType === 'ticket' && thread.contextId
    ? await db.ticket.findUnique({ where: { id: thread.contextId }, select: {
      projectId: true, serviceOrderId: true, responsibleOrganizationId: true, raisedByIdentityId: true,
    } }) : null;
  if (thread.contextType === 'ticket' && !ticket) return [];
  if (ticket?.projectId === null && ticket.responsibleOrganizationId && ticket.serviceOrderId) {
    const staff = await db.identity.findMany({
      where: { status: 'active', OR: [
        { isAdmin: true },
        { roleAssignments: { some: {
          status: 'active', role: 'staff_ops', scopeType: 'platform', organizationId: ticket.responsibleOrganizationId,
          projectId: null, unitId: null, providerId: null,
        } } },
      ] }, select: { id: true, isAdmin: true },
    });
    for (const identity of staff) {
      if (!identity.isAdmin && !(await standaloneTicketAuthority(db, ticket, identity.id)).canManage) continue;
      // Inbox renders, unread requests and prefetches can discover the same
      // newly authorized participant concurrently. Empty-update Prisma upserts
      // can use read-then-create and race on the composite unique constraint.
      // ON CONFLICT DO NOTHING preserves existing roles/read state atomically.
      await db.threadParticipant.createMany({
        data: { threadId: thread.id, identityId: identity.id, participantRole: identity.isAdmin ? 'admin' : 'staff_ops' },
        skipDuplicates: true,
      });
    }
  }
  const inquiry = thread.contextType === 'general' && thread.contextId?.startsWith('lead-');
  const inquiryAudience = inquiry ? await materializeInquiryThreadAudience(db, thread) : null;
  const participants = await db.threadParticipant.findMany({
    where: { threadId: thread.id },
    include: { identity: { select: { id: true, firstName: true, lastName: true, status: true, isAdmin: true } } },
  });
  if (ticket?.projectId === null) {
    const allowed = await Promise.all(participants.map(async participant => {
      if (participant.identity.status !== 'active') return false;
      if (participant.identity.isAdmin || participant.identityId === ticket.raisedByIdentityId) return true;
      return (await standaloneTicketAuthority(db, ticket, participant.identityId)).canView;
    }));
    return participants.filter((_, index) => allowed[index]);
  }
  if (inquiry) {
    return participants.filter(participant => participant.identity.status === 'active' &&
      (participant.participantRole === 'inquirer' ||
        (inquiryAudience ? inquiryAudience.participantIdentityIds.includes(participant.identityId) :
          participant.participantRole === 'admin' && participant.identity.isAdmin)));
  }
  if (thread.contextType === 'booking') {
    if (!thread.contextId || !await db.booking.findUnique({ where: { id: thread.contextId }, select: { id: true } })) return [];
    const audience = await getBookingThreadParticipants(db, thread.contextId);
    return participants.filter(participant => audience.participantIdentityIds.includes(participant.identityId));
  }
  if (thread.contextType !== 'statement') return participants;
  const audience = thread.contextId ? await getStatementThreadParticipants(db, thread.contextId) : null;
  return participants.filter(participant => audience?.participantIdentityIds.includes(participant.identityId));
}
export async function canAccessThread(db: PrismaClient, threadId: string, identityId: string): Promise<boolean> {
  const thread = await db.thread.findUnique({ where: { id: threadId } });
  if (!thread) return false;
  if (!hasLiveThreadAuthority(thread)) return Boolean(await db.threadParticipant.findUnique({
    where: { threadId_identityId: { threadId, identityId } },
  }));
  return (await getAuthorizedThreadParticipants(db, thread)).some(participant => participant.identityId === identityId);
}
export async function requireThreadAccess(db: PrismaClient, threadId: string, identityId: string): Promise<void> {
  if (!(await canAccessThread(db, threadId, identityId))) {
    throw Object.assign(new Error('Not a participant in this thread'), { statusCode: 404, isPublic: true });
  }
}
