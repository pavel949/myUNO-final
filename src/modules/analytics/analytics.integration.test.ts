import { describe, it, expect, beforeEach } from 'vitest';
import { resetDb, createIdentity, createProject, createUnit } from '@/test/util';
import { prisma } from '@/lib/prisma';
import {
  track,
  rollupMetricsDaily,
  rollupMetricsRange,
  getMetricsSeries,
  getUnitOccupancySparklines,
  detectBuyerSignals,
} from './index';
import { AnalyticsEventKey, BookingStatus, BuyerSignalKey } from '@prisma/client';

describe('Analytics Module', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('track', () => {
    it('creates an analytics event with provided dimensions', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);
      const identity = await createIdentity();

      await track(prisma, 'stay_confirmed', {
        projectId: project.id,
        unitId: unit.id,
        identityId: identity.id,
        nights: 3,
        revenue: 10000,
      });

      const event = await prisma.analyticsEvent.findFirst({
        where: {
          eventKey: 'stay_confirmed',
          projectId: project.id,
        },
      });

      expect(event).toBeDefined();
      expect(event?.unitId).toBe(unit.id);
      expect(event?.identityId).toBe(identity.id);
      expect(event?.dimensions).toMatchObject({
        nights: 3,
        revenue: 10000,
      });
    });

    it('stores null for missing entity IDs', async () => {
      await track(prisma, 'page_landing_viewed', {
        locale: 'en',
      });

      const event = await prisma.analyticsEvent.findFirst({
        where: { eventKey: 'page_landing_viewed' },
      });

      expect(event?.projectId).toBeNull();
      expect(event?.unitId).toBeNull();
      expect(event?.identityId).toBeNull();
    });

    it('handles track failures gracefully without throwing', async () => {
      // Even with invalid data, track should not throw
      expect(async () => {
        await track(prisma, 'stay_confirmed' as AnalyticsEventKey, {
          invalidField: 'value',
        });
      }).not.toThrow();
    });
  });

  describe('rollupMetricsDaily', () => {
    it('computes metrics for a unit on a given date', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);
      const owner = await createIdentity();
      const guest1 = await createIdentity();
      const guest2 = await createIdentity();

      const targetDate = new Date('2025-01-15');

      // Create two confirmed bookings on this date
      await prisma.booking.create({
        data: {
          unitId: unit.id,
          projectId: project.id,
          guestIdentityId: guest1.id,
          bookingType: 'guest_stay',
          channel: 'direct',
          startDate: new Date('2025-01-15'),
          endDate: new Date('2025-01-16'),
          adults: 1,
          children: 0,
          totalThb: 5000,
          status: BookingStatus.confirmed,
        },
      });

      await prisma.booking.create({
        data: {
          unitId: unit.id,
          projectId: project.id,
          guestIdentityId: guest2.id,
          bookingType: 'guest_stay',
          channel: 'direct',
          startDate: new Date('2025-01-15'),
          endDate: new Date('2025-01-16'),
          adults: 2,
          children: 1,
          totalThb: 8000,
          status: BookingStatus.confirmed,
        },
      });

      // Run rollup
      await rollupMetricsDaily(prisma, targetDate);

      // Verify metrics
      const metric = await prisma.metricDaily.findUnique({
        where: {
          unitId_date: {
            unitId: unit.id,
            date: new Date('2025-01-15'),
          },
        },
      });

      expect(metric).toBeDefined();
      // A unit-night is occupied or not — two overlapping bookings still occupy one night
      expect(metric?.nightsOccupied).toBe(1);
      expect(metric?.nightsAvailable).toBe(1);
      expect(metric?.rentalRevenueCents).toBe(1300000); // 13000 THB in satang
      expect(metric?.occupancyPct).toBe(100);
    });

    it('attributes multi-night booking revenue per night (no double counting)', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);
      const guest = await createIdentity();

      // 4 nights, 8000 THB total → 2000 THB attributed per night
      await prisma.booking.create({
        data: {
          unitId: unit.id,
          projectId: project.id,
          guestIdentityId: guest.id,
          bookingType: 'guest_stay',
          channel: 'direct',
          startDate: new Date('2025-01-10'),
          endDate: new Date('2025-01-14'),
          adults: 1,
          children: 0,
          totalThb: 8000,
          status: BookingStatus.confirmed,
        },
      });

      const days = await rollupMetricsRange(
        prisma,
        new Date('2025-01-09'),
        new Date('2025-01-14')
      );
      expect(days).toBe(6);

      const rows = await prisma.metricDaily.findMany({
        where: { unitId: unit.id },
        orderBy: { date: 'asc' },
      });
      const totalRevenue = rows.reduce((sum, r) => sum + r.rentalRevenueCents, 0);
      expect(totalRevenue).toBe(800000); // exactly the booking total, once
      const occupiedNights = rows.reduce((sum, r) => sum + r.nightsOccupied, 0);
      expect(occupiedNights).toBe(4); // Jan 10–13 nights; 9th & 14th vacant
    });

    it('marks a non-live, unbooked unit as unavailable', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);
      await prisma.unit.update({ where: { id: unit.id }, data: { status: 'paused' } });

      await rollupMetricsDaily(prisma, new Date('2025-01-15'));

      const metric = await prisma.metricDaily.findUnique({
        where: { unitId_date: { unitId: unit.id, date: new Date('2025-01-15') } },
      });
      expect(metric?.nightsAvailable).toBe(0);
      expect(metric?.occupancyPct).toBe(0);
    });

    it('calculates ADR correctly when there are occupied nights', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);
      const guest = await createIdentity();

      const targetDate = new Date('2025-01-15');

      // Create a booking with 5000 THB
      await prisma.booking.create({
        data: {
          unitId: unit.id,
          projectId: project.id,
          guestIdentityId: guest.id,
          bookingType: 'guest_stay',
          channel: 'direct',
          startDate: new Date('2025-01-15'),
          endDate: new Date('2025-01-16'),
          adults: 1,
          children: 0,
          totalThb: 5000,
          status: BookingStatus.confirmed,
        },
      });

      await rollupMetricsDaily(prisma, targetDate);

      const metric = await prisma.metricDaily.findUnique({
        where: {
          unitId_date: {
            unitId: unit.id,
            date: targetDate,
          },
        },
      });

      // ADR should be 5000 THB = 500,000 cents
      expect(metric?.adrCents).toBe(500000);
    });

    it('ignores bookings with inactive status', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);
      const guest = await createIdentity();

      const targetDate = new Date('2025-01-15');

      // Create a cancelled booking
      await prisma.booking.create({
        data: {
          unitId: unit.id,
          projectId: project.id,
          guestIdentityId: guest.id,
          bookingType: 'guest_stay',
          channel: 'direct',
          startDate: new Date('2025-01-15'),
          endDate: new Date('2025-01-16'),
          adults: 1,
          children: 0,
          totalThb: 5000,
          status: BookingStatus.cancelled,
        },
      });

      await rollupMetricsDaily(prisma, targetDate);

      const metric = await prisma.metricDaily.findUnique({
        where: {
          unitId_date: {
            unitId: unit.id,
            date: targetDate,
          },
        },
      });

      expect(metric?.nightsOccupied).toBe(0);
      expect(metric?.rentalRevenueCents).toBe(0);
    });
  });

  describe('getMetricsSeries', () => {
    it('aggregates day rows into month buckets with weighted occupancy', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);
      const guest = await createIdentity();
      await prisma.unit.update({ where: { id: unit.id }, data: { status: 'live' } });

      // 2 occupied nights (Jan 10–12) at 3000 THB/night
      await prisma.booking.create({
        data: {
          unitId: unit.id,
          projectId: project.id,
          guestIdentityId: guest.id,
          bookingType: 'guest_stay',
          channel: 'direct',
          startDate: new Date('2025-01-10'),
          endDate: new Date('2025-01-12'),
          adults: 1,
          children: 0,
          totalThb: 6000,
          status: BookingStatus.confirmed,
        },
      });

      await rollupMetricsRange(prisma, new Date('2025-01-10'), new Date('2025-01-13'));

      const series = await getMetricsSeries(prisma, {
        unitIds: [unit.id],
        from: new Date('2025-01-01'),
        to: new Date('2025-01-31'),
        groupBy: 'month',
      });

      expect(series).toHaveLength(1);
      expect(series[0].period).toBe('2025-01');
      expect(series[0].nightsOccupied).toBe(2);
      expect(series[0].rentalRevenueThb).toBe(6000);
      // createdAt is "now" (after 2025), so vacant 2025 days don't count as available
      expect(series[0].nightsAvailable).toBe(2);
      expect(series[0].occupancyPct).toBe(100);
    });

    it('returns per-day buckets and unit sparkline dots', async () => {
      const project = await createProject();
      const unit = await createUnit(project.id);
      const guest = await createIdentity();

      await prisma.booking.create({
        data: {
          unitId: unit.id,
          projectId: project.id,
          guestIdentityId: guest.id,
          bookingType: 'guest_stay',
          channel: 'direct',
          startDate: new Date('2025-03-05'),
          endDate: new Date('2025-03-06'),
          adults: 1,
          children: 0,
          totalThb: 2500,
          status: BookingStatus.confirmed,
        },
      });

      await rollupMetricsRange(prisma, new Date('2025-03-04'), new Date('2025-03-06'));

      const series = await getMetricsSeries(prisma, {
        projectId: project.id,
        from: new Date('2025-03-01'),
        to: new Date('2025-03-31'),
        groupBy: 'day',
      });
      expect(series.map((p) => p.period)).toEqual([
        '2025-03-04',
        '2025-03-05',
        '2025-03-06',
      ]);
      expect(series[1].rentalRevenueThb).toBe(2500);

      const sparks = await getUnitOccupancySparklines(
        prisma,
        [unit.id],
        30,
        new Date('2025-03-06')
      );
      const dots = sparks[unit.id];
      expect(dots.length).toBe(3);
      expect(dots.find((d) => d.date === '2025-03-05')?.occupied).toBe(true);
      expect(dots.find((d) => d.date === '2025-03-04')?.occupied).toBe(false);
    });
  });

  describe('detectBuyerSignals', () => {
    it('detects repeat_stay signal when guest has 2+ completed stays', async () => {
      const guest = await createIdentity();
      const project = await createProject();
      const unit = await createUnit(project.id);

      // Create two completed stays
      await prisma.booking.create({
        data: {
          unitId: unit.id,
          projectId: project.id,
          guestIdentityId: guest.id,
          bookingType: 'guest_stay',
          channel: 'direct',
          startDate: new Date('2025-01-01'),
          endDate: new Date('2025-01-05'),
          adults: 1,
          children: 0,
          totalThb: 10000,
          status: BookingStatus.completed,
        },
      });

      await prisma.booking.create({
        data: {
          unitId: unit.id,
          projectId: project.id,
          guestIdentityId: guest.id,
          bookingType: 'guest_stay',
          channel: 'direct',
          startDate: new Date('2025-02-01'),
          endDate: new Date('2025-02-05'),
          adults: 1,
          children: 0,
          totalThb: 10000,
          status: BookingStatus.completed,
        },
      });

      await detectBuyerSignals(prisma);

      const signal = await prisma.buyerSignal.findUnique({
        where: {
          identityId_signalKey: {
            identityId: guest.id,
            signalKey: BuyerSignalKey.repeat_stay,
          },
        },
      });

      expect(signal).toBeDefined();
      expect(signal?.strength).toBe(2);
      expect(signal?.status).toBe('open');
    });

    it('sets strength to 3 for guests with 3+ completed stays', async () => {
      const guest = await createIdentity();
      const project = await createProject();
      const unit = await createUnit(project.id);

      // Create three completed stays
      for (let i = 0; i < 3; i++) {
        await prisma.booking.create({
          data: {
            unitId: unit.id,
            projectId: project.id,
            guestIdentityId: guest.id,
            bookingType: 'guest_stay',
            channel: 'direct',
            startDate: new Date(2025, i, 1),
            endDate: new Date(2025, i, 5),
            adults: 1,
            children: 0,
            totalThb: 10000,
            status: BookingStatus.completed,
          },
        });
      }

      await detectBuyerSignals(prisma);

      const signal = await prisma.buyerSignal.findUnique({
        where: {
          identityId_signalKey: {
            identityId: guest.id,
            signalKey: BuyerSignalKey.repeat_stay,
          },
        },
      });

      expect(signal?.strength).toBe(3);
    });

    it('detects long_stay signal for stays ≥ 28 nights', async () => {
      const guest = await createIdentity();
      const project = await createProject();
      const unit = await createUnit(project.id);

      await prisma.booking.create({
        data: {
          unitId: unit.id,
          projectId: project.id,
          guestIdentityId: guest.id,
          bookingType: 'guest_stay',
          channel: 'direct',
          startDate: new Date('2025-01-01'),
          endDate: new Date('2025-02-01'),
          adults: 1,
          children: 0,
          totalThb: 100000,
          status: BookingStatus.completed,
        },
      });

      await detectBuyerSignals(prisma);

      const signal = await prisma.buyerSignal.findUnique({
        where: {
          identityId_signalKey: {
            identityId: guest.id,
            signalKey: BuyerSignalKey.long_stay,
          },
        },
      });

      expect(signal).toBeDefined();
      expect(signal?.strength).toBe(2);
    });

    it('does not detect long_stay signal for stays < 28 nights', async () => {
      const guest = await createIdentity();
      const project = await createProject();
      const unit = await createUnit(project.id);

      await prisma.booking.create({
        data: {
          unitId: unit.id,
          projectId: project.id,
          guestIdentityId: guest.id,
          bookingType: 'guest_stay',
          channel: 'direct',
          startDate: new Date('2025-01-01'),
          endDate: new Date('2025-01-10'),
          adults: 1,
          children: 0,
          totalThb: 50000,
          status: BookingStatus.completed,
        },
      });

      await detectBuyerSignals(prisma);

      const signal = await prisma.buyerSignal.findFirst({
        where: {
          identityId: guest.id,
          signalKey: BuyerSignalKey.long_stay,
        },
      });

      expect(signal).toBeNull();
    });
  });

  describe('KPI Functions', () => {
    it('getKpiSummary calculates occupancy, ADR, RevPAN correctly', async () => {
      const { getKpiSummary } = await import('./kpi.service');
      const project = await createProject();
      const unit = await createUnit(project.id);
      const from = new Date('2025-01-01');
      const to = new Date('2025-01-31');

      // Create metric: 30 nights available, 20 occupied (no owner stays), 10000 THB revenue
      await prisma.metricDaily.create({
        data: {
          date: from,
          projectId: project.id,
          unitId: unit.id,
          nightsAvailable: 30,
          nightsOccupied: 20,
          ownerStayNights: 0,
          rentalRevenueCents: 1000000, // 10000 THB
        },
      });

      const kpi = await getKpiSummary(prisma, { from, to });

      expect(kpi.occupancyPct).toBe(66); // 20/30
      expect(kpi.adrThb).toBe(500); // 10000 / 20
      expect(kpi.revpanThb).toBe(333); // 10000 / 30
    });

    it('getKpiSummary excludes owner stay nights from ADR', async () => {
      const { getKpiSummary } = await import('./kpi.service');
      const project = await createProject();
      const unit = await createUnit(project.id);
      const from = new Date('2025-01-01');
      const to = new Date('2025-01-31');

      // 30 nights available, 20 occupied (5 owner, 15 guest), 10000 THB revenue from guest stays
      await prisma.metricDaily.create({
        data: {
          date: from,
          projectId: project.id,
          unitId: unit.id,
          nightsAvailable: 30,
          nightsOccupied: 20,
          ownerStayNights: 5,
          rentalRevenueCents: 1000000,
        },
      });

      const kpi = await getKpiSummary(prisma, { from, to });

      expect(kpi.occupancyPct).toBe(66); // 20/30
      expect(kpi.adrThb).toBe(666); // 10000 / 15 (guest nights only)
      expect(kpi.revpanThb).toBe(333); // 10000 / 30
    });

    it('getServicesAttachRate returns percentage of bookings with services', async () => {
      const { getServicesAttachRate } = await import('./kpi.service');
      const project = await createProject();
      const unit = await createUnit(project.id);
      const guest = await createIdentity();
      const from = new Date('2025-01-01');
      const to = new Date('2025-01-31');

      // Create 2 bookings, 1 with service order
      const b1 = await prisma.booking.create({
        data: {
          unitId: unit.id,
          projectId: project.id,
          guestIdentityId: guest.id,
          bookingType: 'guest_stay',
          channel: 'direct',
          startDate: from,
          endDate: new Date('2025-01-10'),
          adults: 1,
          children: 0,
          totalThb: 50000,
          status: BookingStatus.completed,
        },
      });

      const b2 = await prisma.booking.create({
        data: {
          unitId: unit.id,
          projectId: project.id,
          guestIdentityId: guest.id,
          bookingType: 'guest_stay',
          channel: 'direct',
          startDate: new Date('2025-01-15'),
          endDate: new Date('2025-01-20'),
          adults: 1,
          children: 0,
          totalThb: 30000,
          status: BookingStatus.completed,
        },
      });

      await prisma.serviceOrder.create({
        data: {
          bookingId: b1.id,
          serviceId: 'svc-1',
          status: 'fulfilled',
          totalThb: 5000,
        },
      });

      const rate = await getServicesAttachRate(prisma, { from, to });
      expect(rate).toBe(50); // 1 out of 2 bookings
    });

    it('getDirectShare returns percentage of direct bookings', async () => {
      const { getDirectShare } = await import('./kpi.service');
      const project = await createProject();
      const unit = await createUnit(project.id);
      const guest = await createIdentity();
      const from = new Date('2025-01-01');
      const to = new Date('2025-01-31');

      // Create 2 bookings: 1 direct, 1 via OTA
      await prisma.booking.create({
        data: {
          unitId: unit.id,
          projectId: project.id,
          guestIdentityId: guest.id,
          bookingType: 'guest_stay',
          channel: 'direct',
          startDate: from,
          endDate: new Date('2025-01-10'),
          adults: 1,
          children: 0,
          totalThb: 50000,
          status: BookingStatus.completed,
        },
      });

      await prisma.booking.create({
        data: {
          unitId: unit.id,
          projectId: project.id,
          guestIdentityId: guest.id,
          bookingType: 'guest_stay',
          channel: 'airbnb',
          startDate: new Date('2025-01-15'),
          endDate: new Date('2025-01-20'),
          adults: 1,
          children: 0,
          totalThb: 30000,
          status: BookingStatus.completed,
        },
      });

      const share = await getDirectShare(prisma, { from, to });
      expect(share).toBe(50); // 1 out of 2
    });

    it('getRepeatGuestRate returns percentage of guests with 2+ bookings', async () => {
      const { getRepeatGuestRate } = await import('./kpi.service');
      const project = await createProject();
      const unit = await createUnit(project.id);
      const guest1 = await createIdentity();
      const guest2 = await createIdentity();
      const from = new Date('2025-01-01');
      const to = new Date('2025-01-31');

      // guest1: 2 bookings (repeat), guest2: 1 booking
      await prisma.booking.create({
        data: {
          unitId: unit.id,
          projectId: project.id,
          guestIdentityId: guest1.id,
          bookingType: 'guest_stay',
          channel: 'direct',
          startDate: from,
          endDate: new Date('2025-01-10'),
          adults: 1,
          children: 0,
          totalThb: 50000,
          status: BookingStatus.completed,
        },
      });

      await prisma.booking.create({
        data: {
          unitId: unit.id,
          projectId: project.id,
          guestIdentityId: guest1.id,
          bookingType: 'guest_stay',
          channel: 'direct',
          startDate: new Date('2025-01-15'),
          endDate: new Date('2025-01-20'),
          adults: 1,
          children: 0,
          totalThb: 30000,
          status: BookingStatus.completed,
        },
      });

      await prisma.booking.create({
        data: {
          unitId: unit.id,
          projectId: project.id,
          guestIdentityId: guest2.id,
          bookingType: 'guest_stay',
          channel: 'direct',
          startDate: new Date('2025-01-25'),
          endDate: new Date('2025-01-27'),
          adults: 1,
          children: 0,
          totalThb: 20000,
          status: BookingStatus.completed,
        },
      });

      const rate = await getRepeatGuestRate(prisma, { from, to });
      expect(rate).toBe(50); // 1 repeat guest out of 2 unique
    });
  });
});
