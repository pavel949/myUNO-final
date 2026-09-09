import { beforeEach, describe, expect, it } from 'vitest';
import { db, resetDb, createIdentity, createProject, createUnit } from '@/test/util';
import { raiseDispute } from './dispute.service';

describe('dispute subject concurrency guard', () => {
  beforeEach(async () => resetDb());

  it('allows only one concurrent dispute for the same booking', async () => {
    const project = await createProject();
    const unit = await createUnit({ projectId: project.id });
    const guest = await createIdentity();

    const booking = await db.booking.create({
      data: {
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guest.id,
        bookingType: 'guest_stay',
        channel: 'direct',
        status: 'confirmed',
        startDate: new Date('2026-09-20'),
        endDate: new Date('2026-09-25'),
        adults: 2,
        children: 0,
        totalThb: 100_000,
      },
    });

    const request = () =>
      raiseDispute(db, {
        subjectType: 'booking',
        subjectId: booking.id,
        raisedByIdentityId: guest.id,
        raisedByRole: 'guest',
        title: 'Booking dispute',
        description: 'Concurrent duplicate attempt',
      });

    const results = await Promise.allSettled([request(), request()]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);

    expect(
      await db.dispute.count({ where: { subjectType: 'booking', subjectId: booking.id } })
    ).toBe(1);
    expect(await db.ticket.count({ where: { projectId: project.id } })).toBe(1);
  });
});
