import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { db, resetDb, createIdentity, createProject, createUnit } from '@/test/util';
import { seedConfig } from '@/modules/config';

const session: { identityId: string } = { identityId: '' };
vi.mock('@/lib/prisma', async () => {
  const util = await import('@/test/util');
  return { prisma: util.db };
});
vi.mock('@/app/actions/getCurrentUser', () => ({
  getCurrentUser: async () => session.identityId ? { identityId: session.identityId } : null,
}));

import { POST as catalogPost } from '@/app/api/admin/projects/[id]/catalog/route';
import { POST as adminUnitPost } from '@/app/api/admin/units/route';
import { POST as propertyDetailsPost } from '@/app/api/admin/units/[id]/property-details/route';
import { getPropertyReadiness } from '@/modules/projects/property-readiness';
import { POST as pricingPost } from '@/app/api/pricing/breakdown/route';
import { POST as bookingPost } from '@/app/api/bookings/route';
import { GET as searchGet } from '@/app/api/search/units/route';

function request(url: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('canonical onboarding → pricing → search → booking route journey', () => {
  let projectId: string;
  let adminId: string;
  let guestId: string;

  beforeEach(async () => {
    await resetDb();
    await seedConfig(db);
    const project = await createProject({ status: 'live' });
    const admin = await createIdentity({ isAdmin: true });
    const guest = await createIdentity();
    projectId = project.id;
    adminId = admin.id;
    guestId = guest.id;
    session.identityId = adminId;
  });

  const categoryRequest = (categoryKey: string, baseNightlyThb: unknown = '3500', minNights: number = 1) => ({
    action: 'category',
    categoryKey,
    name: categoryKey,
    bedrooms: 2,
    bathrooms: 2,
    maxGuests: 4,
    baseNightlyThb,
    minNights,
  });

  async function category(key: string, rate: unknown = '3500', minNights = 1) {
    const res = await catalogPost(
      request(`/api/admin/projects/${projectId}/catalog`, categoryRequest(key, rate, minNights)),
      { params: { id: projectId } }
    );
    expect(res.status).toBe(201);
    return res.json() as Promise<{ id: string; categoryKey: string; baseNightlyThb: number; status: string }>;
  }

  it('rejects a missing or zero rate before writing inventory', async () => {
    const missing = await catalogPost(
      request('/api/admin/projects/x/catalog', categoryRequest('missing_rate', null)),
      { params: { id: projectId } }
    );
    const zero = await catalogPost(
      request('/api/admin/projects/x/catalog', categoryRequest('zero_rate', '0')),
      { params: { id: projectId } }
    );
    expect(missing.status).toBe(400);
    expect(zero.status).toBe(400);
    expect(await db.inventoryCategory.count()).toBe(0);
  });

  it('creates a priced, live category and a draft physical unit through their real APIs', async () => {
    const c = await category('garden_2br', '3500', 2);
    expect(c.baseNightlyThb).toBe(350_000);
    expect(c.status).toBe('live');

    const bar = await db.ratePlan.findFirst({ where: { categoryId: c.id, code: 'BAR' } });
    expect(bar).toBeTruthy();
    expect(bar?.projectId).toBeNull();
    expect(bar?.minNights).toBeNull();

    const unitResponse = await adminUnitPost(request('/api/admin/units', {
      projectId, inventoryCategoryId: c.id, name: 'G-01', unitType: 'villa',
      bedrooms: 2, bathrooms: 2, maxGuests: 4, addressSupplement: 'G-01',
      descriptionKey: 'unit.g01.description', baseNightlyThb: 0, status: 'draft',
    }));
    expect(unitResponse.status).toBe(201);
    const unit = await unitResponse.json();
    expect(unit.inventoryCategoryId).toBe(c.id);
    expect(unit.baseNightlyThb).toBe(350_000);
    expect(unit.minNights).toBe(2);
    expect(unit.status).toBe('draft');
  });

  it('keeps BAR attached to its category; saving a second BAR never moves the first one', async () => {
    const first = await category('garden_2br', '3500');
    const second = await category('pool_3br', '5500');
    const save = (categoryId: string, minNights: number) =>
      catalogPost(request('/api/admin/projects/x/catalog', {
        action: 'rate_plan', categoryId, code: 'BAR',
        name: 'Best Available Rate', isMaster: true, minNights,
      }), { params: { id: projectId } });

    expect((await save(first.id, 2)).status).toBe(201);
    expect((await save(second.id, 4)).status).toBe(201);

    const plans = await db.ratePlan.findMany({ where: { code: 'BAR' } });
    expect(plans).toHaveLength(2);
    expect(plans.find((p) => p.categoryId === first.id)?.minNights).toBe(2);
    expect(plans.find((p) => p.categoryId === second.id)?.minNights).toBe(4);

    const update = await save(first.id, 3);
    expect(update.status).toBe(201);
    expect(await db.ratePlan.count({ where: { code: 'BAR' } })).toBe(2);
    expect((await db.ratePlan.findFirst({ where: { categoryId: second.id, code: 'BAR' } }))?.minNights).toBe(4);
  });

  it('rejects rate-plan edits aimed at another project’s category', async () => {
    const other = await createProject({ status: 'draft' });
    const own = await category('garden_2br');
    const response = await catalogPost(
      request('/api/admin/projects/x/catalog', {
        action: 'rate_plan', categoryId: own.id, code: 'BAR', name: 'Cross-project',
      }),
      { params: { id: other.id } }
    );
    expect(response.status).toBe(400);
    expect((await db.ratePlan.findFirst({ where: { categoryId: own.id } }))?.name).toBe('Best Available Rate');
  });

  it('keeps existing units in sync when the category base rate changes', async () => {
    const c = await category('garden_2br', '3500');
    const u = await createUnit({ projectId, categoryKey: c.categoryKey, status: 'live', baseNightlyThb: 350_000 });
    const changed = await catalogPost(
      request('/api/admin/projects/x/catalog', categoryRequest('garden_2br', '4200', 3)),
      { params: { id: projectId } }
    );
    expect(changed.status).toBe(201);
    expect((await db.inventoryCategory.findUnique({ where: { id: c.id } }))?.baseNightlyThb).toBe(420_000);
    expect((await db.unit.findUnique({ where: { id: u.id } }))?.baseNightlyThb).toBe(420_000);
    expect((await db.unit.findUnique({ where: { id: u.id } }))?.minNights).toBe(3);
  });

  it('quotes, books and removes the same canonical unit from search; a retry cannot double-book', async () => {
    const c = await category('garden_2br', '3500', 1);
    const unit = await createUnit({
      projectId, categoryKey: c.categoryKey, status: 'live', baseNightlyThb: 350_000, instantBook: true,
    });
    const dates = { startDate: '2026-11-10', endDate: '2026-11-14' };
    const search = () => searchGet(new NextRequest(
      `http://localhost/api/search/units?inventoryCategoryId=${c.id}&startDate=${dates.startDate}&endDate=${dates.endDate}&adultsCount=2`
    ));
    const before = await search();
    expect(before.status).toBe(200);
    expect((await before.json()).units.map((u: { id: string }) => u.id)).toContain(unit.id);

    const quoteRes = await pricingPost(request('/api/pricing/breakdown', {
      unitId: unit.id, ...dates, guestCount: 2,
    }));
    expect(quoteRes.status).toBe(200);
    const quote = await quoteRes.json();
    expect(quote.total).toBeGreaterThan(0);

    session.identityId = guestId;
    const payload = {
      inventoryCategoryId: c.id, projectId, ...dates, adultsCount: 2, childrenCount: 0,
      paymentMethod: 'cash', totalThb: 1, // client-supplied total cannot override the server quote
    };
    const created = await bookingPost(request('/api/bookings', payload));
    expect(created.status).toBe(201);
    const body = await created.json();
    expect(body.booking.unitId).toBe(unit.id);
    expect(body.booking.status).toBe('pending_payment');
    expect(Math.abs(body.booking.totalThb / 100 - quote.total)).toBeLessThan(1);
    expect(body.booking.totalThb).not.toBe(1);
    expect(body.booking.priceBreakdown.inventory_category_id).toBe(c.id);

    const after = await search();
    expect((await after.json()).units).toHaveLength(0);
    const retry = await bookingPost(request('/api/bookings', payload));
    expect(retry.status).toBe(409);
    expect(await db.booking.count({ where: { unitId: unit.id } })).toBe(1);
  });

  it('keeps draft categories unavailable and rejects unauthorised catalog writes', async () => {
    const draft = await catalogPost(
      request('/api/admin/projects/x/catalog', { ...categoryRequest('draft_2br'), status: 'draft' }),
      { params: { id: projectId } }
    );
    expect(draft.status).toBe(201);
    const c = await draft.json();
    await createUnit({ projectId, categoryKey: c.categoryKey, status: 'live', baseNightlyThb: 350_000 });

    const search = await searchGet(new NextRequest(
      `http://localhost/api/search/units?inventoryCategoryId=${c.id}&adultsCount=2`
    ));
    expect((await search.json()).units).toHaveLength(0);

    session.identityId = guestId;
    const attempted = await catalogPost(
      request('/api/admin/projects/x/catalog', categoryRequest('intrusion_2br')),
      { params: { id: projectId } }
    );
    expect(attempted.status).toBe(403);
    const booking = await bookingPost(request('/api/bookings', {
      inventoryCategoryId: c.id, projectId, startDate: '2026-11-10', endDate: '2026-11-14',
      adultsCount: 2, childrenCount: 0, paymentMethod: 'cash',
    }));
    expect(booking.status).toBe(404);
  });

  it('activates one reusable short-stay offering and reuses it for multiple channels', async () => {
    const c = await category('garden_2br');
    const unit = await createUnit({
      projectId, categoryKey: c.categoryKey, status: 'live', baseNightlyThb: 350_000,
    });
    await db.project.update({ where: { id: projectId }, data: { projectType: 'resort' } });

    const before = await getPropertyReadiness(db, projectId);
    expect(before?.blockers.some(b => b.key === 'unit.stay_offering' && b.unitId === unit.id)).toBe(true);

    const offer = () => propertyDetailsPost(
      request('/api/admin/units/x/property-details', { action: 'stay_offering', status: 'active' }),
      { params: { id: unit.id } }
    );
    const first = await offer();
    const second = await offer();
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(await db.commercialOffering.count({ where: { unitId: unit.id, offeringType: 'short_stay' } })).toBe(1);

    for (const channel of ['airbnb', 'booking_com']) {
      const result = await propertyDetailsPost(
        request('/api/admin/units/x/property-details', {
          action: 'channel_mapping', channel, syncState: 'ical_only',
        }),
        { params: { id: unit.id } }
      );
      expect(result.status).toBe(201);
    }
    const [offering] = await db.commercialOffering.findMany({
      where: { unitId: unit.id, offeringType: 'short_stay' },
      include: { channelMappings: true },
    });
    expect(offering.channelMappings).toHaveLength(2);

    const after = await getPropertyReadiness(db, projectId);
    expect(after?.blockers.some(b => b.key === 'unit.stay_offering' && b.unitId === unit.id)).toBe(false);
  });
});
