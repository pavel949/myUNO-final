import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { db, resetDb, createIdentity, createProject, createUnit } from '@/test/util';
import { seedConfig } from '@/modules/config';
import { computePriceBreakdown } from '@/modules/core';

const currentUser = vi.hoisted(() => vi.fn());
vi.mock('@/app/actions/getCurrentUser', () => ({ getCurrentUser: currentUser }));
vi.mock('@/lib/prisma', async () => ({ prisma: (await import('@/test/util')).db }));
import { POST } from './route';

describe('direct-unit booking acceptance with PostgreSQL', () => {
  const stay = { startDate: '2027-02-01', endDate: '2027-02-04', adultsCount: 2, childrenCount: 0 };
  const request = (body: unknown) => new NextRequest('http://localhost/api/bookings', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  beforeEach(async () => {
    await resetDb();
    await seedConfig(db);
    const guest = await createIdentity();
    currentUser.mockResolvedValue({ identityId: guest.id, isAdmin: false });
  });

  async function reviewed(instantBook: boolean) {
    const project = await createProject({ status: 'live' });
    const unit = await createUnit({ projectId: project.id, status: 'live', instantBook, baseNightlyThb: 500_000 });
    const breakdown = await computePriceBreakdown(db, unit.id, new Date(stay.startDate), new Date(stay.endDate), 2);
    return { ...stay, unitId: unit.id, instantBook: true, acceptedTotalSatang: breakdown.total_thb, paymentMethod: 'cash',
      idempotencyKey: '00000000-0000-4000-8000-000000000001' };
  }

  it('cannot bypass host approval by posting instantBook=true', async () => {
    const body = await reviewed(false);
    const result = await POST(request(body));
    expect(result.status).toBe(201);
    const booking = await db.booking.findFirstOrThrow({ where: { unitId: body.unitId } });
    expect(booking.status).toBe('requested');
    expect(booking.holdExpiresAt).toBeNull();
    expect(booking.requestExpiresAt).not.toBeNull();
    expect(await db.payment.count({ where: { bookingId: booking.id } })).toBe(0);
  });

  it('requires fresh consent after a tariff increases and writes no booking', async () => {
    const body = await reviewed(true);
    await db.pricingRule.create({ data: {
      unitId: body.unitId, startDate: new Date(stay.startDate), endDate: new Date(stay.endDate), nightlyThb: 900_000,
    } });
    const result = await POST(request(body));
    expect(result.status).toBe(409);
    expect((await result.json()).code).toBe('REQUOTE_REQUIRED');
    expect(await db.booking.count()).toBe(0);
    expect(await db.payment.count()).toBe(0);
  });

  it('accepts a newly reviewed price through the same canonical writer', async () => {
    const body = await reviewed(true);
    const result = await POST(request(body));
    expect(result.status).toBe(201);
    const booking = await db.booking.findFirstOrThrow();
    expect(booking.totalThb).toBe(body.acceptedTotalSatang);
    expect(booking.status).toBe('pending_payment');
    expect(booking.paymentMethod).toBe('cash');
    expect(booking.holdExpiresAt).toBeNull();
  });
});
