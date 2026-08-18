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
