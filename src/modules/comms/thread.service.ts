import { synchronizeInquiryParticipant } from './inquiry-thread-access';
import { createHash } from 'node:crypto';
import { getBookingThreadParticipants } from './booking-thread-access';
import { hasLiveThreadAuthority, canAccessThread, getAuthorizedThreadParticipants, getStatementThreadParticipants, requireThreadAccess } from './statement-thread-access';
import { PrismaClient, ThreadContextType, MessageKind } from '@prisma/client';
import { publishMessage } from './thread.bus';
import { track } from '@/modules/analytics';

export interface CreateThreadInput {
  contextType: ThreadContextType;
  contextId?: string;
  projectId?: string;
  participantIdentityIds: string[];
  participantRoles?: Record<string, string>;
}

export interface SendMessageInput {
  threadId: string;
  senderIdentityId?: string;
  body?: string;
  messageKind?: MessageKind;
}

/**
 * Find or create a thread by context (idempotent).
 * For booking context: guest + ops host/staff
 * For unit inquiry: guest + ops host/staff
 * For statement: owner + admin
 * For order: orderer + provider
 */
export async function findOrCreateThread(
  db: PrismaClient,
  input: CreateThreadInput
): Promise<{ id: string; created: boolean }> {
  const { contextType, contextId } = input;
  let { projectId, participantIdentityIds, participantRoles = {} } = input;
  if (contextType === 'booking') {
    if (!contextId) throw new Error('Booking not found');
    const audience = await getBookingThreadParticipants(db, contextId);
    const result = await db.$transaction(async tx => {
      const lockKey = JSON.stringify(['booking', contextId]);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
      const existing = await tx.thread.findFirst({ where: { contextType, contextId } });
      const thread = existing ?? await tx.thread.create({ data: { contextType, contextId, projectId: audience.projectId } });
      for (const identityId of audience.participantIdentityIds) {
        await tx.threadParticipant.upsert({
          where: { threadId_identityId: { threadId: thread.id, identityId } },
          create: { threadId: thread.id, identityId, participantRole: audience.participantRoles[identityId] },
          update: { participantRole: audience.participantRoles[identityId] },
        });
      }
      return { id: thread.id, created: !existing };
    });
    if (result.created) await track(db, 'message_thread_started', { projectId: audience.projectId, contextType }).catch(() => null);
    return result;
  }
  if (contextType === 'statement') {
    const audience = contextId ? await getStatementThreadParticipants(db, contextId) : null;
    if (!audience) throw new Error('Statement not found');
    ({ projectId, participantIdentityIds, participantRoles } = audience);
  }

  // Check if thread exists for this context
  const existingThread = await db.thread.findFirst({
    where: {
      contextType,
      contextId,
    },
  });

  if (existingThread) {
    // Idempotent: thread already exists
    return { id: existingThread.id, created: false };
  }

  // Create new thread
  const thread = await db.thread.create({
    data: {
      contextType,
      contextId,
      projectId,
    },
  });

  // Add participants
  for (const identityId of participantIdentityIds) {
    await db.threadParticipant.create({
      data: {
        threadId: thread.id,
        identityId,
        participantRole: participantRoles[identityId] || 'participant',
      },
    });
  }

  // Track analytics event for new thread
  await track(db, 'message_thread_started', {
    projectId,
    contextType: contextType,
  }).catch(() => null);

  return { id: thread.id, created: true };
}

/**
 * Send a message to a thread (participant-only).
 * Updates thread.lastMessageAt.
 * Best-effort: failures don't block primary actions.
 */
export async function sendMessage(
  db: PrismaClient,
  input: SendMessageInput
): Promise<string | null> {
  try {
    const { threadId, senderIdentityId, body, messageKind = 'user' } = input;

    // Verify sender is a participant (if authenticated)
    if (senderIdentityId) {
      if (!(await canAccessThread(db, threadId, senderIdentityId))) return null;
    }

    // Create the message
    const message = await db.message.create({
      data: {
        threadId,
        senderIdentityId,
        body,
        messageKind,
      },
    });

    // Update thread's lastMessageAt
    await db.thread.update({
      where: { id: threadId },
      data: { lastMessageAt: new Date() },
    });

    // Publish to subscribers (best-effort)
    try {
      publishMessage(threadId, {
        id: message.id,
        threadId: message.threadId,
        senderIdentityId: message.senderIdentityId,
        body: message.body,
        messageKind: message.messageKind,
        createdAt: message.createdAt.toISOString(),
      });
    } catch (err) {
      console.error('Failed to publish message to bus:', err);
    }

    return message.id;
  } catch (error) {
    console.error('Failed to send message:', error);
    return null;
  }
}

/**
 * Mark a thread as read for a participant.
 */
export async function markThreadRead(
  db: PrismaClient,
  threadId: string,
  identityId: string,
  readThrough: Date = new Date(),
): Promise<void> {
  await requireThreadAccess(db, threadId, identityId);
  await db.threadParticipant.updateMany({
    where: {
      threadId, identityId,
      OR: [{ lastReadAt: null }, { lastReadAt: { lt: readThrough } }],
    },
    data: { lastReadAt: readThrough },
  });
}

