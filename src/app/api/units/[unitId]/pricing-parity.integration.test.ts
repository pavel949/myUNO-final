import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { resetDb, createProject, createUnit, createIdentity, createBooking } from '@/test/util';

vi.mock('@/app/actions/getCurrentUser', () => ({
  getCurrentUser: async () => null,
}));

vi.mock('@/lib/prisma', async () => {
  const util = await import('@/test/util');
  return { prisma: util.db };
});

import { GET } from './route';
import { db } from '@/test/util';
import { computePriceBreakdown } from '@/modules/core';

/**
 * One price, one availability answer (audit F-6).
 *
 * This endpoint used to quote through `resolveEffectiveStayOffer`, a second
 * money implementation that skipped seasons, discounts and fees, read a
 * different tax parameter, and reported availability without ever looking at
 * bookings. These tests pin it to the calculator that booking creation uses,
 * so a future "canonical quotation engine" cannot quietly become a rival one.
 */
function request(unitId: string, params?: Record<string, string>): NextRequest {
  const query = params ? `?${new URLSearchParams(params).toString()}` : '';
  return new NextRequest(`http://localhost/api/units/${unitId}${query}`);
}

const STAY = { startDate: '2027-02-01', endDate: '2027-02-08', guests: '2' };

describe('GET /api/units/[unitId] pricing parity', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('quotes the same total the booking calculator would charge', async () => {
    const project = await createProject({ status: 'live' });
    const unit = await createUnit({
      projectId: project.id,
      status: 'live',
      baseNightlyThb: 500_000,
      maxGuests: 4,
      minNights: 1,
    });

    const response = await GET(request(unit.id, STAY), { params: { unitId: unit.id } });
    expect(response.status).toBe(200);
    const data = await response.json();

    const breakdown = await computePriceBreakdown(
      db,
      unit.id,
      new Date(STAY.startDate),
      new Date(STAY.endDate),
      2
    );

    expect(data.pricing).not.toBeNull();
    expect(data.pricing.total).toBe(Math.round(breakdown.total_thb / 100));
    expect(data.pricing.subtotal).toBe(Math.round(breakdown.subtotal_thb / 100));
    expect(data.pricing.nights).toBe(breakdown.lines.length);
  });

  it('reports a fully booked range as unavailable', async () => {
    const project = await createProject({ status: 'live' });
    const unit = await createUnit({
      projectId: project.id,
      status: 'live',
      baseNightlyThb: 500_000,
      maxGuests: 4,
      minNights: 1,
    });
    const guest = await createIdentity();
    await createBooking({
      unitId: unit.id,
      projectId: project.id,
      guestIdentityId: guest.id,
      startDate: new Date(STAY.startDate),
      endDate: new Date(STAY.endDate),
      status: 'confirmed',
    });

    const response = await GET(request(unit.id, STAY), { params: { unitId: unit.id } });
    const data = await response.json();

    // The old engine looked only at blocked dates and answered `true` here.
    expect(data.pricing.isAvailable).toBe(false);
  });

  it('reports an open range as available', async () => {
    const project = await createProject({ status: 'live' });
    const unit = await createUnit({
      projectId: project.id,
      status: 'live',
      baseNightlyThb: 500_000,
      maxGuests: 4,
      minNights: 1,
    });

    const response = await GET(request(unit.id, STAY), { params: { unitId: unit.id } });
    const data = await response.json();
    expect(data.pricing.isAvailable).toBe(true);
  });

  it('carries fees and discounts the old engine dropped', async () => {
    const project = await createProject({ status: 'live' });
    const unit = await createUnit({
      projectId: project.id,
      status: 'live',
      baseNightlyThb: 500_000,
      maxGuests: 4,
      minNights: 1,
    });

    const response = await GET(request(unit.id, STAY), { params: { unitId: unit.id } });
    const data = await response.json();

    // The shape must carry them even when a fresh database configures them to
    // zero — a response with no field for a fee can never show one.
    for (const field of ['cleaningFee', 'serviceFee', 'discounts', 'occupancyTax']) {
      expect(data.pricing).toHaveProperty(field);
      expect(typeof data.pricing[field]).toBe('number');
    }
  });

  it('refuses to quote a stay below the minimum rather than inventing a price', async () => {
    const project = await createProject({ status: 'live' });
    const unit = await createUnit({
      projectId: project.id,
      status: 'live',
      baseNightlyThb: 500_000,
      maxGuests: 4,
      minNights: 14,
    });

    const response = await GET(request(unit.id, STAY), { params: { unitId: unit.id } });
    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data.pricing).toBeNull();
    expect(data.unquotable).toMatch(/below minimum/);
  });

  it('refuses to quote a party the unit cannot sleep', async () => {
    const project = await createProject({ status: 'live' });
    const unit = await createUnit({
      projectId: project.id,
      status: 'live',
      baseNightlyThb: 500_000,
      maxGuests: 2,
      minNights: 1,
    });

    const response = await GET(request(unit.id, { ...STAY, guests: '9' }), {
      params: { unitId: unit.id },
    });
    const data = await response.json();

    expect(data.pricing).toBeNull();
    expect(data.unquotable).toMatch(/exceeds/);
  });
});
