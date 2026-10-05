import { beforeEach, describe, expect, it } from 'vitest';
import {
  createBooking,
  createIdentity,
  createOrganization,
  createProject,
  createRoleAssignment,
  createUnit,
  db,
  resetDb,
} from '@/test/util';
import { notifyBookingPendingPayment } from './notify-pending-payment';

describe('notifyBookingPendingPayment', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('alerts project ops with a canonical Stay 360 link', async () => {
    const guest = await createIdentity({ firstName: 'Guest' });
    const ops = await createIdentity({ firstName: 'Ops' });
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
      status: 'pending_payment',
      holdExpiresAt: new Date(Date.now() + 30 * 60_000),
      totalThb: 350_000,
    });

    await notifyBookingPendingPayment(db, booking.id);

    const alert = await db.notification.findFirst({
      where: { identityId: ops.id, type: 'stay_new_booking_ops' },
    });
    expect(alert?.titleKey).toBe('notify.stay_payment_pending_ops.title');
    expect(JSON.stringify(alert?.params)).toContain('/ops/stays/');
  });

  it('alerts the active management company with the Property Workspace link', async () => {
    const guest = await createIdentity({ firstName: 'Guest' });
    const owner = await createIdentity({ firstName: 'Owner' });
    const manager = await createIdentity({ firstName: 'Manager' });
    const project = await createProject({ status: 'live' });
    const unit = await createUnit({ projectId: project.id, ownerIdentityId: owner.id });
    const organization = await createOrganization('MC', project.id, 'management_company');

    await db.unitEngagement.create({
      data: {
        unitId: unit.id,
        ownerIdentityId: owner.id,
        engagementType: 'via_management_company',
        managementOrgId: organization.id,
        status: 'active',
      },
    });
    await db.roleAssignment.create({
      data: {
        identityId: manager.id,
        role: 'mc_member',
        scopeType: 'project',
        projectId: project.id,
        organizationId: organization.id,
        status: 'active',
      },
    });
    const booking = await createBooking({
      unitId: unit.id,
      projectId: project.id,
      guestIdentityId: guest.id,
      status: 'pending_payment',
      holdExpiresAt: new Date(Date.now() + 30 * 60_000),
      totalThb: 450_000,
    });

    await notifyBookingPendingPayment(db, booking.id);

    const alert = await db.notification.findFirst({
      where: { identityId: manager.id, type: 'stay_new_booking_ops' },
    });
    expect(alert?.titleKey).toBe('notify.stay_payment_pending_ops.title');
    expect(JSON.stringify(alert?.params)).toContain('/mc/properties/');
    expect(JSON.stringify(alert?.params)).toContain('tab=reservations');
  });

  it('does not alert for a non-pending booking', async () => {
    const guest = await createIdentity({ firstName: 'Guest' });
    const ops = await createIdentity({ firstName: 'Ops' });
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
      status: 'confirmed',
    });

    await notifyBookingPendingPayment(db, booking.id);

    expect(await db.notification.count({
      where: { identityId: ops.id, type: 'stay_new_booking_ops' },
    })).toBe(0);
  });
});