/**
 * Get all threads for a user (inbox), newest-first.
 * Enforces participant-only visibility.
 */
export async function getThreadsForIdentity(
  db: PrismaClient,
  identityId: string,
  limit: number = 50
) {
  await synchronizeInquiryParticipant(db, identityId);
  const threads = await db.thread.findMany({
    where: {
      participants: {
        some: {
          identityId,
        },
      },
    },
    include: {
      participants: true,
      messages: {
        take: 1,
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: { lastMessageAt: 'desc' },
    take: limit,
  });
  const visible = await Promise.all(threads.map(async thread => {
    if (!hasLiveThreadAuthority(thread)) return thread;
    const allowed = await getAuthorizedThreadParticipants(db, thread);
    if (!allowed.some(participant => participant.identityId === identityId)) return null;
    return { ...thread, participants: thread.participants.filter(participant =>
      allowed.some(current => current.identityId === participant.identityId)) };
  }));
  return visible.filter((thread): thread is NonNullable<typeof thread> => thread !== null);
}

/**
 * Get messages in a thread (participant-only).
 */
export async function getThreadMessages(
  db: PrismaClient,
  threadId: string,
  identityId: string,
  limit: number = 50,
  offset: number = 0
) {
  await requireThreadAccess(db, threadId, identityId);

  return db.message.findMany({
    where: { threadId },
    include: {
      sender: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          avatarMediaId: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
  });
}

/**
 * Add a system message to a thread (e.g., booking confirmed, status changed).
 * System messages have no sender, carry contextual data.
 */
export async function addSystemMessage(
  db: PrismaClient,
  threadId: string,
  body: string
): Promise<string | null> {
  try {
    const message = await db.message.create({
      data: {
        threadId,
        body,
        messageKind: 'system',
      },
    });

    // Update thread's lastMessageAt
    await db.thread.update({
      where: { id: threadId },
      data: { lastMessageAt: new Date() },
    });

    // Publish to subscribers (best-effort)
    try {
      publishMessage(threadId, {
        id: message.id,
        threadId: message.threadId,
        senderIdentityId: message.senderIdentityId,
        body: message.body,
        messageKind: message.messageKind,
        createdAt: message.createdAt.toISOString(),
      });
    } catch (err) {
      console.error('Failed to publish system message to bus:', err);
    }

    return message.id;
  } catch (error) {
    console.error('Failed to add system message:', error);
    return null;
  }
}

/**
 * Get unread message count for a user per thread.
 */
export async function getUnreadCounts(
  db: PrismaClient,
  identityId: string
): Promise<Record<string, number>> {
  await synchronizeInquiryParticipant(db, identityId);
  const threads = await db.thread.findMany({
    where: {
      participants: {
        some: {
          identityId,
        },
      },
    },
    include: {
      participants: {
        where: { identityId },
        select: { lastReadAt: true },
      },
      messages: {
        select: { createdAt: true },
      },
    },
  });

  const counts: Record<string, number> = {};

  for (const thread of threads) {
    if (hasLiveThreadAuthority(thread) && !(await canAccessThread(db, thread.id, identityId))) continue;
    const participant = thread.participants[0];
    const lastRead = participant?.lastReadAt;

    const unreadCount = thread.messages.filter(
      (msg) => !lastRead || msg.createdAt > lastRead
    ).length;

    if (unreadCount > 0) {
      counts[thread.id] = unreadCount;
    }
  }

  return counts;
}

/** User-authored replies: atomic persistence and idempotent acknowledged retries.
 * Inbox unread counts derive from these canonical messages; external delivery is
 * intentionally not part of the acknowledgement contract. */
export async function sendHumanReply(db: PrismaClient, input: {
  threadId: string; senderIdentityId: string; body: string; requestId?: string;
}): Promise<string> {
  await requireThreadAccess(db, input.threadId, input.senderIdentityId);
  const messageId = input.requestId
    ? createHash('sha256').update(JSON.stringify(['reply', input.threadId, input.senderIdentityId, input.requestId])).digest('hex')
    : crypto.randomUUID();
  const result = await db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${messageId}, 0))`;
    const existing = await tx.message.findUnique({ where: { id: messageId } });
    if (existing) {
      if (existing.body !== input.body) throw Object.assign(new Error('request_id_conflict'), { statusCode: 409, isPublic: true });
      return { message: existing, created: false };
    }
    const message = await tx.message.create({ data: { id: messageId, threadId: input.threadId, senderIdentityId: input.senderIdentityId, body: input.body, messageKind: 'user' } });
    await tx.thread.update({ where: { id: input.threadId }, data: { lastMessageAt: message.createdAt } });
    return { message, created: true };
  });
  if (result.created) {
    try {
      publishMessage(input.threadId, { ...result.message, createdAt: result.message.createdAt.toISOString() });
    } catch { /* Persisted reply remains available by refresh/polling. */ }
  }
  return result.message.id;
}
