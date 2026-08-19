import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { db, resetDb, createProject, createUnit, createIdentity, createBooking } from '@/test/util';

vi.mock('@/lib/prisma', async () => {
  const util = await import('@/test/util');
  return { prisma: util.db };
});

import { GET } from './route';

/**
 * Search returned every villa newest-first — the order they were entered into
 * the system. A prospect comparing four villas wants them cheapest-first, or
 * biggest-first, or best-reviewed-first, and could not ask for any of it.
 */
describe('GET /api/search/units — ordering', () => {
  let projectId: string;

  beforeEach(async () => {
    await resetDb();
    const project = await createProject({ status: 'live' });
    projectId = project.id;
  });

  function search(query: Record<string, string>) {
    const params = new URLSearchParams({ projectId, adultsCount: '1', ...query });
    return GET(new NextRequest(`http://localhost/api/search/units?${params}`));
  }

  async function names(query: Record<string, string>): Promise<string[]> {
    const body = await (await search(query)).json();
    return body.units.map((u: { name: string }) => u.name);
  }

  /** Three villas, cheapest last in creation order so the default cannot pass by luck. */
  async function threeVillas() {
    await createUnit({
      projectId, name: 'Costly', status: 'live',
      baseNightlyThb: 900_000, bedrooms: 1, maxGuests: 2,
    });
    await createUnit({
      projectId, name: 'Middle', status: 'live',
      baseNightlyThb: 500_000, bedrooms: 3, maxGuests: 8,
    });
    await createUnit({
      projectId, name: 'Cheap', status: 'live',
      baseNightlyThb: 100_000, bedrooms: 2, maxGuests: 4,
    });
  }

  it('sorts by price, both ways', async () => {
    await threeVillas();

    expect(await names({ sort: 'price_asc' })).toEqual(['Cheap', 'Middle', 'Costly']);
    expect(await names({ sort: 'price_desc' })).toEqual(['Costly', 'Middle', 'Cheap']);
  });

  it('sorts by bedrooms and by how many it sleeps', async () => {
    await threeVillas();

    expect(await names({ sort: 'bedrooms_desc' })).toEqual(['Middle', 'Cheap', 'Costly']);
    expect(await names({ sort: 'capacity_desc' })).toEqual(['Middle', 'Cheap', 'Costly']);
  });

  it('keeps newest-first as the default, and says which sort it used', async () => {
    await threeVillas();

    const body = await (await search({})).json();
    expect(body.units.map((u: { name: string }) => u.name)).toEqual([
      'Cheap',
      'Middle',
      'Costly',
    ]);
    expect(body.sort).toBe('recommended');
  });

  it('falls back instead of failing on a sort it does not know', async () => {
    await threeVillas();

    // A stale bookmark should still show villas.
    const res = await search({ sort: 'cheapest' });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.sort).toBe('recommended');
    expect(body.units).toHaveLength(3);
  });

  describe('paging', () => {
    it('never repeats a villa across pages when prices tie', async () => {
      // Equal rows come back in whatever order the database likes unless the
      // ordering is total — which silently shows the same villa twice.
      for (let i = 0; i < 6; i++) {
        await createUnit({
          projectId, name: `Same-${i}`, status: 'live',
          baseNightlyThb: 400_000, maxGuests: 2,
        });
      }

      const first = await names({ sort: 'price_asc', limit: '3', offset: '0' });
      const second = await names({ sort: 'price_asc', limit: '3', offset: '3' });

      expect(new Set([...first, ...second]).size).toBe(6);
    });
  });

  describe('by rating', () => {
    async function reviewed(name: string, ratings: number[], hidden: number[] = []) {
      const unit = await createUnit({
        projectId, name, status: 'live', baseNightlyThb: 300_000, maxGuests: 4,
      });
      let day = 1;
      for (const [rating, status] of [
        ...ratings.map((r) => [r, 'published'] as const),
        ...hidden.map((r) => [r, 'hidden'] as const),
      ]) {
        const guest = await createIdentity();
        const booking = await createBooking({
          unitId: unit.id,
          projectId,
          guestIdentityId: guest.id,
          status: 'checked_out',
          startDate: new Date(`2026-03-${String(day).padStart(2, '0')}`),
          endDate: new Date(`2026-03-${String(day + 1).padStart(2, '0')}`),
        });
        day += 2;
        await db.review.create({
          data: {
            target_type: 'stay',
            target_id: booking.id,
            author_identity_id: guest.id,
            rating,
            status,
          },
        });
      }
      return unit;
    }

    it('puts the best-reviewed first and the unreviewed last', async () => {
      await reviewed('Good', [4, 4]);
      await reviewed('Great', [5, 5]);
      await createUnit({
        projectId, name: 'Unreviewed', status: 'live', baseNightlyThb: 300_000, maxGuests: 4,
      });

      // Unreviewed is unknown, not bad — it sorts last, never as a zero.
      expect(await names({ sort: 'top_rated' })).toEqual(['Great', 'Good', 'Unreviewed']);
    });

    it('ranks the whole result set before paging, not just the page', async () => {
      // Ranking only the page would order whichever villas the database
      // happened to return first — a different list entirely.
      await reviewed('Third', [3]);
      await reviewed('Second', [4]);
      await reviewed('First', [5]);

      expect(await names({ sort: 'top_rated', limit: '1', offset: '0' })).toEqual(['First']);
      expect(await names({ sort: 'top_rated', limit: '1', offset: '1' })).toEqual(['Second']);
      expect(await names({ sort: 'top_rated', limit: '1', offset: '2' })).toEqual(['Third']);
    });

    it('reports each villa-s rating on the card, and leaves hidden reviews out', async () => {
      await reviewed('Rated', [5, 3], [1]);

      const body = await (await search({})).json();
      const card = body.units.find((u: { name: string }) => u.name === 'Rated');

      // (5 + 3) / 2 — the hidden 1 changes neither the average nor the count.
      expect(card.averageRating).toBe(4);
      expect(card.reviewCount).toBe(2);
    });

    it('reports null, not zero, for a villa nobody has reviewed', async () => {
      await createUnit({
        projectId, name: 'Fresh', status: 'live', baseNightlyThb: 300_000, maxGuests: 4,
      });

      const body = await (await search({})).json();
      expect(body.units[0].averageRating).toBeNull();
      expect(body.units[0].reviewCount).toBe(0);
    });

    it('does not count another villa-s reviews', async () => {
      await reviewed('Mine', [5]);
      await reviewed('Theirs', [1]);

      const body = await (await search({})).json();
      const byName = Object.fromEntries(
        body.units.map((u: { name: string }) => [u.name, u])
      );
      expect(byName.Mine.averageRating).toBe(5);
      expect(byName.Theirs.averageRating).toBe(1);
    });
  });

  it('applies the filters it always did, whichever sort is asked for', async () => {
    await threeVillas();

    const filtered = await (
      await search({ sort: 'top_rated', maxPrice: '500000' })
    ).json();

    expect(filtered.units.map((u: { name: string }) => u.name).sort()).toEqual([
      'Cheap',
      'Middle',
    ]);
    expect(filtered.total).toBe(2);
  });
});

