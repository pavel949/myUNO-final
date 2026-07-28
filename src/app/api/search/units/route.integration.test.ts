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
    // A unit without a category never appears in the rollup
    await createUnit({ projectId, name: 'X-01', status: 'live', baseNightlyThb: 100 });

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
