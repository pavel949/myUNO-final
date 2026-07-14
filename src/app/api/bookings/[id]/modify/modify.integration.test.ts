import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/prisma';
import { POST } from './route';
import { NextRequest } from 'next/server';

let mockUser: any;

describe('POST /api/bookings/[id]/modify', () => {
  let guestIdentity: any;
  let unitOwner: any;
  let unit: any;
  let project: any;

  beforeAll(async () => {
    // Create test project
    project = await prisma.project.create({
      data: {
        name: 'Test Project',
        slug: 'test-project-modify',
        status: 'active',
      },
    });

    // Create owner identity
    unitOwner = await prisma.identity.create({
      data: {
        type: 'guest',
        email: `owner-modify-${Date.now()}@test.com`,
      },
    });

    // Create guest identity
    guestIdentity = await prisma.identity.create({
      data: {
        type: 'guest',
        email: `guest-modify-${Date.now()}@test.com`,
      },
    });

    // Create unit with price
    unit = await prisma.unit.create({
      data: {
        name: 'Test Unit Modify',
        projectId: project.id,
        ownerIdentityId: unitOwner.id,
        unitType: 'villa',
        bedrooms: 1,
        bathrooms: 1,
        maxGuests: 4,
        addressSupplement: 'Test Address',
        baseNightlyThb: 1000,
        minNights: 1,
      },
    });
  });

  afterAll(async () => {
    await prisma.unit.deleteMany({ where: { id: unit.id } });
    await prisma.project.deleteMany({ where: { id: project.id } });
    await prisma.identity.deleteMany({ where: { id: { in: [guestIdentity.id, unitOwner.id] } } });
  });

  it('guest can extend booking with balance due', async () => {
    mockUser = { identityId: guestIdentity.id };

    const booking = await prisma.booking.create({
      data: {
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guestIdentity.id,
        bookingType: 'guest_stay',
        channel: 'direct',
        status: 'confirmed',
        startDate: new Date('2026-08-15T15:00:00Z'),
        endDate: new Date('2026-08-17T15:00:00Z'), // 2 nights
        adults: 2,
        children: 0,
        totalThb: 2000, // 2 nights × 1000
      },
    });

    const originalGetCurrentUser = require('@/app/actions/getCurrentUser').getCurrentUser;
    (require('@/app/actions/getCurrentUser') as any).getCurrentUser = async () => mockUser;

    const req = new NextRequest(new URL('http://localhost:3000/api/bookings/test/modify'), {
      method: 'POST',
      body: JSON.stringify({
        endDate: '2026-08-18T15:00:00Z', // extend by 1 night
      }),
    });

    const response = await POST(req, { params: { id: booking.id } });
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.booking.totalThb).toBe(3000); // 3 nights × 1000
    expect(result.pricing.balanceThb).toBe(1000); // owed for additional night

    await prisma.booking.deleteMany({ where: { id: booking.id } });
    (require('@/app/actions/getCurrentUser') as any).getCurrentUser = originalGetCurrentUser;
  });

  it('guest can shorten booking with refund accrued', async () => {
    mockUser = { identityId: guestIdentity.id };

    const booking = await prisma.booking.create({
      data: {
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guestIdentity.id,
        bookingType: 'guest_stay',
        channel: 'direct',
        status: 'confirmed',
        startDate: new Date('2026-08-20T15:00:00Z'),
        endDate: new Date('2026-08-23T15:00:00Z'), // 3 nights
        adults: 2,
        children: 0,
        totalThb: 3000, // 3 nights × 1000
      },
    });

    const originalGetCurrentUser = require('@/app/actions/getCurrentUser').getCurrentUser;
    (require('@/app/actions/getCurrentUser') as any).getCurrentUser = async () => mockUser;

    const req = new NextRequest(new URL('http://localhost:3000/api/bookings/test/modify'), {
      method: 'POST',
      body: JSON.stringify({
        endDate: '2026-08-22T15:00:00Z', // shorten by 1 night
      }),
    });

    const response = await POST(req, { params: { id: booking.id } });
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.booking.totalThb).toBe(2000); // 2 nights × 1000
    expect(result.pricing.balanceThb).toBe(-1000); // refund due
    expect(result.booking.refundAccruedThb).toBe(1000); // accrued refund

    await prisma.booking.deleteMany({ where: { id: booking.id } });
    (require('@/app/actions/getCurrentUser') as any).getCurrentUser = originalGetCurrentUser;
  });

  it('guest can change party size', async () => {
    mockUser = { identityId: guestIdentity.id };

    const booking = await prisma.booking.create({
      data: {
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guestIdentity.id,
        bookingType: 'guest_stay',
        channel: 'direct',
        status: 'confirmed',
        startDate: new Date('2026-08-25T15:00:00Z'),
        endDate: new Date('2026-08-27T15:00:00Z'),
        adults: 2,
        children: 0,
        totalThb: 2000,
      },
    });

    const originalGetCurrentUser = require('@/app/actions/getCurrentUser').getCurrentUser;
    (require('@/app/actions/getCurrentUser') as any).getCurrentUser = async () => mockUser;

    const req = new NextRequest(new URL('http://localhost:3000/api/bookings/test/modify'), {
      method: 'POST',
      body: JSON.stringify({
        adultsCount: 3,
        childrenCount: 1,
      }),
    });

    const response = await POST(req, { params: { id: booking.id } });
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.booking.adults).toBe(3);
    expect(result.booking.children).toBe(1);

    await prisma.booking.deleteMany({ where: { id: booking.id } });
    (require('@/app/actions/getCurrentUser') as any).getCurrentUser = originalGetCurrentUser;
  });

  it('detects availability conflict when modifying dates', async () => {
    mockUser = { identityId: guestIdentity.id };

    // Create two bookings
    const booking1 = await prisma.booking.create({
      data: {
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guestIdentity.id,
        bookingType: 'guest_stay',
        channel: 'direct',
        status: 'confirmed',
        startDate: new Date('2026-09-01T15:00:00Z'),
        endDate: new Date('2026-09-03T15:00:00Z'),
        adults: 2,
        children: 0,
        totalThb: 2000,
      },
    });

    // Create another user's booking
    const otherGuest = await prisma.identity.create({
      data: {
        type: 'guest',
        email: `other-${Date.now()}@test.com`,
      },
    });

    const booking2 = await prisma.booking.create({
      data: {
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: otherGuest.id,
        bookingType: 'guest_stay',
        channel: 'direct',
        status: 'confirmed',
        startDate: new Date('2026-09-05T15:00:00Z'),
        endDate: new Date('2026-09-07T15:00:00Z'),
        adults: 2,
        children: 0,
        totalThb: 2000,
      },
    });

    const originalGetCurrentUser = require('@/app/actions/getCurrentUser').getCurrentUser;
    (require('@/app/actions/getCurrentUser') as any).getCurrentUser = async () => mockUser;

    // Try to extend booking1 into booking2's dates
    const req = new NextRequest(new URL('http://localhost:3000/api/bookings/test/modify'), {
      method: 'POST',
      body: JSON.stringify({
        endDate: '2026-09-06T15:00:00Z', // conflicts with booking2
      }),
    });

    const response = await POST(req, { params: { id: booking1.id } });
    const result = await response.json();

    expect(response.status).toBe(400);
    expect(result.error).toContain('unavailable');

    await prisma.booking.deleteMany({ where: { id: { in: [booking1.id, booking2.id] } } });
    await prisma.identity.deleteMany({ where: { id: otherGuest.id } });
    (require('@/app/actions/getCurrentUser') as any).getCurrentUser = originalGetCurrentUser;
  });

  it('unauthorized user cannot modify booking', async () => {
    mockUser = { identityId: 'unauthorized-id' };

    const booking = await prisma.booking.create({
      data: {
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guestIdentity.id,
        bookingType: 'guest_stay',
        channel: 'direct',
        status: 'confirmed',
        startDate: new Date('2026-09-10T15:00:00Z'),
        endDate: new Date('2026-09-12T15:00:00Z'),
        adults: 2,
        children: 0,
        totalThb: 2000,
      },
    });

    const originalGetCurrentUser = require('@/app/actions/getCurrentUser').getCurrentUser;
    (require('@/app/actions/getCurrentUser') as any).getCurrentUser = async () => mockUser;

    const req = new NextRequest(new URL('http://localhost:3000/api/bookings/test/modify'), {
      method: 'POST',
      body: JSON.stringify({
        endDate: '2026-09-13T15:00:00Z',
      }),
    });

    const response = await POST(req, { params: { id: booking.id } });
    const result = await response.json();

    expect(response.status).toBe(403);
    expect(result.error).toContain('Not authorized');

    await prisma.booking.deleteMany({ where: { id: booking.id } });
    (require('@/app/actions/getCurrentUser') as any).getCurrentUser = originalGetCurrentUser;
  });

  it('cannot modify non-confirmed booking', async () => {
    mockUser = { identityId: guestIdentity.id };

    const booking = await prisma.booking.create({
      data: {
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guestIdentity.id,
        bookingType: 'guest_stay',
        channel: 'direct',
        status: 'pending_payment', // not confirmed
        startDate: new Date('2026-09-15T15:00:00Z'),
        endDate: new Date('2026-09-17T15:00:00Z'),
        adults: 2,
        children: 0,
        totalThb: 2000,
      },
    });

    const originalGetCurrentUser = require('@/app/actions/getCurrentUser').getCurrentUser;
    (require('@/app/actions/getCurrentUser') as any).getCurrentUser = async () => mockUser;

    const req = new NextRequest(new URL('http://localhost:3000/api/bookings/test/modify'), {
      method: 'POST',
      body: JSON.stringify({
        endDate: '2026-09-18T15:00:00Z',
      }),
    });

    const response = await POST(req, { params: { id: booking.id } });
    const result = await response.json();

    expect(response.status).toBe(400);
    expect(result.error).toContain('Cannot modify booking');

    await prisma.booking.deleteMany({ where: { id: booking.id } });
    (require('@/app/actions/getCurrentUser') as any).getCurrentUser = originalGetCurrentUser;
  });
});
