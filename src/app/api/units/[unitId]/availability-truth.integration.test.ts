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

/**
 * A sold stay is not an available stay.
 *
 * `resolveEffectiveStayOffer` — the quotation path this endpoint keeps by
 * decision (docs/architecture/CANONICAL_RATE_PLAN_MIGRATION.md) — answered
 * availability from `blocked_date` and the unit's own status only. Bookings
 * live in a different table and were never read, so a villa sold solid for
 * the requested nights replied `isAvailable: true` on a public endpoint.
 *
 * These tests pin the answer to the same rows the booking transaction
 * refuses against. They say nothing about which engine prices the stay; that
 * is deliberately out of scope here.
 */
function request(unitId: string, params: Record<string, string>): NextRequest {
  return new NextRequest(`http://localhost/api/units/${unitId}?${new URLSearchParams(params)}`);
}

const STAY = { startDate: '2027-03-01', endDate: '2027-03-08', guests: '2' };

async function liveUnit() {
  const project = await createProject({ status: 'live' });
  const unit = await createUnit({
    projectId: project.id,
    status: 'live',
    baseNightlyThb: 500_000,
    maxGuests: 4,
    minNights: 1,
  });
  return { project, unit };
}

describe('GET /api/units/[unitId] availability', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('reports an open range as available', async () => {
    const { unit } = await liveUnit();
    const data = await (await GET(request(unit.id, STAY), { params: { unitId: unit.id } })).json();
    expect(data.pricing.isAvailable).toBe(true);
  });

  it('reports a confirmed booking as unavailable', async () => {
    const { project, unit } = await liveUnit();
    const guest = await createIdentity();
    await createBooking({
      unitId: unit.id,
      projectId: project.id,
      guestIdentityId: guest.id,
      startDate: new Date(STAY.startDate),
      endDate: new Date(STAY.endDate),
      status: 'confirmed',
    });

    const data = await (await GET(request(unit.id, STAY), { params: { unitId: unit.id } })).json();
    expect(data.pricing.isAvailable).toBe(false);
    expect(data.pricing.availableCapacity).toBe(0);
  });

  it('treats a partial overlap as unavailable', async () => {
    const { project, unit } = await liveUnit();
    const guest = await createIdentity();
    await createBooking({
      unitId: unit.id,
      projectId: project.id,
      guestIdentityId: guest.id,
      startDate: new Date('2027-03-05'),
      endDate: new Date('2027-03-10'),
      status: 'confirmed',
    });

    const data = await (await GET(request(unit.id, STAY), { params: { unitId: unit.id } })).json();
    expect(data.pricing.isAvailable).toBe(false);
  });

  it('ignores a cancelled booking', async () => {
    const { project, unit } = await liveUnit();
    const guest = await createIdentity();
    await createBooking({
      unitId: unit.id,
      projectId: project.id,
      guestIdentityId: guest.id,
      startDate: new Date(STAY.startDate),
      endDate: new Date(STAY.endDate),
      status: 'cancelled',
    });

    const data = await (await GET(request(unit.id, STAY), { params: { unitId: unit.id } })).json();
    expect(data.pricing.isAvailable).toBe(true);
  });

  it('ignores a lapsed payment hold — it must not strand inventory', async () => {
    const { project, unit } = await liveUnit();
    const guest = await createIdentity();
    await createBooking({
      unitId: unit.id,
      projectId: project.id,
      guestIdentityId: guest.id,
      startDate: new Date(STAY.startDate),
      endDate: new Date(STAY.endDate),
      status: 'pending_payment',
      holdExpiresAt: new Date(Date.now() - 60_000),
    });

    const data = await (await GET(request(unit.id, STAY), { params: { unitId: unit.id } })).json();
    expect(data.pricing.isAvailable).toBe(true);
  });

  it('honours a live payment hold', async () => {
    const { project, unit } = await liveUnit();
    const guest = await createIdentity();
    await createBooking({
      unitId: unit.id,
      projectId: project.id,
      guestIdentityId: guest.id,
      startDate: new Date(STAY.startDate),
      endDate: new Date(STAY.endDate),
      status: 'pending_payment',
      holdExpiresAt: new Date(Date.now() + 30 * 60_000),
    });

    const data = await (await GET(request(unit.id, STAY), { params: { unitId: unit.id } })).json();
    expect(data.pricing.isAvailable).toBe(false);
  });
});
