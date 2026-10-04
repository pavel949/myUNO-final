import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { db, resetDb, createProject, createUnit, createIdentity, createBooking } from '@/test/util';
import { vi } from 'vitest';

vi.mock('@/lib/prisma', async () => {
  const util = await import('@/test/util');
  return { prisma: util.db };
});

import { GET } from './route';

function makeRequest(query: Record<string, string>): NextRequest {
  const params = new URLSearchParams(query);
  return new NextRequest(`http://localhost/api/search/units?${params}`);
}

describe('GET /api/search/units — category grouping & filters (LY-6)', () => {
  let projectId: string;

  beforeEach(async () => {
    await resetDb();
    const project = await createProject({ status: 'live' });
    projectId = project.id;
  });

  it('groupBy=category returns per-category availability with from-prices', async () => {
    await createUnit({
      projectId, name: 'A-01', categoryKey: 'superior_2br', status: 'live',
      baseNightlyThb: 626100, bedrooms: 2, maxGuests: 4,
    });
    await createUnit({
      projectId, name: 'A-02', categoryKey: 'superior_2br', status: 'live',
      baseNightlyThb: 626100, bedrooms: 2, maxGuests: 4,
    });
    await createUnit({
      projectId, name: 'G-01', categoryKey: 'grand_deluxe_3br', status: 'live',
      baseNightlyThb: 939300, bedrooms: 3, maxGuests: 6,
    });
    // A draft uncategorized unit is not sellable and never appears in the rollup.
    await createUnit({ projectId, name: 'X-01', status: 'draft', baseNightlyThb: 100 });

    const res = await GET(
      makeRequest({
        projectId,
        startDate: '2026-08-10',
        endDate: '2026-08-14',
        adultsCount: '2',
        groupBy: 'category',
      })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.categories).toHaveLength(2);
    const byKey = Object.fromEntries(
      body.categories.map((c: { category_key: string }) => [c.category_key, c])
    );
    expect(byKey.superior_2br.available_count).toBe(2);
    expect(byKey.superior_2br.from_nightly_thb).toBe(626100);
    expect(byKey.grand_deluxe_3br.available_count).toBe(1);
    // No translation seeded → label falls back to the key
    expect(byKey.superior_2br.label).toBe('superior_2br');
  });

  it('a confirmed booking removes the villa from its category count', async () => {
    const guest = await createIdentity();
    const unit = await createUnit({
      projectId, name: 'A-01', categoryKey: 'superior_2br', status: 'live', maxGuests: 4,
    });
    await createUnit({
      projectId, name: 'A-02', categoryKey: 'superior_2br', status: 'live', maxGuests: 4,
    });
    await createBooking({
      unitId: unit.id,
      projectId,
      guestIdentityId: guest.id,
      status: 'confirmed',
      startDate: new Date('2026-08-11'),
      endDate: new Date('2026-08-13'),
    });

    const res = await GET(
      makeRequest({
        projectId,
        startDate: '2026-08-10',
        endDate: '2026-08-14',
        adultsCount: '2',
        groupBy: 'category',
      })
    );
    const body = await res.json();

    expect(body.categories).toHaveLength(1);
    expect(body.categories[0].available_count).toBe(1);
  });

  it('filters the flat list by bedrooms and categoryKey', async () => {
    await createUnit({
      projectId, name: 'A-01', categoryKey: 'superior_2br', bedrooms: 2, status: 'live', maxGuests: 4,
    });
    await createUnit({
      projectId, name: 'G-01', categoryKey: 'grand_deluxe_3br', bedrooms: 3, status: 'live', maxGuests: 6,
    });

    const byBedrooms = await (
      await GET(makeRequest({ projectId, adultsCount: '2', bedrooms: '3' }))
    ).json();
    expect(byBedrooms.units).toHaveLength(1);
    expect(byBedrooms.units[0].name).toBe('G-01');

    const byCategory = await (
      await GET(makeRequest({ projectId, adultsCount: '2', categoryKey: 'superior_2br' }))
    ).json();
    expect(byCategory.units).toHaveLength(1);
    expect(byCategory.units[0].name).toBe('A-01');
  });
});

/**
 * A unit is public only when its project is public too.
 *
 * `getPublicUnitById` has always required both, but search required only the
 * unit — so archiving a project left its villas listed and bookable while their
 * own pages returned 404. Two reads of one fact disagreeing, with the
 * guest-facing one still selling.
 */
describe('GET /api/search/units — public media eligibility', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('excludes a live unit that has no truthful public gallery', async () => {
    const project = await createProject({ status: 'live' });
    const hidden = await createUnit({
      projectId: project.id,
      name: 'Media-incomplete',
      status: 'live',
      maxGuests: 4,
      publicMediaReady: false,
    });
    const visible = await createUnit({
      projectId: project.id,
      name: 'Media-ready',
      status: 'live',
      maxGuests: 4,
    });

    const response = await GET(
      makeRequest({ projectId: project.id, adultsCount: '2' })
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.units.map((unit: { id: string }) => unit.id)).toEqual([visible.id]);
    expect(body.units.map((unit: { id: string }) => unit.id)).not.toContain(hidden.id);
    expect(body.total).toBe(1);
  });
});

