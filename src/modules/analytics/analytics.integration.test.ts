import { describe, it, expect, beforeEach } from 'vitest';
import { resetDb, factories } from '@/test/util';
import { prisma } from '@/lib/prisma';
import { track, rollupMetricsDaily, detectBuyerSignals } from './index';
import { AnalyticsEventKey, BookingStatus, BuyerSignalKey } from '@prisma/client';

describe('Analytics Module', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('track', () => {
    it('creates an analytics event with provided dimensions', async () => {
      const project = await factories.project(prisma);
      const unit = await factories.unit(prisma, { projectId: project.id });
      const identity = await factories.identity(prisma);

      await track(prisma, 'stay_confirmed', {
        projectId: project.id,
        unitId: unit.id,
        identityId: identity.id,
        bookingId: 'booking-123',
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
      const project = await factories.project(prisma);
      const unit = await factories.unit(prisma, { projectId: project.id });
      const owner = await factories.identity(prisma);
      const guest1 = await factories.identity(prisma);
      const guest2 = await factories.identity(prisma);

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
      expect(metric?.nightsOccupied).toBe(2);
      expect(metric?.rentalRevenueCents).toBe(1300000); // 13000 THB in cents
      expect(metric?.occupancyPct).toBeGreaterThan(0);
    });

    it('calculates ADR correctly when there are occupied nights', async () => {
      const project = await factories.project(prisma);
      const unit = await factories.unit(prisma, { projectId: project.id });
      const guest = await factories.identity(prisma);

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
      const project = await factories.project(prisma);
      const unit = await factories.unit(prisma, { projectId: project.id });
      const guest = await factories.identity(prisma);

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

  describe('detectBuyerSignals', () => {
    it('detects repeat_stay signal when guest has 2+ completed stays', async () => {
      const guest = await factories.identity(prisma);
      const project = await factories.project(prisma);
      const unit = await factories.unit(prisma, { projectId: project.id });

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
      const guest = await factories.identity(prisma);
      const project = await factories.project(prisma);
      const unit = await factories.unit(prisma, { projectId: project.id });

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
      const guest = await factories.identity(prisma);
      const project = await factories.project(prisma);
      const unit = await factories.unit(prisma, { projectId: project.id });

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
      const guest = await factories.identity(prisma);
      const project = await factories.project(prisma);
      const unit = await factories.unit(prisma, { projectId: project.id });

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
});
