import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { db, resetDb, createIdentity, createProject, createUnit } from '@/test/util';
import { computePriceBreakdown } from '@/modules/core';
import { seedConfig, setConfigOverride } from '@/modules/config';
import { createCategoryStayQuoteToken } from '@/modules/booking/category-quote';

const currentUser = vi.hoisted(() => vi.fn());
vi.mock('@/app/actions/getCurrentUser', () => ({ getCurrentUser: currentUser }));
vi.mock('@/lib/prisma', async () => ({ prisma: (await import('@/test/util')).db }));
import { GET, POST } from './route';

describe('durable booking creation intent', () => {
  const stay = { startDate: '2027-03-01', endDate: '2027-03-04', adultsCount: 2, childrenCount: 0 };
  const post = (body: unknown) => POST(new NextRequest('http://localhost/api/bookings', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }));
  beforeEach(async () => {
    await resetDb();
    await seedConfig(db);
    const guest = await createIdentity();
    currentUser.mockResolvedValue({ identityId: guest.id });
  });
  afterEach(() => vi.unstubAllEnvs());
  async function fixture(instantBook = true) {
    const project = await createProject({ status: 'live' });
    const unit = await createUnit({ projectId: project.id, status: 'live', categoryKey: 'villa', name: 'A', instantBook });
    const sibling = await createUnit({ projectId: project.id, status: 'live', categoryKey: 'villa', name: 'B', instantBook });
    const breakdown = await computePriceBreakdown(db, unit.id, new Date(stay.startDate), new Date(stay.endDate), 2);
    const body = { ...stay, unitId: unit.id, instantBook, paymentMethod: 'cash',
      acceptedTotalSatang: breakdown.total_thb, idempotencyKey: randomUUID() };
    const { token } = createCategoryStayQuoteToken({ ...stay, inventoryCategoryId: unit.inventoryCategoryId!,
      projectId: project.id, quotedUnitId: unit.id, petsCount: 0, acceptedTotalSatang: breakdown.total_thb });
    const category = { ...body, unitId: undefined, inventoryCategoryId: unit.inventoryCategoryId, categoryQuoteToken: token };
    return { project, unit, sibling, body, category };
  }

  it('returns the same request after a lost response instead of notifying twice', async () => {
    const { body } = await fixture(false);
    const first = await post(body);
    expect(first.status).toBe(201);
    const firstBooking = (await first.json()).booking;
    const second = await post(body);
    expect(second.status).toBe(200);
    expect((await second.json()).booking.id).toBe(firstBooking.id);
    expect(await db.booking.count()).toBe(1);
    expect(await db.analyticsEvent.count({ where: { eventKey: 'stay_booking_started' } })).toBe(1);
  });

  it('does not allocate a sibling on retry, including after the quote expires or price changes', async () => {
    const { category, unit, sibling } = await fixture();
    const first = await post(category);
    expect(first.status).toBe(201);
    const booking = (await first.json()).booking;
    await db.pricingRule.create({ data: { unitId: sibling.id, startDate: new Date(stay.startDate), endDate: new Date(stay.endDate), nightlyThb: 99999999 } });
    const replay = await post({ ...category, categoryQuoteToken: 'expired' });
    expect(replay.status).toBe(200);
    expect((await replay.json()).booking).toMatchObject({ id: booking.id, unitId: unit.id, totalThb: booking.totalThb });
    expect(await db.booking.count()).toBe(1);
  });

  it('serializes simultaneous category retries onto one physical reservation', async () => {
    const { category } = await fixture();
    const responses = await Promise.all([post(category), post(category), post(category)]);
    expect(responses.every((response) => response.ok)).toBe(true);
    const ids = await Promise.all(responses.map(async (response) => (await response.json()).booking.id));
    expect(new Set(ids).size).toBe(1);
    expect(await db.booking.count()).toBe(1);
    expect(await db.payment.count()).toBe(0);
  });

  it('rejects reusing the key for a different stay without another write', async () => {
    const { body } = await fixture(false);
    expect((await post(body)).status).toBe(201);
    const changed = await post({ ...body, endDate: '2027-03-05' });
    expect(changed.status).toBe(409);
    expect((await changed.json()).code).toBe('BOOKING_INTENT_CONFLICT');
    expect(await db.booking.count()).toBe(1);
  });

  it('scopes identical client keys to the authenticated guest', async () => {
    const { body } = await fixture(false);
    expect((await post(body)).status).toBe(201);
    const other = await createIdentity();
    currentUser.mockResolvedValue({ identityId: other.id });
    const second = await post(body);
    expect(second.status).toBe(201);
    expect((await second.json()).booking.guestIdentityId).toBe(other.id);
    expect(await db.booking.count()).toBe(2);
  });

  it('opens at most one card checkout for concurrent retries', async () => {
    vi.stubEnv('PAYMENT_PROVIDER', 'mock');
    const { category, project } = await fixture();
    await setConfigOverride(db, 'booking.payment.methods_enabled', ['card_provider'], {
      scopeType: 'project', scopeId: project.id, changedByIdentityId: (await currentUser()).identityId,
    });
    const responses = await Promise.all([
      post({ ...category, paymentMethod: 'card_provider' }),
      post({ ...category, paymentMethod: 'card_provider' }),
    ]);
    expect(responses.every((response) => response.ok)).toBe(true);
    const bodies = await Promise.all(responses.map((response) => response.json()));
    expect(new Set(bodies.map((body) => body.booking.id)).size).toBe(1);
    expect(bodies.filter((body) => body.checkout)).toHaveLength(1);
    expect(await db.payment.count()).toBe(1);
    expect(await db.payment.count({ where: { status: 'succeeded' } })).toBe(0);
    expect(await db.ledgerEntry.count({ where: { entryType: 'rental_revenue' } })).toBe(0);
  });

  it('recovers on refresh only for the original authenticated guest', async () => {
    const { body } = await fixture();
    const booking = (await (await post(body)).json()).booking;
    const request = () => new NextRequest(`http://localhost/api/bookings?idempotencyKey=${body.idempotencyKey}`);
    const recovered = await GET(request());
    expect(recovered.status).toBe(200);
    expect((await recovered.json()).booking.id).toBe(booking.id);
    expect(recovered.headers.get('cache-control')).toBe('private, no-store');
    const other = await createIdentity();
    currentUser.mockResolvedValue({ identityId: other.id });
    expect((await GET(request())).status).toBe(404);
    currentUser.mockResolvedValue(null);
    expect((await GET(request())).status).toBe(401);
  });

  it('recovers the saved stay after an unavailable provider without claiming payment or creating a replacement', async () => {
    vi.stubEnv('PAYMENT_PROVIDER', 'stripe'); // Deliberately unimplemented; no network call.
    const { body, project } = await fixture();
    await setConfigOverride(db, 'booking.payment.methods_enabled', ['card_provider'], {
      scopeType: 'project', scopeId: project.id, changedByIdentityId: (await currentUser()).identityId,
    });
    const payload = { ...body, paymentMethod: 'card_provider' };
    const first = await post(payload);
    expect(first.status).toBe(503);
    const saved = await first.json();
    expect(saved.code).toBe('CHECKOUT_UNAVAILABLE');
    expect(saved.booking.status).toBe('pending_payment');
    const retry = await post(payload);
    expect(retry.status).toBe(200);
    expect((await retry.json()).booking.id).toBe(saved.booking.id);
    expect(await db.booking.count()).toBe(1);
    expect(await db.payment.count()).toBe(0);
    expect(await db.ledgerEntry.count({ where: { entryType: 'rental_revenue' } })).toBe(0);
  });
});