/**
 * "Villas in Bang Tao" was a question the search could not hear: a location was
 * a display string on the project, so nothing could be filtered by it.
 */
describe('GET /api/search/units — by area', () => {
  beforeEach(async () => {
    await resetDb();
  });

  async function twoBeaches() {
    const west = await db.area.create({
      data: { slug: 'west-coast', nameKey: 'area.west.name', status: 'live' },
    });
    const bangTao = await db.area.create({
      data: { slug: 'bang-tao', nameKey: 'area.bt.name', parentId: west.id, status: 'live' },
    });
    const kata = await db.area.create({
      data: { slug: 'kata', nameKey: 'area.kata.name', status: 'live' },
    });

    const inBangTao = await createProject({ slug: 'p-bt', areaId: bangTao.id, status: 'live' });
    const inKata = await createProject({ slug: 'p-kata', areaId: kata.id, status: 'live' });

    await createUnit({ projectId: inBangTao.id, name: 'Bang Tao villa', status: 'live', maxGuests: 4 });
    await createUnit({ projectId: inKata.id, name: 'Kata villa', status: 'live', maxGuests: 4 });

    return { west, bangTao, kata, inBangTao, inKata };
  }

  function byArea(query: Record<string, string>) {
    const params = new URLSearchParams({ adultsCount: '1', ...query });
    return GET(new NextRequest(`http://localhost/api/search/units?${params}`));
  }

  it('filters to the villas in an area', async () => {
    await twoBeaches();

    const body = await (await byArea({ areaSlug: 'bang-tao' })).json();
    expect(body.units.map((u: { name: string }) => u.name)).toEqual(['Bang Tao villa']);
  });

  it('a parent area covers the beaches beneath it', async () => {
    await twoBeaches();

    // "The west coast" covers Bang Tao without anyone restating the list.
    const body = await (await byArea({ areaSlug: 'west-coast' })).json();
    expect(body.units.map((u: { name: string }) => u.name)).toEqual(['Bang Tao villa']);
  });

  it('an unknown area matches nothing, not everything', async () => {
    await twoBeaches();

    // Silently widening a filtered search to the whole portfolio is the
    // dangerous direction to fail in.
    const body = await (await byArea({ areaSlug: 'atlantis' })).json();
    expect(body.units).toHaveLength(0);
    expect(body.total).toBe(0);
  });

  it('intersects with an explicit project rather than letting one overwrite the other', async () => {
    const { inKata } = await twoBeaches();

    // Kata's project is not in Bang Tao, so asking for both yields nothing —
    // not "everything in Bang Tao" and not "everything in Kata".
    const body = await (await byArea({ areaSlug: 'bang-tao', projectId: inKata.id })).json();
    expect(body.units).toHaveLength(0);
  });

  it('agrees with itself when the project is in the area', async () => {
    const { inBangTao } = await twoBeaches();

    const body = await (await byArea({ areaSlug: 'bang-tao', projectId: inBangTao.id })).json();
    expect(body.units.map((u: { name: string }) => u.name)).toEqual(['Bang Tao villa']);
  });

  it('leaves the search unfiltered when no area is asked for', async () => {
    await twoBeaches();

    const body = await (await byArea({})).json();
    expect(body.units).toHaveLength(2);
  });
});
