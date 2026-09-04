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
import { getUnitIcalConflictAlerts } from './unit-ical-conflicts';

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
});
