import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/prisma';
import { POST } from './route';
import { NextRequest } from 'next/server';
import { DEFAULT_POLICIES } from '@/modules/booking';

// Mock getCurrentUser
let mockUser: any;
let globalThis_: any;

describe('POST /api/bookings/[id]/cancel', () => {
  let bookingId: string;
  let guestIdentity: any;
  let unitOwner: any;
  let unit: any;
  let project: any;

  beforeAll(async () => {
    // Create test project
    project = await prisma.project.create({
      data: {
        name: 'Test Project',
        slug: 'test-project',
        status: 'active',
      },
    });

    // Create owner identity
    unitOwner = await prisma.identity.create({
      data: {
        type: 'guest',
        email: `owner-${Date.now()}@test.com`,
      },
    });

    // Create guest identity
    guestIdentity = await prisma.identity.create({
      data: {
        type: 'guest',
        email: `guest-${Date.now()}@test.com`,
      },
    });

    // Create unit
    unit = await prisma.unit.create({
      data: {
        name: 'Test Unit',
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
    // Cleanup
    if (bookingId) {
      await prisma.booking.deleteMany({ where: { id: bookingId } });
    }
    await prisma.unit.deleteMany({ where: { id: unit.id } });
    await prisma.project.deleteMany({ where: { id: project.id } });
    await prisma.identity.deleteMany({ where: { id: { in: [guestIdentity.id, unitOwner.id] } } });
  });

  it('guest can cancel their confirmed booking with flexible policy', async () => {
    mockUser = { identityId: guestIdentity.id };

    const checkInDate = new Date('2026-08-15T15:00:00Z');
    const cancellationTime = new Date('2026-08-13T10:00:00Z'); // 2+ days before
    const booking = await prisma.booking.create({
      data: {
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guestIdentity.id,
        bookingType: 'guest_stay',
        channel: 'direct',
        status: 'confirmed',
        startDate: checkInDate,
        endDate: new Date('2026-08-17T15:00:00Z'),
        adults: 2,
        children: 0,
        totalThb: 8000,
        cancellationPolicySnapshot: {
          name: 'flexible',
          steps: DEFAULT_POLICIES.flexible.steps,
        },
      },
      include: { unit: true },
    });
    bookingId = booking.id;

    // Mock getCurrentUser to return guest
    const originalGetCurrentUser = require('@/app/actions/getCurrentUser').getCurrentUser;
    (require('@/app/actions/getCurrentUser') as any).getCurrentUser = async () => mockUser;

    const req = new NextRequest(new URL('http://localhost:3000/api/bookings/test/cancel'), {
      method: 'POST',
      body: JSON.stringify({ reason: 'guest_requested' }),
    });

    const response = await POST(req, { params: { id: bookingId } });
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.booking.status).toBe('cancelled');
    expect(result.refund.amountThb).toBe(8000); // 100% refund 2+ days before

    // Restore
    (require('@/app/actions/getCurrentUser') as any).getCurrentUser = originalGetCurrentUser;
  });

  it('host can cancel guest booking', async () => {
    mockUser = { identityId: unitOwner.id };

    const checkInDate = new Date('2026-08-20T15:00:00Z');
    const booking = await prisma.booking.create({
      data: {
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guestIdentity.id,
        bookingType: 'guest_stay',
        channel: 'direct',
        status: 'confirmed',
        startDate: checkInDate,
        endDate: new Date('2026-08-22T15:00:00Z'),
        adults: 2,
        children: 0,
        totalThb: 5000,
        cancellationPolicySnapshot: {
          name: 'flexible',
          steps: DEFAULT_POLICIES.flexible.steps,
        },
      },
      include: { unit: true },
    });

    const originalGetCurrentUser = require('@/app/actions/getCurrentUser').getCurrentUser;
    (require('@/app/actions/getCurrentUser') as any).getCurrentUser = async () => mockUser;

    const req = new NextRequest(new URL('http://localhost:3000/api/bookings/test/cancel'), {
      method: 'POST',
      body: JSON.stringify({ reason: 'host_requested' }),
    });

    const response = await POST(req, { params: { id: booking.id } });
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.booking.status).toBe('cancelled');

    await prisma.booking.deleteMany({ where: { id: booking.id } });
    (require('@/app/actions/getCurrentUser') as any).getCurrentUser = originalGetCurrentUser;
  });

  it('unauthorized user cannot cancel booking', async () => {
    mockUser = { identityId: 'unauthorized-identity' };

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
        totalThb: 5000,
        cancellationPolicySnapshot: {
          name: 'flexible',
          steps: DEFAULT_POLICIES.flexible.steps,
        },
      },
      include: { unit: true },
    });

    const originalGetCurrentUser = require('@/app/actions/getCurrentUser').getCurrentUser;
    (require('@/app/actions/getCurrentUser') as any).getCurrentUser = async () => mockUser;

    const req = new NextRequest(new URL('http://localhost:3000/api/bookings/test/cancel'), {
      method: 'POST',
    });

    const response = await POST(req, { params: { id: booking.id } });
    const result = await response.json();

    expect(response.status).toBe(403);
    expect(result.error).toContain('Not authorized');

    await prisma.booking.deleteMany({ where: { id: booking.id } });
    (require('@/app/actions/getCurrentUser') as any).getCurrentUser = originalGetCurrentUser;
  });

  it('moderate policy refund calculation', async () => {
    mockUser = { identityId: guestIdentity.id };

    const checkInDate = new Date('2026-08-15T15:00:00Z');
    const booking = await prisma.booking.create({
      data: {
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guestIdentity.id,
        bookingType: 'guest_stay',
        channel: 'direct',
        status: 'confirmed',
        startDate: checkInDate,
        endDate: new Date('2026-08-17T15:00:00Z'),
        adults: 2,
        children: 0,
        totalThb: 10000,
        cancellationPolicySnapshot: {
          name: 'moderate',
          steps: DEFAULT_POLICIES.moderate.steps,
        },
      },
      include: { unit: true },
    });

    const originalGetCurrentUser = require('@/app/actions/getCurrentUser').getCurrentUser;
    (require('@/app/actions/getCurrentUser') as any).getCurrentUser = async () => mockUser;

    // Cancel 3 days before check-in: should get 50% refund
    const req = new NextRequest(new URL('http://localhost:3000/api/bookings/test/cancel'), {
      method: 'POST',
    });

    // Mock current time to 3 days before check-in
    const response = await POST(req, { params: { id: booking.id } });
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.refund.amountThb).toBe(5000); // 50% of 10000

    await prisma.booking.deleteMany({ where: { id: booking.id } });
    (require('@/app/actions/getCurrentUser') as any).getCurrentUser = originalGetCurrentUser;
  });

  it('cannot cancel already-cancelled booking', async () => {
    mockUser = { identityId: guestIdentity.id };

    const booking = await prisma.booking.create({
      data: {
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guestIdentity.id,
        bookingType: 'guest_stay',
        channel: 'direct',
        status: 'cancelled',
        startDate: new Date('2026-08-30T15:00:00Z'),
        endDate: new Date('2026-09-01T15:00:00Z'),
        adults: 2,
        children: 0,
        totalThb: 5000,
        cancellationPolicySnapshot: {
          name: 'flexible',
          steps: DEFAULT_POLICIES.flexible.steps,
        },
        cancelledAt: new Date(),
        cancelledByIdentityId: guestIdentity.id,
        cancellationReason: 'already_cancelled',
      },
      include: { unit: true },
    });

    const originalGetCurrentUser = require('@/app/actions/getCurrentUser').getCurrentUser;
    (require('@/app/actions/getCurrentUser') as any).getCurrentUser = async () => mockUser;

    const req = new NextRequest(new URL('http://localhost:3000/api/bookings/test/cancel'), {
      method: 'POST',
    });

    const response = await POST(req, { params: { id: booking.id } });
    const result = await response.json();

    expect(response.status).toBe(400);
    expect(result.error).toContain('Cannot cancel booking with status');

    await prisma.booking.deleteMany({ where: { id: booking.id } });
    (require('@/app/actions/getCurrentUser') as any).getCurrentUser = originalGetCurrentUser;
  });
});
