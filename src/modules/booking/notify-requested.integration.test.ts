import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  db,
  resetDb,
  createIdentity,
  createProject,
  createUnit,
  createBooking,
  createRoleAssignment,
  createOrganization,
} from '@/test/util';
import { notifyBookingRequested } from './notify-requested';

describe('notifyBookingRequested', () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterEach(async () => {
    await resetDb();
  });

  it('notifies guest (N-33) and ops staff (N-34) on request-to-book', async () => {
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

    await notifyBookingRequested(db, booking.id, 24);

    const guestAlert = await db.notification.findFirst({
      where: { identityId: guest.id, type: 'stay_request_placed' },
    });
    expect(guestAlert?.titleKey).toBe('notify.stay_request_placed.title');
    expect(guestAlert?.bodyKey).toBe('notify.stay_request_placed.body');

    const opsAlert = await db.notification.findFirst({
      where: { identityId: ops.id, type: 'stay_request_received' },
    });
    expect(opsAlert).not.toBeNull();
    expect(opsAlert?.titleKey).toBe('notify.stay_request_received.title');
  });

  it('includes MC members for via_management_company units (N-34)', async () => {
    const guest = await createIdentity({ firstName: 'Anna', lastName: 'Guest' });
    const owner = await createIdentity({ firstName: 'Oleg', lastName: 'Owner' });
    const mcMember = await createIdentity({ firstName: 'MC', lastName: 'Member' });
    const project = await createProject({ status: 'live' });
    const unit = await createUnit({ projectId: project.id, ownerIdentityId: owner.id });
    const mcOrg = await createOrganization('MC Test', project.id, 'management_company');

    await db.unitEngagement.create({
      data: {
        unitId: unit.id,
        ownerIdentityId: owner.id,
        engagementType: 'via_management_company',
        managementOrgId: mcOrg.id,
        status: 'active',
      },
    });

    await db.roleAssignment.create({
      data: {
        identityId: mcMember.id,
        role: 'mc_member',
        scopeType: 'platform',
        organizationId: mcOrg.id,
        status: 'active',
      },
    });

    const booking = await createBooking({
      unitId: unit.id,
      projectId: project.id,
      guestIdentityId: guest.id,
      status: 'requested',
      totalThb: 250_000,
    });

    await notifyBookingRequested(db, booking.id, 48);

    const mcAlert = await db.notification.findFirst({
      where: { identityId: mcMember.id, type: 'stay_request_received' },
    });
    expect(mcAlert).not.toBeNull();
    expect(mcAlert?.bodyKey).toBe('notify.stay_request_received.body');
  });
});
