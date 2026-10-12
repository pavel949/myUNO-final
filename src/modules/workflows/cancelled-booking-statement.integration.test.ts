/* eslint-disable no-restricted-imports */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  createBooking,
  createIdentity,
  createProject,
  createUnit,
  db,
  resetDb,
  setGlobalConfig,
} from '@/test/util';

const mockGetCurrentUser = vi.fn();
vi.mock('@/app/actions/getCurrentUser', () => ({ getCurrentUser: () => mockGetCurrentUser() }));
vi.mock('@/lib/prisma', async () => {
  const util = await import('@/test/util');
  return { prisma: util.db };
});

import { POST as generateRoute } from '@/app/api/admin/statements/generate/route';

/**
 * A cancelled stay: the money the guest paid and the host kept after the refund
 * (the retained amount) is owner revenue. Gross counts the stay at what was paid;
 * the refund is deducted as before, so the owner is left with paid minus refunded —
 * never a negative figure for a stay that earned something, and never a charge for
 * a stay that earned nothing.
 */

let world: Awaited<ReturnType<typeof build>>;

async function build() {
  await setGlobalConfig('finance.statement.service_fee_pct', 10);
  const project = await createProject({ status: 'live' });
  const [admin, owner, guest] = await Promise.all([
    createIdentity({ isAdmin: true }),
    createIdentity(),
    createIdentity(),
  ]);
  const unit = await createUnit({ projectId: project.id, ownerIdentityId: owner.id });
  await db.unitEngagement.create({
    data: { unitId: unit.id, ownerIdentityId: owner.id, engagementType: 'direct_managed', status: 'active', noiCapAnnualThb: 500_000_000 },
  });
  return { project, admin, owner, guest, unit };
}

async function cancelledStay(opts: { total: number; paid: number; refunded: number; start: string; end: string }) {
  const booking = await createBooking({
    unitId: world.unit.id, projectId: world.project.id, guestIdentityId: world.guest.id,
    startDate: new Date(opts.start), endDate: new Date(opts.end), totalThb: opts.total, status: 'cancelled',
  });
  if (opts.paid > 0) {
    await db.payment.create({
      data: {
        purpose: 'stay', bookingId: booking.id, payerIdentityId: world.guest.id, method: 'cash', provider: 'cash',
        amountThb: opts.paid, status: 'succeeded', succeededAt: new Date('2026-07-01'),
      },
    });
  }
  if (opts.refunded > 0) {
    await db.ledgerEntry.create({
      data: {
        entryType: 'refund_out', amountThb: -opts.refunded, unitId: world.unit.id, projectId: world.project.id,
        bookingId: booking.id, occurredOn: new Date('2026-07-12'), description: 'Cancellation refund',
      },
    });
  }
  return booking;
}

async function generate() {
  mockGetCurrentUser.mockResolvedValue({
    identityId: world.admin.id, email: world.admin.email, firstName: world.admin.firstName,
    lastName: world.admin.lastName, isAdmin: true, roles: [],
  });
  const res = await generateRoute(
    new NextRequest('http://localhost/api/admin/statements/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unitId: world.unit.id, periodStart: '2026-07-01', periodEnd: '2026-07-31' }),
    })
  );
  return { res, body: await res.json() };
}

beforeEach(async () => {
  await resetDb();
  mockGetCurrentUser.mockReset();
  world = await build();
});

describe('owner statement — cancelled stays', () => {
  it('keeps the retained amount as owner revenue: paid 1,000,000, refunded 700,000 → owner nets 270,000 after the fee on what was kept', async () => {
    await cancelledStay({ total: 1_000_000, paid: 1_000_000, refunded: 700_000, start: '2026-07-10', end: '2026-07-15' });
    const { res, body } = await generate();
    expect(res.status).toBe(200);
    const row = await db.ownerStatement.findUniqueOrThrow({ where: { id: body.statement.id } });
    expect(row.grossBookingsAmountTh).toBe(1_000_000);
    expect(row.totalCostsTh).toBe(700_000 + 30_000); // refund + 10% fee on the 300,000 kept
    expect(row.noiTh).toBe(270_000);
    expect(row.ownerShareTh).toBe(270_000);
    expect(row.noiTh).toBeGreaterThanOrEqual(0);
  });

  it('a fully refunded cancellation nets to zero — no negative result, no fee', async () => {
    await cancelledStay({ total: 500_000, paid: 500_000, refunded: 500_000, start: '2026-07-10', end: '2026-07-12' });
    const { body } = await generate();
    const row = await db.ownerStatement.findUniqueOrThrow({ where: { id: body.statement.id } });
    expect(row.grossBookingsAmountTh).toBe(500_000);
    expect(row.noiTh).toBe(0);
    expect(row.ownerShareTh).toBe(0);
    expect(row.totalCostsTh).toBe(500_000);
  });

  it('a cancelled stay nobody paid for contributes nothing', async () => {
    await cancelledStay({ total: 800_000, paid: 0, refunded: 0, start: '2026-07-10', end: '2026-07-12' });
    const { body } = await generate();
    const row = await db.ownerStatement.findUniqueOrThrow({ where: { id: body.statement.id } });
    expect(row.grossBookingsAmountTh).toBe(0);
    expect(row.noiTh).toBe(0);
  });

  it('a live stay is unchanged: gross is the booking total', async () => {
    await createBooking({
      unitId: world.unit.id, projectId: world.project.id, guestIdentityId: world.guest.id,
      startDate: new Date('2026-07-05'), endDate: new Date('2026-07-08'), totalThb: 900_000,
    });
    const { body } = await generate();
    const row = await db.ownerStatement.findUniqueOrThrow({ where: { id: body.statement.id } });
    expect(row.grossBookingsAmountTh).toBe(900_000);
    expect(row.noiTh).toBe(900_000 - 90_000);
  });

  it('lists the cancelled stay as its own line, marked as such, traceable to the booking', async () => {
    const stay = await cancelledStay({ total: 1_000_000, paid: 1_000_000, refunded: 700_000, start: '2026-07-10', end: '2026-07-15' });
    const { body } = await generate();
    const items = await db.statementLineItem.findMany({ where: { statementId: body.statement.id } });
    const line = items.find((l) => l.bookingId === stay.id && l.category === 'booking_revenue');
    expect(line).toMatchObject({ amountTh: 1_000_000 });
    expect(line?.description).toContain('cancelled');
  });
});
