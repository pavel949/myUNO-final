import { PrismaClient, ThreadContextType, MessageKind } from '@prisma/client';
import { publishMessage } from './thread.bus';

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
  const { contextType, contextId, projectId, participantIdentityIds, participantRoles = {} } = input;

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
      const isParticipant = await db.threadParticipant.findUnique({
        where: {
          threadId_identityId: {
            threadId,
            identityId: senderIdentityId,
          },
        },
      });

      if (!isParticipant) {
        console.error(`Identity ${senderIdentityId} is not a participant in thread ${threadId}`);
        return null;
      }
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
  identityId: string
): Promise<void> {
  await db.threadParticipant.update({
    where: {
      threadId_identityId: {
        threadId,
        identityId,
      },
    },
    data: {
      lastReadAt: new Date(),
    },
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
  return db.thread.findMany({
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
  // Verify participant access
  const isParticipant = await db.threadParticipant.findUnique({
    where: {
      threadId_identityId: {
        threadId,
        identityId,
      },
    },
  });

  if (!isParticipant) {
    throw new Error('Not a participant in this thread');
  }

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
