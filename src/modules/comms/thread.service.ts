import type { PrismaClient, ThreadContextType } from '@prisma/client';
import { createNotification } from './notification.service';

/**
 * Threads & messages (doc 09 §1) — the shared conversation layer.
 * Participant-only access is enforced here, not in callers.
 */

export interface ThreadParticipantInput {
  identityId: string;
  participantRole: string; // RoleType-ish label for display ('guest', 'staff_ops', 'owner', 'admin')
}

export interface FindOrCreateThreadInput {
  contextType: ThreadContextType;
  contextId?: string;
  projectId?: string;
  participants: ThreadParticipantInput[];
}

/**
 * Find the existing thread for a context (same context + all participants
 * present) or create it. Returns the thread id.
 */
export async function findOrCreateThread(
  db: PrismaClient,
  input: FindOrCreateThreadInput
): Promise<string> {
  const { contextType, contextId, projectId, participants } = input;

  if (participants.length === 0) {
    throw new Error('A thread needs at least one participant');
  }

  if (contextId) {
    const existing = await db.thread.findFirst({
      where: {
        contextType,
        contextId,
        participants: { some: { identityId: participants[0].identityId } },
      },
      select: { id: true },
    });
    if (existing) {
      return existing.id;
    }
  }

  const thread = await db.thread.create({
    data: {
      contextType,
      contextId,
      projectId,
      participants: {
        create: participants.map((p) => ({
          identityId: p.identityId,
          participantRole: p.participantRole,
        })),
      },
    },
  });
  return thread.id;
}

async function requireParticipant(db: PrismaClient, threadId: string, identityId: string) {
  const participant = await db.threadParticipant.findUnique({
    where: { threadId_identityId: { threadId, identityId } },
  });
  if (!participant) {
    throw new Error('Not a participant of this thread');
  }
  return participant;
}

/**
 * Send a message; bumps lastMessageAt and notifies the other participants.
 */
export async function sendMessage(
  db: PrismaClient,
  input: { threadId: string; senderIdentityId: string; body: string }
) {
  const { threadId, senderIdentityId, body } = input;
  await requireParticipant(db, threadId, senderIdentityId);

  const message = await db.message.create({
    data: { threadId, senderIdentityId, body, messageKind: 'user' },
    include: { sender: { select: { firstName: true, lastName: true } } },
  });

  await db.thread.update({
    where: { id: threadId },
    data: { lastMessageAt: message.createdAt },
  });

  const others = await db.threadParticipant.findMany({
    where: { threadId, identityId: { not: senderIdentityId }, muted: false },
    select: { identityId: true },
  });
  for (const other of others) {
    await createNotification(db, {
      identityId: other.identityId,
      type: 'message_new',
      titleKey: 'notify.message_new.title',
      bodyKey: 'notify.message_new.body',
      params: {
        sender_name: message.sender
          ? `${message.sender.firstName} ${message.sender.lastName}`
          : '',
      },
    });
  }

  return message;
}

/**
 * The identity's inbox: threads with last message + unread count.
 */
export async function listThreadsFor(db: PrismaClient, identityId: string) {
  const memberships = await db.threadParticipant.findMany({
    where: { identityId },
    select: { threadId: true, lastReadAt: true },
  });
  const threadIds = memberships.map((m) => m.threadId);
  if (threadIds.length === 0) return [];

  const threads = await db.thread.findMany({
    where: { id: { in: threadIds } },
    include: {
      participants: {
        include: { identity: { select: { id: true, firstName: true, lastName: true } } },
      },
      messages: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: { lastMessageAt: { sort: 'desc', nulls: 'last' } },
  });

  const lastReadByThread = new Map(memberships.map((m) => [m.threadId, m.lastReadAt]));
  const result = [];
  for (const thread of threads) {
    const lastRead = lastReadByThread.get(thread.id);
    const unread = await db.message.count({
      where: {
        threadId: thread.id,
        senderIdentityId: { not: identityId },
        ...(lastRead ? { createdAt: { gt: lastRead } } : {}),
      },
    });
    result.push({
      id: thread.id,
      contextType: thread.contextType,
      contextId: thread.contextId,
      lastMessageAt: thread.lastMessageAt,
      lastMessage: thread.messages[0]?.body || null,
      unreadCount: unread,
      others: thread.participants
        .filter((p) => p.identityId !== identityId)
        .map((p) => ({
          id: p.identity.id,
          name: `${p.identity.firstName} ${p.identity.lastName}`,
          role: p.participantRole,
        })),
    });
  }
  return result;
}

/**
 * Full thread with messages (ascending). Marks the thread read.
 */
export async function getThread(db: PrismaClient, threadId: string, identityId: string) {
  await requireParticipant(db, threadId, identityId);

  const thread = await db.thread.findUnique({
    where: { id: threadId },
    include: {
      participants: {
        include: { identity: { select: { id: true, firstName: true, lastName: true } } },
      },
      messages: {
        orderBy: { createdAt: 'asc' },
        include: { sender: { select: { id: true, firstName: true, lastName: true } } },
      },
    },
  });
  if (!thread) {
    throw new Error('Thread not found');
  }

  await db.threadParticipant.update({
    where: { threadId_identityId: { threadId, identityId } },
    data: { lastReadAt: new Date() },
  });

  return thread;
}
