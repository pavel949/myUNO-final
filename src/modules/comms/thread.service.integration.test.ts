import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db, resetDb, createIdentity, createProject, createUnit, createBooking, createRoleAssignment } from '@/test/util';
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
      const unit = await createUnit({ projectId: project.id });
      const booking = await createBooking({ projectId: project.id, unitId: unit.id, guestIdentityId: guest.id });

      const result = await threadService.findOrCreateThread(db, {
        contextType: 'booking',
        contextId: booking.id,
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
      expect(thread?.contextId).toBe(booking.id);
      expect(thread?.projectId).toBe(project.id);
      expect(thread?.participants).toHaveLength(1);
      expect(thread?.participants[0]?.identityId).toBe(guest.id);
    });

    it('is idempotent: returns existing thread', async () => {
      const project = await createProject();
      const guest = await createIdentity();
      const unit = await createUnit({ projectId: project.id });
      const booking = await createBooking({ projectId: project.id, unitId: unit.id, guestIdentityId: guest.id });
      const bookingId = booking.id;

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

    it('derives booking roles from scoped authority rather than caller-provided labels', async () => {
      const project = await createProject();
      const guest = await createIdentity();
      const host = await createIdentity();
      const unit = await createUnit({ projectId: project.id });
      const booking = await createBooking({ projectId: project.id, unitId: unit.id, guestIdentityId: guest.id });
      await createRoleAssignment({ identityId: host.id, role: 'onsite_host', scopeType: 'project', projectId: project.id });

      const thread = await threadService.findOrCreateThread(db, {
        contextType: 'booking',
        contextId: booking.id,
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
      expect(hostParticipant?.participantRole).toBe('onsite_host');
    });
  });

  describe('sendMessage', () => {
    it('creates a message and updates thread.lastMessageAt', async () => {
      const project = await createProject();
      const sender = await createIdentity();
      const recipient = await createIdentity();

      const thread = await threadService.findOrCreateThread(db, {
        contextType: 'general',
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
        contextType: 'general',
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
        contextType: 'general',
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
        contextType: 'general',
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
        contextType: 'general',
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
        contextType: 'general',
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
        contextType: 'general',
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
        contextType: 'general',
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


describe('booking thread authority — PostgreSQL regressions', () => {
  beforeEach(async () => { await resetDb(); });
  afterEach(async () => { await resetDb(); });

  it('serializes concurrent creation and denies a historical foreign-project participant', async () => {
    const project = await createProject();
    const foreignProject = await createProject();
    const guest = await createIdentity();
    const staff = await createIdentity();
    const foreignStaff = await createIdentity();
    const admin = await createIdentity({ isAdmin: true });
    const unit = await createUnit({ projectId: project.id });
    const booking = await createBooking({ projectId: project.id, unitId: unit.id, guestIdentityId: guest.id });
    await createRoleAssignment({ identityId: staff.id, role: 'staff_ops', scopeType: 'project', projectId: project.id });
    const foreignRole = await createRoleAssignment({ identityId: foreignStaff.id, role: 'staff_ops', scopeType: 'project', projectId: foreignProject.id });
    const input = { contextType: 'booking' as const, contextId: booking.id, participantIdentityIds: [guest.id, foreignStaff.id] };
    const created = await Promise.all([
      threadService.findOrCreateThread(db, input),
      threadService.findOrCreateThread(db, input),
    ]);
    expect(created[0].id).toBe(created[1].id);
    expect(created.filter(result => result.created)).toHaveLength(1);
    const threadId = created[0].id;
    const participants = await db.threadParticipant.findMany({ where: { threadId } });
    expect(participants.map(participant => participant.identityId).sort()).toEqual([guest.id, staff.id, admin.id].sort());
    await db.threadParticipant.create({ data: { threadId, identityId: foreignStaff.id, participantRole: 'staff_ops' } });
    expect(await threadService.getThreadsForIdentity(db, foreignStaff.id)).toEqual([]);
    await expect(threadService.getThreadMessages(db, threadId, foreignStaff.id)).rejects.toThrow('participant');
    expect(await threadService.sendMessage(db, { threadId, senderIdentityId: foreignStaff.id, body: 'Denied' })).toBeNull();
    expect(await threadService.sendMessage(db, { threadId, senderIdentityId: staff.id, body: 'Scoped reply' })).toBeTruthy();
    // Reassignment into the project activates the already enrolled identity;
    // a subsequent revoke removes access again without deleting its history.
    await db.roleAssignment.update({ where: { id: foreignRole.id }, data: { projectId: project.id } });
    expect(await threadService.getThreadMessages(db, threadId, foreignStaff.id)).toHaveLength(1);
    await db.roleAssignment.update({ where: { id: foreignRole.id }, data: { status: 'revoked' } });
    await expect(threadService.getThreadMessages(db, threadId, foreignStaff.id)).rejects.toThrow('participant');
  });
});
