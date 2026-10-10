import { getBookingThreadParticipants } from './booking-thread-access';
import type { PrismaClient, Thread } from '@prisma/client';
import { OWNER_VISIBLE_STATEMENT_STATUSES } from '@/modules/finance/statement-signoff.service';

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

/** Financial and booking conversations use live contextual authority.
 * Other contexts retain their existing policy until separately reviewed. */
export async function getAuthorizedThreadParticipants(db: PrismaClient, thread: Pick<Thread, 'id' | 'contextType' | 'contextId'>) {
  const participants = await db.threadParticipant.findMany({
    where: { threadId: thread.id },
    include: { identity: { select: { id: true, firstName: true, lastName: true } } },
  });
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
  if (thread.contextType !== 'statement' && thread.contextType !== 'booking') return Boolean(await db.threadParticipant.findUnique({
    where: { threadId_identityId: { threadId, identityId } },
  }));
  return (await getAuthorizedThreadParticipants(db, thread)).some(participant => participant.identityId === identityId);
}
export async function requireThreadAccess(db: PrismaClient, threadId: string, identityId: string): Promise<void> {
  if (!(await canAccessThread(db, threadId, identityId))) {
    throw Object.assign(new Error('Not a participant in this thread'), { statusCode: 404, isPublic: true });
  }
}
