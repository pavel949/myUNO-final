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
import { seedConfig } from '@/modules/config';
import { changeBookingDates } from './booking.service';

describe('notifyBookingModified (N-11)', () => {
  beforeEach(async () => {
    await resetDb();
    await seedConfig(db);
  });

  afterEach(async () => {
    await resetDb();
  });

  it('notifies guest (stay_dates_modified) and ops (stay_modified_ops) on date change', async () => {
    const guest = await createIdentity({ firstName: 'Anna', lastName: 'Guest' });
    const ops = await createIdentity({ firstName: 'Ops', lastName: 'Lead' });
    const project = await createProject({ status: 'live' });
    const unit = await createUnit({
      projectId: project.id,
      status: 'live',
      baseNightlyThb: 100_000,
    });

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
      startDate: new Date('2026-11-10'),
      endDate: new Date('2026-11-14'),
      totalThb: 400_000,
    });

    await changeBookingDates(db, {
      bookingId: booking.id,
      startDate: new Date('2026-11-12'),
      endDate: new Date('2026-11-16'),
    });

    const guestAlert = await db.notification.findFirst({
      where: { identityId: guest.id, type: 'stay_dates_modified' },
    });
    expect(guestAlert?.titleKey).toBe('notify.stay_dates_modified.title');
    expect(guestAlert?.bodyKey).toBe('notify.stay_dates_modified.body');

    const opsAlert = await db.notification.findFirst({
      where: { identityId: ops.id, type: 'stay_modified_ops' },
    });
    expect(opsAlert).not.toBeNull();
    expect(opsAlert?.titleKey).toBe('notify.stay_modified_ops.title');
    expect(opsAlert?.bodyKey).toBe('notify.stay_modified_ops.body');
  });

  it('includes owner and MC members in stay_modified_ops feed', async () => {
    const guest = await createIdentity({ firstName: 'Anna', lastName: 'Guest' });
    const owner = await createIdentity({ firstName: 'Oleg', lastName: 'Owner' });
    const mcMember = await createIdentity({ firstName: 'MC', lastName: 'Member' });
    const project = await createProject({ status: 'live' });
    const unit = await createUnit({
      projectId: project.id,
      ownerIdentityId: owner.id,
      status: 'live',
      baseNightlyThb: 100_000,
    });
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
      startDate: new Date('2026-11-10'),
      endDate: new Date('2026-11-14'),
      totalThb: 400_000,
    });

    await changeBookingDates(db, {
      bookingId: booking.id,
      startDate: new Date('2026-11-11'),
      endDate: new Date('2026-11-15'),
    });

    const ownerAlert = await db.notification.findFirst({
      where: { identityId: owner.id, type: 'stay_modified_ops' },
    });
    expect(ownerAlert).not.toBeNull();

    const mcAlert = await db.notification.findFirst({
      where: { identityId: mcMember.id, type: 'stay_modified_ops' },
    });
    expect(mcAlert).not.toBeNull();
  });
});
