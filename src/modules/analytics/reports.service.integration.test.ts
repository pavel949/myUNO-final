import { describe, it, expect, beforeEach } from 'vitest';
import { db, resetDb, createIdentity, createProject, createUnit, createBooking } from '@/test/util';
import { occupancyByCategory, revenueByChannel, revenueSplit } from './reports.service';

describe('project reports (LY-10)', () => {
  const RANGE_START = new Date('2026-08-01');
  const RANGE_END = new Date('2026-08-31'); // 30 nights
  let projectId: string;
  let guestId: string;

  beforeEach(async () => {
    await resetDb();
    const project = await createProject({ status: 'live' });
    projectId = project.id;
    const guest = await createIdentity();
    guestId = guest.id;
  });

  it('computes occupancy by category with range clipping', async () => {
    const unitA = await createUnit({
      projectId, status: 'live', categoryKey: 'superior_2br', name: 'A-01',
    });
    await createUnit({ projectId, status: 'live', categoryKey: 'superior_2br', name: 'A-02' });
    const unitG = await createUnit({
      projectId, status: 'live', categoryKey: 'grand_deluxe_3br', name: 'G-01',
    });
    // draft unit never enters the availability base
    await createUnit({ projectId, status: 'draft', categoryKey: 'superior_2br', name: 'X' });

    // 10 nights inside the range
    await createBooking({
      unitId: unitA.id, projectId, guestIdentityId: guestId, status: 'confirmed',
      startDate: new Date('2026-08-05'), endDate: new Date('2026-08-15'),
    });
    // Straddles the start: only 4 nights (Aug 1–5) count
    const g2 = await createIdentity();
    await createBooking({
      unitId: unitG.id, projectId, guestIdentityId: g2.id, status: 'checked_out',
      startDate: new Date('2026-07-28'), endDate: new Date('2026-08-05'),
    });
    // Cancelled never counts
    const g3 = await createIdentity();
    await createBooking({
      unitId: unitA.id, projectId, guestIdentityId: g3.id, status: 'cancelled',
      startDate: new Date('2026-08-20'), endDate: new Date('2026-08-25'),
    });

    const rows = await occupancyByCategory(db, projectId, RANGE_START, RANGE_END);
    const byKey = Object.fromEntries(rows.map((r) => [r.categoryKey, r]));

    expect(byKey.superior_2br.unitCount).toBe(2);
    expect(byKey.superior_2br.availableNights).toBe(60); // 2 × 30
    expect(byKey.superior_2br.bookedNights).toBe(10);
    expect(byKey.superior_2br.occupancyPct).toBe(16.7);
    expect(byKey.grand_deluxe_3br.bookedNights).toBe(4);
  });

  it('splits ledger revenue by booking channel and separates ancillary', async () => {
    const unit = await createUnit({ projectId, status: 'live', name: 'A-01' });
    const direct = await createBooking({
      unitId: unit.id, projectId, guestIdentityId: guestId, status: 'confirmed',
      startDate: new Date('2026-08-05'), endDate: new Date('2026-08-10'),
    });
    const agentGuest = await createIdentity();
    const agent = await db.booking.create({
      data: {
        unitId: unit.id, projectId, guestIdentityId: agentGuest.id,
        bookingType: 'guest_stay', channel: 'agent', status: 'confirmed',
        startDate: new Date('2026-08-12'), endDate: new Date('2026-08-15'),
        adults: 2, children: 0, totalThb: 300000, verificationStatus: 'not_required',
      },
    });

    await db.ledgerEntry.createMany({
      data: [
        { entryType: 'rental_revenue', amountThb: 500000, projectId, bookingId: direct.id, occurredOn: new Date('2026-08-06'), description: 'stay' },
        { entryType: 'rental_revenue', amountThb: 300000, projectId, bookingId: agent.id, occurredOn: new Date('2026-08-13'), description: 'stay' },
        { entryType: 'service_commission', amountThb: 45000, projectId, occurredOn: new Date('2026-08-14'), description: 'service take' },
        // Outside the range — must not count
        { entryType: 'rental_revenue', amountThb: 999999, projectId, bookingId: direct.id, occurredOn: new Date('2026-09-15'), description: 'later stay' },
      ],
    });

    // Ledger entries are in satang; revenueByChannel/revenueSplit convert to
    // baht at the display boundary (CLAUDE.md money rules; Q47).
    const channels = await revenueByChannel(db, projectId, RANGE_START, RANGE_END);
    const byChannel = Object.fromEntries(channels.map((c) => [c.channel, c]));
    expect(byChannel.direct.revenueThb).toBe(5000);
    expect(byChannel.direct.bookings).toBe(1);
    expect(byChannel.agent.revenueThb).toBe(3000);

    const split = await revenueSplit(db, projectId, RANGE_START, RANGE_END);
    expect(split.rentalThb).toBe(8000);
    expect(split.ancillaryThb).toBe(450);
  });
});
