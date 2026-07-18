import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db, resetDb, createIdentity, createProject, createUnit } from '@/test/util';
import * as threadService from './thread.service';

describe('thread.service — integration tests', () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterEach(async () => {
    await resetDb();
  });

  describe('findOrCreateThread', () => {
    it('creates a thread for a booking context', async () => {
      const project = await createProject();
      const guest = await createIdentity();

      const result = await threadService.findOrCreateThread(db, {
        contextType: 'booking',
        contextId: 'booking-123',
        projectId: project.id,
        participantIdentityIds: [guest.id],
      });

      expect(result.created).toBe(true);
      expect(result.id).toBeDefined();

      // Verify thread was created
      const thread = await db.thread.findUnique({
        where: { id: result.id },
        include: { participants: true },
      });

      expect(thread?.contextType).toBe('booking');
      expect(thread?.contextId).toBe('booking-123');
      expect(thread?.projectId).toBe(project.id);
      expect(thread?.participants).toHaveLength(1);
      expect(thread?.participants[0]?.identityId).toBe(guest.id);
    });

    it('is idempotent: returns existing thread', async () => {
      const project = await createProject();
      const guest = await createIdentity();
      const bookingId = 'booking-456';

      // First call creates thread
      const result1 = await threadService.findOrCreateThread(db, {
        contextType: 'booking',
        contextId: bookingId,
        projectId: project.id,
        participantIdentityIds: [guest.id],
      });

      expect(result1.created).toBe(true);

      // Second call returns existing thread
      const result2 = await threadService.findOrCreateThread(db, {
        contextType: 'booking',
        contextId: bookingId,
        projectId: project.id,
        participantIdentityIds: [guest.id],
      });

      expect(result2.created).toBe(false);
      expect(result2.id).toBe(result1.id);
    });

    it('sets participant roles from input', async () => {
      const project = await createProject();
      const guest = await createIdentity();
      const host = await createIdentity();

      const thread = await threadService.findOrCreateThread(db, {
        contextType: 'booking',
        contextId: 'booking-789',
        projectId: project.id,
        participantIdentityIds: [guest.id, host.id],
        participantRoles: {
          [guest.id]: 'guest',
          [host.id]: 'host',
        },
      });

      const participants = await db.threadParticipant.findMany({
        where: { threadId: thread.id },
      });

      const guestParticipant = participants.find((p) => p.identityId === guest.id);
      const hostParticipant = participants.find((p) => p.identityId === host.id);

      expect(guestParticipant?.participantRole).toBe('guest');
      expect(hostParticipant?.participantRole).toBe('host');
    });
  });

  describe('sendMessage', () => {
    it('creates a message and updates thread.lastMessageAt', async () => {
      const project = await createProject();
      const sender = await createIdentity();
      const recipient = await createIdentity();

      const thread = await threadService.findOrCreateThread(db, {
        contextType: 'booking',
        contextId: 'booking-msg',
        projectId: project.id,
        participantIdentityIds: [sender.id, recipient.id],
      });

      const threadBefore = await db.thread.findUnique({
        where: { id: thread.id },
      });

      const messageId = await threadService.sendMessage(db, {
        threadId: thread.id,
        senderIdentityId: sender.id,
        body: 'Hello there',
        messageKind: 'user',
      });

      expect(messageId).toBeDefined();

      const message = await db.message.findUnique({
        where: { id: messageId! },
      });

      expect(message?.body).toBe('Hello there');
      expect(message?.senderIdentityId).toBe(sender.id);
      expect(message?.messageKind).toBe('user');

      const threadAfter = await db.thread.findUnique({
        where: { id: thread.id },
      });

      expect(threadAfter?.lastMessageAt?.getTime()).toBeGreaterThan(
        threadBefore?.lastMessageAt?.getTime() || 0
      );
    });

    it('enforces participant-only access for authenticated senders', async () => {
      const project = await createProject();
      const participant = await createIdentity();
      const nonParticipant = await createIdentity();

      const thread = await threadService.findOrCreateThread(db, {
        contextType: 'booking',
        contextId: 'booking-auth',
        projectId: project.id,
        participantIdentityIds: [participant.id],
      });

      // Non-participant cannot send
      const result = await threadService.sendMessage(db, {
        threadId: thread.id,
        senderIdentityId: nonParticipant.id,
        body: 'Unauthorized',
      });

      expect(result).toBeNull();
    });

    it('allows anonymous messages when no sender is specified', async () => {
      const project = await createProject();
      const guest = await createIdentity();

      const thread = await threadService.findOrCreateThread(db, {
        contextType: 'booking',
        contextId: 'booking-anon',
        projectId: project.id,
        participantIdentityIds: [guest.id],
      });

      const messageId = await threadService.sendMessage(db, {
        threadId: thread.id,
        body: 'Anonymous message',
      });

      expect(messageId).toBeDefined();

      const message = await db.message.findUnique({
        where: { id: messageId! },
      });

      expect(message?.senderIdentityId).toBeNull();
    });
  });

  describe('getThreadMessages', () => {
    it('returns messages for a thread (participant-only)', async () => {
      const project = await createProject();
      const participant = await createIdentity();
      const nonParticipant = await createIdentity();

      const thread = await threadService.findOrCreateThread(db, {
        contextType: 'booking',
        contextId: 'booking-msgs',
        projectId: project.id,
        participantIdentityIds: [participant.id],
      });

      // Send messages
      await threadService.sendMessage(db, {
        threadId: thread.id,
        senderIdentityId: participant.id,
        body: 'Message 1',
      });

      await threadService.sendMessage(db, {
        threadId: thread.id,
        senderIdentityId: participant.id,
        body: 'Message 2',
      });

      // Participant can retrieve
      const messages = await threadService.getThreadMessages(
        db,
        thread.id,
        participant.id
      );

      expect(messages).toHaveLength(2);
      expect(messages[0].body).toBe('Message 2'); // desc order
      expect(messages[1].body).toBe('Message 1');

      // Non-participant cannot retrieve
      await expect(
        threadService.getThreadMessages(db, thread.id, nonParticipant.id)
      ).rejects.toThrow('Not a participant in this thread');
    });

    it('includes sender details in returned messages', async () => {
      const project = await createProject();
      const sender = await createIdentity();

      const thread = await threadService.findOrCreateThread(db, {
        contextType: 'booking',
        contextId: 'booking-detail',
        projectId: project.id,
        participantIdentityIds: [sender.id],
      });

      await threadService.sendMessage(db, {
        threadId: thread.id,
        senderIdentityId: sender.id,
        body: 'With sender',
      });

      const messages = await threadService.getThreadMessages(
        db,
        thread.id,
        sender.id
      );

      expect(messages[0].sender).toBeDefined();
      expect(messages[0].sender?.id).toBe(sender.id);
    });
  });

  describe('markThreadRead', () => {
    it('updates lastReadAt for a participant', async () => {
      const project = await createProject();
      const participant = await createIdentity();

      const thread = await threadService.findOrCreateThread(db, {
        contextType: 'booking',
        contextId: 'booking-read',
        projectId: project.id,
        participantIdentityIds: [participant.id],
      });

      await threadService.sendMessage(db, {
        threadId: thread.id,
        senderIdentityId: participant.id,
        body: 'Test',
      });

      // Mark as read
      await threadService.markThreadRead(db, thread.id, participant.id);

      const participantRecord = await db.threadParticipant.findUnique({
        where: {
          threadId_identityId: {
            threadId: thread.id,
            identityId: participant.id,
          },
        },
      });

      expect(participantRecord?.lastReadAt).toBeDefined();
    });
  });

  describe('addSystemMessage', () => {
    it('creates a system message and updates thread.lastMessageAt', async () => {
      const project = await createProject();
      const guest = await createIdentity();

      const thread = await threadService.findOrCreateThread(db, {
        contextType: 'booking',
        contextId: 'booking-sys',
        projectId: project.id,
        participantIdentityIds: [guest.id],
      });

      const messageId = await threadService.addSystemMessage(
        db,
        thread.id,
        'Booking confirmed'
      );

      expect(messageId).toBeDefined();

      const message = await db.message.findUnique({
        where: { id: messageId! },
      });

      expect(message?.body).toBe('Booking confirmed');
      expect(message?.messageKind).toBe('system');
      expect(message?.senderIdentityId).toBeNull();
    });
  });

  describe('getUnreadCounts', () => {
    it('counts unread messages per thread', async () => {
      const project = await createProject();
      const sender = await createIdentity();
      const receiver = await createIdentity();

      const thread = await threadService.findOrCreateThread(db, {
        contextType: 'booking',
        contextId: 'booking-unread',
        projectId: project.id,
        participantIdentityIds: [sender.id, receiver.id],
      });

      // Sender sends 3 messages
      await threadService.sendMessage(db, {
        threadId: thread.id,
        senderIdentityId: sender.id,
        body: 'Msg 1',
      });

      await threadService.sendMessage(db, {
        threadId: thread.id,
        senderIdentityId: sender.id,
        body: 'Msg 2',
      });

      await threadService.sendMessage(db, {
        threadId: thread.id,
        senderIdentityId: sender.id,
        body: 'Msg 3',
      });

      // Receiver has not read any
      const counts = await threadService.getUnreadCounts(db, receiver.id);

      expect(counts[thread.id]).toBe(3);

      // Mark as read
      await threadService.markThreadRead(db, thread.id, receiver.id);

      const countsAfterRead = await threadService.getUnreadCounts(
        db,
        receiver.id
      );

      expect(countsAfterRead[thread.id]).toBeUndefined();
    });

    it('returns empty object when no unread messages', async () => {
      const identity = await createIdentity();

      const counts = await threadService.getUnreadCounts(db, identity.id);

      expect(counts).toEqual({});
    });
  });
});
