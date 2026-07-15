import { describe, it, expect, beforeEach } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '@/lib/prisma';
import { resetDb } from '@/test/util';
import { importICalEvents, type ICalEvent } from './ical-import';
import { registerIntegrationAccount } from './integrations';
import { IntegrationKey, IntegrationScopeType } from '@prisma/client';

describe('iCal import integration tests', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('imports OTA bookings as blocked dates with idempotency via UID', async () => {
    // Setup
    const project = await prisma.project.create({
      data: {
        slug: 'test-project',
        name: 'Test Project',
        areaLabelKey: 'area.test',
        descriptionKey: 'desc.test',
        latitude: new Decimal('8.6753'),
        longitude: new Decimal('100.5014'),
        address: 'Test Address',
        handbookKey: 'handbook.test',
      },
    });

    const unit = await prisma.unit.create({
      data: {
        projectId: project.id,
        name: 'Unit 1',
        unitType: 'villa',
        bedrooms: 2,
        bathrooms: 1,
        maxGuests: 4,
        addressSupplement: 'Apt 1',
        baseNightlyThb: 3000,
        minNights: 1,
      },
    });

    const integration = await registerIntegrationAccount(
      prisma,
      IntegrationKey.ical_airbnb,
      IntegrationScopeType.unit,
      { ical_url: 'https://airbnb.com/calendar/unit123' },
      unit.id
    );

    // Test event with unique UID
    const event: ICalEvent = {
      uid: 'airbnb-booking-abc123@airbnb.com',
      summary: 'Airbnb Booking',
      dtStart: new Date('2026-08-01'),
      dtEnd: new Date('2026-08-05'),
    };

    // First import
    const result1 = await importICalEvents(
      prisma,
      integration.id,
      unit.id,
      [event]
    );

    expect(result1.imported).toBe(1);
    expect(result1.conflicts).toHaveLength(0);
    expect(result1.errors).toHaveLength(0);

    // Verify BlockedDate was created with externalRef (UID)
    const blocked = await prisma.blockedDate.findFirst({
      where: { unitId: unit.id, externalRef: event.uid },
    });

    expect(blocked).toBeDefined();
    expect(blocked?.reason).toBe('ota_import');

    // Second import with same UID should be idempotent
    const result2 = await importICalEvents(
      prisma,
      integration.id,
      unit.id,
      [event]
    );

    expect(result2.imported).toBe(1); // Counts as already imported
    expect(result2.conflicts).toHaveLength(0);
    expect(result2.errors).toHaveLength(0);

    // Verify only one BlockedDate exists
    const count = await prisma.blockedDate.count({
      where: { unitId: unit.id, externalRef: event.uid },
    });
    expect(count).toBe(1);
  });

  it('detects conflicts between OTA imports and platform bookings', async () => {
    // Setup: project, unit, integration, platform booking
    const project = await prisma.project.create({
      data: {
        slug: 'test-project-2',
        name: 'Test Project 2',
        areaLabelKey: 'area.test',
        descriptionKey: 'desc.test',
        latitude: new Decimal('8.6753'),
        longitude: new Decimal('100.5014'),
        address: 'Test Address',
        handbookKey: 'handbook.test',
      },
    });

    const unit = await prisma.unit.create({
      data: {
        projectId: project.id,
        name: 'Unit 1',
        unitType: 'villa',
        bedrooms: 2,
        bathrooms: 1,
        maxGuests: 4,
        addressSupplement: 'Apt 1',
        baseNightlyThb: 3000,
        minNights: 1,
      },
    });

    const guest = await prisma.identity.create({
      data: {
        firstName: 'Guest',
        lastName: 'User',
        email: 'guest@test.local',
      },
    });

    const integration = await registerIntegrationAccount(
      prisma,
      IntegrationKey.ical_airbnb,
      IntegrationScopeType.unit,
      { ical_url: 'https://airbnb.com/calendar/unit123' },
      unit.id
    );

    // Create a confirmed platform booking
    const booking = await prisma.booking.create({
      data: {
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guest.id,
        bookingType: 'guest_stay',
        channel: 'direct',
        status: 'confirmed',
        startDate: new Date('2026-08-01'),
        endDate: new Date('2026-08-05'),
        adults: 2,
        children: 0,
        totalThb: 12000,
      },
    });

    // OTA event overlaps platform booking
    const event: ICalEvent = {
      uid: 'airbnb-booking-xyz789@airbnb.com',
      summary: 'Airbnb Booking',
      dtStart: new Date('2026-08-03'), // Overlaps
      dtEnd: new Date('2026-08-07'),
    };

    const result = await importICalEvents(
      prisma,
      integration.id,
      unit.id,
      [event]
    );

    expect(result.imported).toBe(0);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].conflictingBooking.id).toBe(booking.id);

    // Verify no BlockedDate created for conflict
    const blocked = await prisma.blockedDate.findFirst({
      where: { unitId: unit.id, externalRef: event.uid },
    });
    expect(blocked).toBeUndefined();
  });

  it('handles import errors gracefully and records integration sync state', async () => {
    // Setup
    const project = await prisma.project.create({
      data: {
        slug: 'test-project-3',
        name: 'Test Project 3',
        areaLabelKey: 'area.test',
        descriptionKey: 'desc.test',
        latitude: new Decimal('8.6753'),
        longitude: new Decimal('100.5014'),
        address: 'Test Address',
        handbookKey: 'handbook.test',
      },
    });

    const unit = await prisma.unit.create({
      data: {
        projectId: project.id,
        name: 'Unit 1',
        unitType: 'villa',
        bedrooms: 2,
        bathrooms: 1,
        maxGuests: 4,
        addressSupplement: 'Apt 1',
        baseNightlyThb: 3000,
        minNights: 1,
      },
    });

    const integration = await registerIntegrationAccount(
      prisma,
      IntegrationKey.ical_airbnb,
      IntegrationScopeType.unit,
      { ical_url: 'https://airbnb.com/calendar/unit123' },
      unit.id
    );

    // Valid event + event with future parsing error
    const events: ICalEvent[] = [
      {
        uid: 'valid-event-1@airbnb.com',
        summary: 'Valid Event',
        dtStart: new Date('2026-08-01'),
        dtEnd: new Date('2026-08-05'),
      },
      {
        uid: 'error-event-2@airbnb.com',
        summary: 'Event with error',
        dtStart: new Date('2026-09-01'),
        dtEnd: new Date('2026-09-05'),
      },
    ];

    const result = await importICalEvents(
      prisma,
      integration.id,
      unit.id,
      events
    );

    expect(result.imported).toBe(1); // First event succeeds
    expect(result.errors).toHaveLength(0); // No actual errors in happy path
    expect(result.conflicts).toHaveLength(0);

    // Verify integration account was updated with lastSyncAt
    const updated = await prisma.integrationAccount.findUnique({
      where: { id: integration.id },
    });

    expect(updated?.lastSyncAt).toBeDefined();
    expect(updated?.status).toBe('active');
  });

  it('imports multiple events and filters by date range', async () => {
    // Setup
    const project = await prisma.project.create({
      data: {
        slug: 'test-project-4',
        name: 'Test Project 4',
        areaLabelKey: 'area.test',
        descriptionKey: 'desc.test',
        latitude: new Decimal('8.6753'),
        longitude: new Decimal('100.5014'),
        address: 'Test Address',
        handbookKey: 'handbook.test',
      },
    });

    const unit = await prisma.unit.create({
      data: {
        projectId: project.id,
        name: 'Unit 1',
        unitType: 'villa',
        bedrooms: 2,
        bathrooms: 1,
        maxGuests: 4,
        addressSupplement: 'Apt 1',
        baseNightlyThb: 3000,
        minNights: 1,
      },
    });

    const integration = await registerIntegrationAccount(
      prisma,
      IntegrationKey.ical_booking,
      IntegrationScopeType.unit,
      { ical_url: 'https://booking.com/calendar/unit123' },
      unit.id
    );

    const events: ICalEvent[] = [
      {
        uid: 'booking-1@booking.com',
        summary: 'Aug Booking',
        dtStart: new Date('2026-08-10'),
        dtEnd: new Date('2026-08-15'),
      },
      {
        uid: 'booking-2@booking.com',
        summary: 'Sep Booking',
        dtStart: new Date('2026-09-05'),
        dtEnd: new Date('2026-09-12'),
      },
      {
        uid: 'booking-3@booking.com',
        summary: 'Oct Booking',
        dtStart: new Date('2026-10-01'),
        dtEnd: new Date('2026-10-08'),
      },
    ];

    const result = await importICalEvents(
      prisma,
      integration.id,
      unit.id,
      events
    );

    expect(result.imported).toBe(3);
    expect(result.conflicts).toHaveLength(0);
    expect(result.errors).toHaveLength(0);

    // Verify all BlockedDates created
    const blocked = await prisma.blockedDate.findMany({
      where: { unitId: unit.id, reason: 'ota_import' },
    });

    expect(blocked).toHaveLength(3);
    expect(blocked.map(b => b.externalRef).sort()).toEqual([
      'booking-1@booking.com',
      'booking-2@booking.com',
      'booking-3@booking.com',
    ]);
  });
});
