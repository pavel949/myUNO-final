import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBooking, createIdentity, createProject, createUnit, db, resetDb } from '@/test/util';
import { getOpsBoard } from './ops-board.service';

describe('Ops board uses each property calendar day', () => {
  beforeEach(resetDb);
  afterEach(() => vi.unstubAllEnvs());

  async function dailyStays(timezone: string, day: string) {
    const project = await createProject({ status: 'live' });
    await db.project.update({ where: { id: project.id }, data: { timezone } });
    const guest = await createIdentity();
    const arriving = await createUnit({ projectId: project.id, status: 'live', name: 'Arriving' });
    const departing = await createUnit({ projectId: project.id, status: 'live', name: 'Departing' });
    const arrival = await createBooking({ unitId: arriving.id, projectId: project.id, guestIdentityId: guest.id,
      status: 'confirmed', startDate: new Date(day), endDate: new Date('2027-01-12') });
    const departure = await createBooking({ unitId: departing.id, projectId: project.id, guestIdentityId: guest.id,
      status: 'checked_in', startDate: new Date('2027-01-04'), endDate: new Date(day) });
    return { project, guest, arrival, departure };
  }

  it.each(['UTC', 'Asia/Bangkok', 'America/Los_Angeles'])('finds Phuket morning arrivals on a %s server', async (serverTimezone) => {
    vi.stubEnv('TZ', serverTimezone);
    const { project, arrival, departure } = await dailyStays('Asia/Bangkok', '2027-01-09');
    // 01:30 on 9 January in Phuket, while the UTC date is still 8 January.
    const board = await getOpsBoard(db, new Date('2027-01-08T18:30:00Z'), { projectIds: [project.id] });
    expect(board.arrivals.map(row => row.id)).toEqual([arrival.id]);
    expect(board.departures.map(row => row.id)).toEqual([departure.id]);
  });

  it('uses separate current dates for projects in different timezones without leaking another project', async () => {
    const phuket = await dailyStays('Asia/Bangkok', '2027-01-09');
    const pacific = await dailyStays('America/Los_Angeles', '2027-01-08');
    const outside = await dailyStays('Asia/Bangkok', '2027-01-09');
    const board = await getOpsBoard(db, new Date('2027-01-09T00:30:00Z'), {
      projectIds: [phuket.project.id, pacific.project.id],
    });
    expect(board.arrivals.map(row => row.id).sort()).toEqual([phuket.arrival.id, pacific.arrival.id].sort());
    expect(board.departures.map(row => row.id).sort()).toEqual([phuket.departure.id, pacific.departure.id].sort());
    expect(board.arrivals.some(row => row.id === outside.arrival.id)).toBe(false);
  });

  it('excludes elapsed card holds while retaining untimed and still-active payment reservations', async () => {
    const { project, guest } = await dailyStays('Asia/Bangkok', '2027-01-09');
    const expected: string[] = [];
    for (const [name, holdExpiresAt] of [
      ['elapsed', new Date(Date.now() - 60_000)],
      ['current', new Date(Date.now() + 3_600_000)],
      ['manual', null],
    ] as const) {
      const unit = await createUnit({ projectId: project.id, name, status: 'live' });
      const booking = await createBooking({ unitId: unit.id, projectId: project.id, guestIdentityId: guest.id,
        startDate: new Date('2027-01-09'), endDate: new Date('2027-01-12'), status: 'pending_payment', holdExpiresAt });
      if (name !== 'elapsed') expected.push(booking.id);
    }
    const board = await getOpsBoard(db, new Date('2027-01-09T10:00:00Z'), { projectIds: [project.id] });
    expect(board.pendingPayment.map(row => row.id).sort()).toEqual(expected.sort());
    expect(board.arrivals.filter(row => row.status === 'pending_payment').map(row => row.id).sort()).toEqual(expected.sort());
  });
});
