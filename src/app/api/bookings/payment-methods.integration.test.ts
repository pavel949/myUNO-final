import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import type { PaymentMethod } from '@prisma/client';
import { db, resetDb, createIdentity, createOrganization, createProject, createUnit } from '@/test/util';
import { seedConfig, setConfigOverride } from '@/modules/config';
import { computePriceBreakdown } from '@/modules/core';
import { createCategoryStayQuoteToken } from '@/modules/booking/category-quote';
import { bookOwnerStay } from '@/modules/projects/owner.service';

const currentUser = vi.hoisted(() => vi.fn());
vi.mock('@/app/actions/getCurrentUser', () => ({ getCurrentUser: currentUser }));
vi.mock('@/lib/prisma', async () => ({ prisma: (await import('@/test/util')).db }));
import { POST } from './route';
import { POST as manualReservation } from '@/app/api/ops/reservations/route';

describe('public booking payment methods follow the asset project', () => {
  const stay = { startDate: '2027-04-10', endDate: '2027-04-13', adultsCount: 2, childrenCount: 0 };
  let guestId: string;
  const request = (body: unknown) => new NextRequest('http://localhost/api/bookings', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  beforeEach(async () => {
    await resetDb();
    await seedConfig(db);
    guestId = (await createIdentity()).id;
    currentUser.mockResolvedValue({ identityId: guestId, isAdmin: false, roles: [] });
  });
  afterEach(() => vi.unstubAllEnvs());

  async function configure(projectId: string, methods: PaymentMethod[]) {
    await setConfigOverride(db, 'booking.payment.methods_enabled', methods, {
      scopeType: 'project', scopeId: projectId, changedByIdentityId: guestId,
    });
  }
  async function fixture(methods: PaymentMethod[], instantBook = true) {
    const project = await createProject({ status: 'live' });
    const unit = await createUnit({ projectId: project.id, status: 'live', instantBook });
    await configure(project.id, methods);
    const quote = await computePriceBreakdown(db, unit.id, new Date(stay.startDate), new Date(stay.endDate), 2);
    const body = { ...stay, unitId: unit.id, instantBook, acceptedTotalSatang: quote.total_thb,
      paymentMethod: 'cash', idempotencyKey: randomUUID() };
    const { token } = createCategoryStayQuoteToken({ ...stay, inventoryCategoryId: unit.inventoryCategoryId!,
      projectId: project.id, quotedUnitId: unit.id, petsCount: 0, acceptedTotalSatang: quote.total_thb });
    const category = { ...body, unitId: undefined, inventoryCategoryId: unit.inventoryCategoryId,
      categoryQuoteToken: token };
    return { project, unit, body, category };
  }

  it.each([
    ['direct', 'cash'], ['direct', 'bank_transfer'], ['category', 'cash'], ['category', 'bank_transfer'],
  ] as const)('rejects disabled %s-path %s without creating a stay or payment', async (path, paymentMethod) => {
    const data = await fixture(['card_provider']);
    const response = await POST(request({ ...data[path === 'direct' ? 'body' : 'category'], paymentMethod }));
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('PAYMENT_METHOD_UNAVAILABLE');
    expect(await db.booking.count()).toBe(0);
    expect(await db.payment.count()).toBe(0);
  });

  it('does not bypass card-only settings by omitting paymentMethod', async () => {
    const { body } = await fixture(['card_provider']);
    expect((await POST(request({ ...body, paymentMethod: undefined }))).status).toBe(400);
    expect(await db.booking.count()).toBe(0);
  });

  it('also rejects a disabled rail on a request that would later be approved', async () => {
    const { body } = await fixture(['card_provider'], false);
    expect((await POST(request(body))).status).toBe(400);
    expect(await db.booking.count()).toBe(0);
  });

  it.each(['cash', 'bank_transfer'] as const)('preserves configured %s and its untimed reservation', async (paymentMethod) => {
    const { body } = await fixture([paymentMethod]);
    const response = await POST(request({ ...body, paymentMethod }));
    expect(response.status).toBe(201);
    expect((await db.booking.findFirstOrThrow())).toMatchObject({ paymentMethod, status: 'pending_payment', holdExpiresAt: null });
  });

  it('accepts card only when explicitly enabled, using the local mock provider', async () => {
    vi.stubEnv('PAYMENT_PROVIDER', 'mock');
    const { body } = await fixture(['card_provider']);
    const response = await POST(request({ ...body, paymentMethod: 'card_provider' }));
    expect(response.status).toBe(201);
    expect(await db.payment.count()).toBe(1);
    expect(await db.payment.count({ where: { status: 'succeeded' } })).toBe(0);
  });

  it('recovers an already accepted reservation unchanged after its payment rail is disabled', async () => {
    const { project, body } = await fixture(['cash']);
    const first = await POST(request(body));
    expect(first.status).toBe(201);
    const booking = (await first.json()).booking;
    await configure(project.id, ['card_provider']);
    const replay = await POST(request(body));
    expect(replay.status).toBe(200);
    expect((await replay.json()).booking.id).toBe(booking.id);
    expect(await db.booking.count()).toBe(1);
  });

  it('does not apply one project override to a different project', async () => {
    const restricted = await fixture(['card_provider']);
    const allowed = await fixture(['cash']);
    expect((await POST(request(restricted.body))).status).toBe(400);
    expect((await POST(request(allowed.body))).status).toBe(201);
    expect((await db.booking.findFirstOrThrow()).projectId).toBe(allowed.project.id);
  });

  it.each([false, true])('preserves the authorized manual route when unit.instantBook=%s', async (instantBook) => {
    const { project, unit } = await fixture(['card_provider'], instantBook);
    const organization = await createOrganization('Synthetic operating company', project.id);
    const space = await db.operatingSpace.create({ data: { key: 'payment-scope', name: 'Payment scope', organizationId: organization.id } });
    await db.operatingSpaceUnit.create({ data: { operatingSpaceId: space.id, unitId: unit.id } });
    const admin = await createIdentity({ isAdmin: true });
    currentUser.mockResolvedValue({ identityId: admin.id, isAdmin: true, roles: [] });
    const response = await manualReservation(request({ operatingSpaceId: space.id, unitId: unit.id,
      guestIdentityId: guestId, startDate: stay.startDate, endDate: stay.endDate, adults: 2 }));
    expect(response.status).toBe(201);
    expect((await db.booking.findFirstOrThrow())).toMatchObject({ channel: 'manual', paymentMethod: null,
      status: instantBook ? 'pending_payment' : 'requested' });
  });

  it('preserves a zero-rent owner stay on a request-only, card-only property', async () => {
    const { unit } = await fixture(['card_provider'], false);
    await db.unit.update({ where: { id: unit.id }, data: { ownerIdentityId: guestId } });
    const booking = await bookOwnerStay(db, { unitId: unit.id, ownerIdentityId: guestId,
      startDate: new Date(stay.startDate), endDate: new Date(stay.endDate) });
    expect(booking).toMatchObject({ bookingType: 'owner_stay', status: 'confirmed', totalThb: 0 });
    expect(await db.payment.count()).toBe(0);
  });
});