describe('GET /api/search/units — a unit is only as public as its project', () => {
  async function projectWithLiveUnit(status: 'live' | 'draft' | 'archived', slug: string) {
    const project = await createProject({ slug, status });
    await createUnit({
      projectId: project.id,
      name: `${slug}-01`,
      status: 'live',
      maxGuests: 4,
      baseNightlyThb: 500_000,
    });
    return project;
  }

  beforeEach(async () => {
    await resetDb();
  });

  it('hides live units of an archived project', async () => {
    const archived = await projectWithLiveUnit('archived', 'p-archived');

    const scoped = await (
      await GET(makeRequest({ projectId: archived.id, adultsCount: '2' }))
    ).json();
    expect(scoped.units).toHaveLength(0);

    const unscoped = await (await GET(makeRequest({ adultsCount: '2' }))).json();
    expect(unscoped.units).toHaveLength(0);
  });

  it('hides live units of a project still in draft', async () => {
    const draft = await projectWithLiveUnit('draft', 'p-draft');

    const body = await (
      await GET(makeRequest({ projectId: draft.id, adultsCount: '2' }))
    ).json();
    expect(body.units).toHaveLength(0);
  });

  it('drops a project from results the moment it is archived', async () => {
    const project = await projectWithLiveUnit('live', 'p-live');

    const before = await (await GET(makeRequest({ adultsCount: '2' }))).json();
    expect(before.units).toHaveLength(1);

    await db.project.update({ where: { id: project.id }, data: { status: 'archived' } });

    const after = await (await GET(makeRequest({ adultsCount: '2' }))).json();
    expect(after.units).toHaveLength(0);
  });

  it('still applies the map viewport alongside the project-status rule', async () => {
    // Both filters live on the same `project` clause; written as two keys in
    // one object literal, whichever came first would be silently dropped.
    await projectWithLiveUnit('live', 'p-in-view');

    const inView = await (
      await GET(
        makeRequest({
          adultsCount: '2',
          swLat: '13.0', swLng: '100.0', neLat: '14.0', neLng: '101.0',
        })
      )
    ).json();
    expect(inView.units).toHaveLength(1);
    expect(inView.mapProjects).toHaveLength(1);
    expect(inView.mapProjects[0]).toMatchObject({ id: expect.any(String), unitCount: 1 });

    const outOfView = await (
      await GET(
        makeRequest({
          adultsCount: '2',
          swLat: '7.0', swLng: '98.0', neLat: '8.0', neLng: '99.0',
        })
      )
    ).json();
    expect(outOfView.units).toHaveLength(0);
    expect(outOfView.mapProjects).toEqual([]);
  });
});


describe('source-controlled inventory is excluded before public search and category aggregation', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('omits a source-controlled villa from undated/dated results and capacity until cutover', async () => {
    const project = await createProject({ status: 'live' });
    const sourceUnit = await createUnit({
      projectId: project.id, name: 'Real-source-01', status: 'live',
      categoryKey: 'source_2br', baseNightlyThb: 500000,
    });
    const sellableUnit = await createUnit({
      projectId: project.id, name: 'Local-02', status: 'live',
      categoryKey: 'source_2br', baseNightlyThb: 500000,
    });
    const source = await db.externalSystem.create({
      data: {
        system_key: 'layantara_os', environment: 'test',
        display_name: 'Layantara source',
        config: { bookingAuthority: 'layantara_os', cutoverVerified: false },
      },
    });
    await db.externalMapping.create({
      data: {
        external_system_id: source.id,
        entity_type: 'unit',
        internal_id: sourceUnit.id,
        external_id: 'villa-real-source-01',
      },
    });

    const undated = await GET(makeRequest({ projectId: project.id, adultsCount: '2' }));
    expect(undated.status).toBe(200);
    const undatedData = await undated.json();
    expect(undatedData.total).toBe(1);
    expect(undatedData.units.map((unit: { id: string }) => unit.id)).toEqual([sellableUnit.id]);

    const grouped = await GET(makeRequest({
      projectId: project.id, adultsCount: '2', groupBy: 'category',
      startDate: '2026-12-15', endDate: '2026-12-18',
    }));
    expect(grouped.status).toBe(200);
    const groupData = await grouped.json();
    expect(groupData.categories).toHaveLength(1);
    expect(groupData.categories[0].available_count).toBe(1);

    await db.externalSystem.update({
      where: { id: source.id },
      data: { config: { bookingAuthority: 'myuno', cutoverVerified: true } },
    });
    const after = await GET(makeRequest({ projectId: project.id, adultsCount: '2' }));
    expect(after.status).toBe(200);
    expect((await after.json()).total).toBe(2);

    // Even after calendar cutover, unapproved tariff terms must exclude only
    // the affected villa, not turn the entire dated search into HTTP 500.
    await db.project.update({
      where: { id: project.id }, data: { projectType: 'resort' },
    });
    await db.commercialOffering.create({
      data: {
        unitId: sourceUnit.id, offeringType: 'short_term_stay',
        status: 'active',
        pricingTerms: { sourceSystem: 'layantara_os', quoteEngine: 'pending_validation' },
      },
    });
    await db.commercialOffering.create({
      data: { unitId: sellableUnit.id, offeringType: 'short_stay', status: 'active' },
    });
    const dated = await GET(makeRequest({
      projectId: project.id, adultsCount: '2',
      startDate: '2026-12-15', endDate: '2026-12-18',
    }));
    expect(dated.status).toBe(200);
    const data = await dated.json();
    expect(data.total).toBe(1);
    expect(data.units.map((unit: { id: string }) => unit.id)).toEqual([sellableUnit.id]);
  });
});
