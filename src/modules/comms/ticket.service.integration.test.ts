import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db, resetDb, createIdentity, createProject } from '@/test/util';
import * as ticketService from './ticket.service';

describe('ticket.service — integration tests', () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterEach(async () => {
    await resetDb();
  });

  describe('raiseTicket', () => {
    it('creates a ticket with thread and records creation event', async () => {
      const project = await createProject();
      const reporter = await createIdentity();

      const result = await ticketService.raiseTicket(db, {
        projectId: project.id,
        raisedByIdentityId: reporter.id,
        raisedByRole: 'guest',
        categoryKey: 'maintenance',
        title: 'Broken AC',
        description: 'Air conditioning not working',
        priority: 'high',
      });

      expect(result.id).toBeDefined();
      expect(result.threadId).toBeDefined();

      // Verify ticket created
      const ticket = await db.ticket.findUnique({
        where: { id: result.id },
      });

      expect(ticket?.title).toBe('Broken AC');
      expect(ticket?.status).toBe('open');
      expect(ticket?.priority).toBe('high');
      expect(ticket?.raisedByIdentityId).toBe(reporter.id);
      expect(ticket?.threadId).toBe(result.threadId);

      // Verify thread created
      const thread = await db.thread.findUnique({
        where: { id: result.threadId },
        include: { participants: true },
      });

      expect(thread?.contextType).toBe('ticket');
      expect(thread?.contextId).toBe(result.id);
      expect(thread?.participants).toHaveLength(1);
      expect(thread?.participants[0]?.identityId).toBe(reporter.id);
      expect(thread?.participants[0]?.participantRole).toBe('reporter');

      // Verify creation event recorded
      const events = await db.ticketEvent.findMany({
        where: { ticketId: result.id },
      });

      expect(events).toHaveLength(1);
      expect(events[0]?.eventType).toBe('status_change');
      expect(events[0]?.data?.newStatus).toBe('open');
    });
  });

  describe('updateTicketStatus', () => {
    it('updates ticket status and records event', async () => {
      const project = await createProject();
      const reporter = await createIdentity();
      const staff = await createIdentity();

      const { id: ticketId } = await ticketService.raiseTicket(db, {
        projectId: project.id,
        raisedByIdentityId: reporter.id,
        raisedByRole: 'guest',
        categoryKey: 'maintenance',
        title: 'Broken AC',
      });

      // Staff acknowledges ticket
      await ticketService.updateTicketStatus(db, {
        ticketId,
        newStatus: 'acknowledged',
        actorIdentityId: staff.id,
      });

      const ticket = await db.ticket.findUnique({
        where: { id: ticketId },
      });

      expect(ticket?.status).toBe('acknowledged');

      // Verify event recorded
      const events = await db.ticketEvent.findMany({
        where: { ticketId },
      });

      // Creation event + status change event
      expect(events).toHaveLength(2);
      expect(events[1]?.eventType).toBe('status_change');
      expect(events[1]?.actorIdentityId).toBe(staff.id);
      expect(events[1]?.data?.oldStatus).toBe('open');
      expect(events[1]?.data?.newStatus).toBe('acknowledged');
    });

    it('sets resolvedAt and resolutionNote when resolving', async () => {
      const project = await createProject();
      const reporter = await createIdentity();
      const staff = await createIdentity();

      const { id: ticketId } = await ticketService.raiseTicket(db, {
        projectId: project.id,
        raisedByIdentityId: reporter.id,
        raisedByRole: 'guest',
        categoryKey: 'maintenance',
        title: 'Broken AC',
      });

      // Staff resolves ticket
      await ticketService.updateTicketStatus(db, {
        ticketId,
        newStatus: 'resolved',
        actorIdentityId: staff.id,
        note: 'Replaced the compressor',
      });

      const ticket = await db.ticket.findUnique({
        where: { id: ticketId },
      });

      expect(ticket?.status).toBe('resolved');
      expect(ticket?.resolvedAt).toBeDefined();
      expect(ticket?.resolutionNote).toBe('Replaced the compressor');
    });

    it('enforces no transitions from closed or cancelled', async () => {
      const project = await createProject();
      const reporter = await createIdentity();
      const staff = await createIdentity();

      const { id: ticketId } = await ticketService.raiseTicket(db, {
        projectId: project.id,
        raisedByIdentityId: reporter.id,
        raisedByRole: 'guest',
        categoryKey: 'maintenance',
        title: 'Test',
      });

      // Manually set to closed for testing
      await db.ticket.update({
        where: { id: ticketId },
        data: { status: 'closed' },
      });

      // Try to transition from closed
      await expect(
        ticketService.updateTicketStatus(db, {
          ticketId,
          newStatus: 'open',
          actorIdentityId: staff.id,
        })
      ).rejects.toThrow('Cannot transition from closed');
    });
  });

  describe('assignTicket', () => {
    it('assigns ticket and records event', async () => {
      const project = await createProject();
      const reporter = await createIdentity();
      const staff = await createIdentity();

      const { id: ticketId } = await ticketService.raiseTicket(db, {
        projectId: project.id,
        raisedByIdentityId: reporter.id,
        raisedByRole: 'guest',
        categoryKey: 'maintenance',
        title: 'Test',
      });

      await ticketService.assignTicket(db, ticketId, staff.id, reporter.id);

      const ticket = await db.ticket.findUnique({
        where: { id: ticketId },
      });

      expect(ticket?.assigneeIdentityId).toBe(staff.id);

      // Verify assignment event
      const events = await db.ticketEvent.findMany({
        where: { ticketId },
      });

      const assignmentEvent = events.find((e) => e.eventType === 'assignment');
      expect(assignmentEvent).toBeDefined();
      expect(assignmentEvent?.data?.assignedTo).toBe(staff.id);
    });
  });

  describe('getTicketDetail', () => {
    it('returns ticket with full history for reporter', async () => {
      const project = await createProject();
      const reporter = await createIdentity();
      const staff = await createIdentity();

      const { id: ticketId } = await ticketService.raiseTicket(db, {
        projectId: project.id,
        raisedByIdentityId: reporter.id,
        raisedByRole: 'guest',
        categoryKey: 'maintenance',
        title: 'Broken AC',
      });

      // Make some transitions
      await ticketService.updateTicketStatus(db, {
        ticketId,
        newStatus: 'acknowledged',
        actorIdentityId: staff.id,
      });

      await ticketService.assignTicket(db, ticketId, staff.id, reporter.id);

      await ticketService.updateTicketStatus(db, {
        ticketId,
        newStatus: 'resolved',
        actorIdentityId: staff.id,
        note: 'Fixed AC unit',
      });

      // Reporter views detail
      const detail = await ticketService.getTicketDetail(
        db,
        ticketId,
        reporter.id
      );

      expect(detail).toBeDefined();
      expect(detail?.title).toBe('Broken AC');
      expect(detail?.events).toHaveLength(4); // creation + 3 transitions
      expect(detail?.resolutionNote).toBe('Fixed AC unit');

      // Verify reporter can see all transitions
      const statusChangeEvents = detail?.events.filter(
        (e) => e.eventType === 'status_change'
      );
      expect(statusChangeEvents?.length).toBe(3); // open, acknowledged, resolved
    });

    it('throws when non-reporter/assignee tries to view', async () => {
      const project = await createProject();
      const reporter = await createIdentity();
      const outsider = await createIdentity();

      const { id: ticketId } = await ticketService.raiseTicket(db, {
        projectId: project.id,
        raisedByIdentityId: reporter.id,
        raisedByRole: 'guest',
        categoryKey: 'maintenance',
        title: 'Test',
      });

      // Outsider cannot view
      await expect(
        ticketService.getTicketDetail(db, ticketId, outsider.id)
      ).rejects.toThrow('Not authorized to view this ticket');
    });
  });

  describe('SLA escalation scenario', () => {
    it('tracks SLA compliance and escalation events (mock)', async () => {
      const project = await createProject();
      const reporter = await createIdentity();
      const staff = await createIdentity();

      // Create urgent ticket (SLA: 4 hours)
      const { id: ticketId } = await ticketService.raiseTicket(db, {
        projectId: project.id,
        raisedByIdentityId: reporter.id,
        raisedByRole: 'guest',
        categoryKey: 'maintenance',
        title: 'Critical: No power',
        priority: 'urgent',
      });

      // In a real implementation, a scheduled job would check slaDueAt
      // and call recordTicketEvent with type: sla_escalation
      // For this test, we mock the escalation event
      await ticketService.recordTicketEvent(
        db,
        ticketId,
        'sla_escalation',
        null, // system event
        { escalatedAt: new Date(), priority: 'urgent' }
      );

      // Verify reporter can see escalation in history
      const detail = await ticketService.getTicketDetail(
        db,
        ticketId,
        reporter.id
      );

      const escalationEvent = detail?.events.find(
        (e) => e.eventType === 'sla_escalation'
      );

      expect(escalationEvent).toBeDefined();
      expect(escalationEvent?.data?.priority).toBe('urgent');
    });
  });

  describe('Reporter visibility', () => {
    it('reporter sees all transitions in history', async () => {
      const project = await createProject();
      const reporter = await createIdentity();
      const staff = await createIdentity();

      const { id: ticketId } = await ticketService.raiseTicket(db, {
        projectId: project.id,
        raisedByIdentityId: reporter.id,
        raisedByRole: 'resident',
        categoryKey: 'complaint',
        title: 'Noise complaint',
      });

      // Simulate full workflow
      await ticketService.updateTicketStatus(db, {
        ticketId,
        newStatus: 'acknowledged',
        actorIdentityId: staff.id,
      });

      await ticketService.assignTicket(db, ticketId, staff.id, staff.id);

      await ticketService.updateTicketStatus(db, {
        ticketId,
        newStatus: 'in_progress',
        actorIdentityId: staff.id,
      });

      await ticketService.updateTicketStatus(db, {
        ticketId,
        newStatus: 'waiting_reporter',
        actorIdentityId: staff.id,
        note: 'Need more information about exact times',
      });

      await ticketService.updateTicketStatus(db, {
        ticketId,
        newStatus: 'in_progress',
        actorIdentityId: staff.id,
      });

      await ticketService.updateTicketStatus(db, {
        ticketId,
        newStatus: 'resolved',
        actorIdentityId: staff.id,
        note: 'Contacted neighbor about noise levels',
      });

      // Reporter views complete history
      const detail = await ticketService.getTicketDetail(
        db,
        ticketId,
        reporter.id
      );

      // Should see all events in order
      expect(detail?.events).toHaveLength(6); // created + 5 status changes
      expect(detail?.events[0]?.eventType).toBe('status_change');
      expect(detail?.events[0]?.data?.newStatus).toBe('open');
      expect(detail?.events[5]?.data?.newStatus).toBe('resolved');
      expect(detail?.events[5]?.data?.note).toBe(
        'Contacted neighbor about noise levels'
      );

      // StatusTimeline can be rendered from this history
      // (not implemented yet - UI task)
    });
  });
});
