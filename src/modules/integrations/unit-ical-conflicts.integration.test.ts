import { beforeEach, describe, expect, it } from 'vitest';
import {
  createBooking,
  createIdentity,
  createProject,
  createUnit,
  db,
  resetDb,
} from '@/test/util';
import { createConflictNotifications } from './ical-import';
import { getUnitIcalConflictAlerts, getProjectIcalConflictAlerts } from './unit-ical-conflicts';

describe('getUnitIcalConflictAlerts', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('returns active booking conflicts surfaced by ops_ical_conflict notifications', async () => {
    const admin = await createIdentity({ firstName: 'Ops', lastName: 'Admin', isAdmin: true });
    const guest = await createIdentity({ firstName: 'Alex', lastName: 'Guest' });
    const project = await createProject({ name: 'Conflict Project', status: 'live' });
    const unit = await createUnit({ projectId: project.id, name: 'Villa 1', status: 'live' });
    const booking = await createBooking({
      unitId: unit.id,
      projectId: project.id,
      guestIdentityId: guest.id,
      status: 'confirmed',
      startDate: new Date('2026-09-10'),
      endDate: new Date('2026-09-15'),
      totalThb: 50_000,
    });

    await createConflictNotifications(db, unit.id, [
      {
        event: {
          uid: 'ota-1',
          summary: 'Airbnb hold',
          dtStart: new Date('2026-09-12'),
          dtEnd: new Date('2026-09-14'),
        },
        conflictingBooking: booking,
      },
    ]);

    const alerts = await getUnitIcalConflictAlerts(db, unit.id);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.bookingId).toBe(booking.id);
    expect(alerts[0]?.unitId).toBe(unit.id);
    expect(alerts[0]?.unitName).toBe('Villa 1');
    expect(alerts[0]?.guestName).toBe('Alex Guest');
    expect(alerts[0]?.startDate).toBe('2026-09-12');
    expect(alerts[0]?.endDate).toBe('2026-09-14');
  });

  it('ignores conflicts for cancelled bookings', async () => {
    const admin = await createIdentity({ firstName: 'Ops', lastName: 'Admin', isAdmin: true });
    const guest = await createIdentity({ firstName: 'Alex', lastName: 'Guest' });
    const project = await createProject({ name: 'Conflict Project', status: 'live' });
    const unit = await createUnit({ projectId: project.id, name: 'Villa 1', status: 'live' });
    const booking = await createBooking({
      unitId: unit.id,
      projectId: project.id,
      guestIdentityId: guest.id,
      status: 'cancelled',
      startDate: new Date('2026-09-10'),
      endDate: new Date('2026-09-15'),
      totalThb: 50_000,
    });

    await createConflictNotifications(db, unit.id, [
      {
        event: {
          uid: 'ota-1',
          summary: 'Airbnb hold',
          dtStart: new Date('2026-09-12'),
          dtEnd: new Date('2026-09-14'),
        },
        conflictingBooking: booking,
      },
    ]);

    const alerts = await getUnitIcalConflictAlerts(db, unit.id);
    expect(alerts).toHaveLength(0);
  });

  it('returns project-scoped conflicts for the ops board', async () => {
    await createIdentity({ firstName: 'Ops', lastName: 'Admin', isAdmin: true });
    const guest = await createIdentity({ firstName: 'Alex', lastName: 'Guest' });
    const projectA = await createProject({ name: 'Project A', status: 'live' });
    const projectB = await createProject({ name: 'Project B', status: 'live' });
    const unitA = await createUnit({ projectId: projectA.id, name: 'Unit A', status: 'live' });
    const unitB = await createUnit({ projectId: projectB.id, name: 'Unit B', status: 'live' });

    const bookingA = await createBooking({
      unitId: unitA.id,
      projectId: projectA.id,
      guestIdentityId: guest.id,
      status: 'confirmed',
      startDate: new Date('2026-09-10'),
      endDate: new Date('2026-09-15'),
    });
    const bookingB = await createBooking({
      unitId: unitB.id,
      projectId: projectB.id,
      guestIdentityId: guest.id,
      status: 'confirmed',
      startDate: new Date('2026-09-20'),
      endDate: new Date('2026-09-25'),
    });

    await createConflictNotifications(db, unitA.id, [
      {
        event: {
          uid: 'ota-a',
          summary: 'Airbnb',
          dtStart: new Date('2026-09-11'),
          dtEnd: new Date('2026-09-13'),
        },
        conflictingBooking: bookingA,
      },
    ]);
    await createConflictNotifications(db, unitB.id, [
      {
        event: {
          uid: 'ota-b',
          summary: 'Airbnb',
          dtStart: new Date('2026-09-21'),
          dtEnd: new Date('2026-09-23'),
        },
        conflictingBooking: bookingB,
      },
    ]);

    const scoped = await getProjectIcalConflictAlerts(db, { projectIds: [projectA.id] });
    expect(scoped).toHaveLength(1);
    expect(scoped[0]?.unitName).toBe('Unit A');

    const empty = await getProjectIcalConflictAlerts(db, { projectIds: [] });
    expect(empty).toEqual([]);
  });

  it('filters by explicit unit ids for portfolio-scoped surfaces', async () => {
    await createIdentity({ firstName: 'Ops', lastName: 'Admin', isAdmin: true });
    const guest = await createIdentity({ firstName: 'Alex', lastName: 'Guest' });
    const project = await createProject({ name: 'Project', status: 'live' });
    const unitA = await createUnit({ projectId: project.id, name: 'Unit A', status: 'live' });
    const unitB = await createUnit({ projectId: project.id, name: 'Unit B', status: 'live' });

    const bookingA = await createBooking({
      unitId: unitA.id,
      projectId: project.id,
      guestIdentityId: guest.id,
      status: 'confirmed',
      startDate: new Date('2026-09-10'),
      endDate: new Date('2026-09-15'),
    });
    const bookingB = await createBooking({
      unitId: unitB.id,
      projectId: project.id,
      guestIdentityId: guest.id,
      status: 'confirmed',
      startDate: new Date('2026-09-20'),
      endDate: new Date('2026-09-25'),
    });

    await createConflictNotifications(db, unitA.id, [
      {
        event: {
          uid: 'ota-a',
          summary: 'Airbnb',
          dtStart: new Date('2026-09-11'),
          dtEnd: new Date('2026-09-13'),
        },
        conflictingBooking: bookingA,
      },
    ]);
    await createConflictNotifications(db, unitB.id, [
      {
        event: {
          uid: 'ota-b',
          summary: 'Airbnb',
          dtStart: new Date('2026-09-21'),
          dtEnd: new Date('2026-09-23'),
        },
        conflictingBooking: bookingB,
      },
    ]);

    const scoped = await getProjectIcalConflictAlerts(db, { unitIds: [unitA.id] });
    expect(scoped).toHaveLength(1);
    expect(scoped[0]?.unitName).toBe('Unit A');
  });
});
