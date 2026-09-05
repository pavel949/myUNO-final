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
import { notifyBookingConfirmed } from './bookingConfirmed';

describe('notifyBookingConfirmed', () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterEach(async () => {
    await resetDb();
  });

  it('notifies guest, owner, and project ops on confirmation (N-02 + N-03)', async () => {
    const guest = await createIdentity({ firstName: 'Anna', lastName: 'Guest' });
    const owner = await createIdentity({ firstName: 'Oleg', lastName: 'Owner' });
    const ops = await createIdentity({ firstName: 'Ops', lastName: 'Lead' });
    const project = await createProject({ status: 'live' });
    const unit = await createUnit({ projectId: project.id, ownerIdentityId: owner.id });

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
      status: 'confirmed',
      totalThb: 500_000,
    });

    await notifyBookingConfirmed(db, booking.id);

    const guestAlert = await db.notification.findFirst({
      where: { identityId: guest.id, type: 'stay_confirmed' },
    });
    expect(guestAlert?.titleKey).toBe('notify.stay_confirmed.title');

    const ownerAlert = await db.notification.findFirst({
      where: { identityId: owner.id, type: 'stay_confirmed' },
    });
    expect(ownerAlert?.titleKey).toBe('notify.stay_confirmed.owner_title');

    const opsAlert = await db.notification.findFirst({
      where: { identityId: ops.id, type: 'stay_new_booking_ops' },
    });
    expect(opsAlert).not.toBeNull();
    expect(opsAlert?.titleKey).toBe('notify.stay_new_booking_ops.title');
    expect(opsAlert?.bodyKey).toBe('notify.stay_new_booking_ops.body');
  });

  it('includes MC members when the unit is via_management_company (N-03)', async () => {
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
      status: 'confirmed',
      totalThb: 300_000,
    });

    await notifyBookingConfirmed(db, booking.id);

    const mcAlert = await db.notification.findFirst({
      where: { identityId: mcMember.id, type: 'stay_new_booking_ops' },
    });
    expect(mcAlert).not.toBeNull();
    expect(mcAlert?.bodyKey).toBe('notify.stay_new_booking_ops.body');
  });
});
