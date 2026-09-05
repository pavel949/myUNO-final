import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  db,
  resetDb,
  createIdentity,
  createProject,
  createUnit,
  createBooking,
  createRoleAssignment,
} from '@/test/util';
import { remindUnansweredRequests } from './notify-request-reminder';

describe('remindUnansweredRequests (N-34 half-SLA)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterEach(async () => {
    await resetDb();
  });

  it('sends reminder to ops when request is past half-SLA and still unanswered', async () => {
    const guest = await createIdentity({ firstName: 'Anna', lastName: 'Guest' });
    const ops = await createIdentity({ firstName: 'Ops', lastName: 'Lead' });
    const project = await createProject({ status: 'live' });
    const unit = await createUnit({ projectId: project.id });

    await createRoleAssignment({
      identityId: ops.id,
      role: 'staff_ops',
      scopeType: 'project',
      projectId: project.id,
    });

    const booking = await createBooking({
      unitId: unit.id,
      projectId: project.id,
      guestIdentityId: guest.id,
      status: 'requested',
      totalThb: 400_000,
    });

    const now = Date.now();
    const createdAt = new Date(now - 14 * 60 * 60 * 1000);
    const requestExpiresAt = new Date(now + 10 * 60 * 60 * 1000);

    await db.booking.update({
      where: { id: booking.id },
      data: { createdAt, requestExpiresAt },
    });

    const reminded = await remindUnansweredRequests(db, new Date(now));

    expect(reminded).toBe(1);

    const opsAlert = await db.notification.findFirst({
      where: {
        identityId: ops.id,
        type: 'stay_request_received',
        bodyKey: 'notify.stay_request_reminder.body',
      },
    });
    expect(opsAlert).not.toBeNull();
    expect(opsAlert?.titleKey).toBe('notify.stay_request_reminder.title');
  });

  it('does not remind before half-SLA elapses', async () => {
    const guest = await createIdentity();
    const ops = await createIdentity();
    const project = await createProject({ status: 'live' });
    const unit = await createUnit({ projectId: project.id });

    await createRoleAssignment({
      identityId: ops.id,
      role: 'staff_ops',
      scopeType: 'project',
      projectId: project.id,
    });

    const booking = await createBooking({
      unitId: unit.id,
      projectId: project.id,
      guestIdentityId: guest.id,
      status: 'requested',
      totalThb: 250_000,
    });

    const now = Date.now();
    const createdAt = new Date(now - 2 * 60 * 60 * 1000);
    const requestExpiresAt = new Date(now + 22 * 60 * 60 * 1000);

    await db.booking.update({
      where: { id: booking.id },
      data: { createdAt, requestExpiresAt },
    });

    const reminded = await remindUnansweredRequests(db, new Date(now));
    expect(reminded).toBe(0);

    const opsAlert = await db.notification.findFirst({
      where: { identityId: ops.id, bodyKey: 'notify.stay_request_reminder.body' },
    });
    expect(opsAlert).toBeNull();
  });

  it('sends only one reminder per booking (dedup)', async () => {
    const guest = await createIdentity();
    const ops = await createIdentity();
    const project = await createProject({ status: 'live' });
    const unit = await createUnit({ projectId: project.id });

    await createRoleAssignment({
      identityId: ops.id,
      role: 'staff_ops',
      scopeType: 'project',
      projectId: project.id,
    });

    const booking = await createBooking({
      unitId: unit.id,
      projectId: project.id,
      guestIdentityId: guest.id,
      status: 'requested',
      totalThb: 300_000,
    });

    const now = Date.now();
    await db.booking.update({
      where: { id: booking.id },
      data: {
        createdAt: new Date(now - 20 * 60 * 60 * 1000),
        requestExpiresAt: new Date(now + 4 * 60 * 60 * 1000),
      },
    });

    const first = await remindUnansweredRequests(db, new Date(now));
    const second = await remindUnansweredRequests(db, new Date(now));

    expect(first).toBe(1);
    expect(second).toBe(0);

    const reminders = await db.notification.count({
      where: {
        identityId: ops.id,
        bodyKey: 'notify.stay_request_reminder.body',
      },
    });
    expect(reminders).toBe(1);
  });
});
