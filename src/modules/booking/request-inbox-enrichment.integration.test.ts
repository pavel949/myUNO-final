import { beforeEach, describe, expect, it } from 'vitest';
import {
  createBooking,
  createIdentity,
  createProject,
  createUnit,
  db,
  resetDb,
} from '@/test/util';
import {
  enrichBookingRequestInbox,
  summarizePriceBreakdown,
} from './request-inbox-enrichment';

describe('summarizePriceBreakdown', () => {
  it('maps stored satang breakdown into baht display lines', () => {
    const lines = summarizePriceBreakdown(
      {
        subtotal_thb: 800_000,
        cleaning_fee_thb: 50_000,
        los_discount_thb: 80_000,
        early_bird_discount_thb: 0,
        service_fee_thb: 40_000,
        occupancy_tax_thb: 10_000,
        total_thb: 820_000,
        lines: [],
      },
      820_000
    );

    expect(lines).toEqual([
      { labelKey: 'booking.request_breakdown.subtotal', amountThb: 8000 },
      { labelKey: 'booking.request_breakdown.los_discount', amountThb: -800 },
      { labelKey: 'booking.request_breakdown.cleaning_fee', amountThb: 500 },
      { labelKey: 'booking.request_breakdown.service_fee', amountThb: 400 },
      { labelKey: 'booking.request_breakdown.occupancy_tax', amountThb: 100 },
      { labelKey: 'booking.request_breakdown.total', amountThb: 8200 },
    ]);
  });

  it('falls back to total only when breakdown is missing', () => {
    expect(summarizePriceBreakdown(null, 500_000)).toEqual([
      { labelKey: 'booking.request_breakdown.total', amountThb: 5000 },
    ]);
  });
});

describe('enrichBookingRequestInbox', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('attaches completed stay counts and breakdown lines', async () => {
    const project = await createProject({ name: 'Project A', status: 'live' });
    const unit = await createUnit({ projectId: project.id, name: 'Unit A', status: 'live' });
    const guest = await createIdentity({ firstName: 'Guest', lastName: 'Repeat' });
    const otherGuest = await createIdentity({ firstName: 'Guest', lastName: 'New' });

    await createBooking({
      unitId: unit.id,
      projectId: project.id,
      guestIdentityId: guest.id,
      status: 'completed',
      startDate: new Date('2026-05-01'),
      endDate: new Date('2026-05-04'),
      totalThb: 100_000,
    });
    await createBooking({
      unitId: unit.id,
      projectId: project.id,
      guestIdentityId: guest.id,
      status: 'completed',
      startDate: new Date('2026-06-01'),
      endDate: new Date('2026-06-04'),
      totalThb: 120_000,
    });

    const requested = await createBooking({
      unitId: unit.id,
      projectId: project.id,
      guestIdentityId: guest.id,
      status: 'requested',
      startDate: new Date('2026-08-10'),
      endDate: new Date('2026-08-13'),
      totalThb: 300_000,
    });
    await db.booking.update({
      where: { id: requested.id },
      data: {
        priceBreakdown: {
          subtotal_thb: 250_000,
          cleaning_fee_thb: 50_000,
          los_discount_thb: 0,
          early_bird_discount_thb: 0,
          service_fee_thb: 0,
          occupancy_tax_thb: 0,
          total_thb: 300_000,
          lines: [],
        },
      },
    });

    const otherRequest = await createBooking({
      unitId: unit.id,
      projectId: project.id,
      guestIdentityId: otherGuest.id,
      status: 'requested',
      startDate: new Date('2026-08-12'),
      endDate: new Date('2026-08-14'),
      totalThb: 200_000,
    });

    const rows = await db.booking.findMany({
      where: { id: { in: [requested.id, otherRequest.id] } },
      select: {
        id: true,
        startDate: true,
        endDate: true,
        totalThb: true,
        adults: true,
        children: true,
        requestExpiresAt: true,
        priceBreakdown: true,
        project: { select: { name: true } },
        unit: { select: { id: true, name: true } },
        guestIdentity: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { startDate: 'asc' },
    });

    const enriched = await enrichBookingRequestInbox(db, rows);

    expect(enriched[0]?.completedStayCount).toBe(2);
    expect(enriched[0]?.nights).toBe(3);
    expect(enriched[0]?.breakdownLines[0]?.amountThb).toBe(2500);
    expect(enriched[1]?.completedStayCount).toBe(0);
  });
});
