import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { db, resetDb, createProject, createUnit } from '@/test/util';

vi.mock('@/lib/prisma', async () => {
  const util = await import('@/test/util');
  return { prisma: util.db };
});

import { GET } from './route';

/**
 * The price filter compared baht against satang, and so matched nothing.
 *
 * `unit.base_nightly_thb` is satang — the Layantara seed says so verbatim, and
 * its rates (547900 for ฿5,479 a night) only make sense that way. The filter
 * labels ask the guest for "Min/Max nightly THB", so `maxPrice` arrives in
 * baht, and the route passed it straight into a `lte` against the satang
 * column. A guest setting a ceiling of ฿10,000 was asking for units under ฿100
 * a night: an empty result page, with no error and nothing to suggest the
 * filter itself was the problem.
 *
 * Silence is the failure mode worth pinning. A wrong-but-populated result page
 * gets reported; an empty one gets read as "nothing available here".
 */
describe('GET /api/search/units — the price filter speaks baht (T-071)', () => {
  let projectId: string;

  beforeEach(async () => {
    await resetDb();
    const project = await createProject({ status: 'live' });
    projectId = project.id;

    // ฿4,000, ฿8,000 and ฿20,000 a night, stored as satang.
    await createUnit({ projectId, name: 'Budget', baseNightlyThb: 400_000, status: 'live' });
    await createUnit({ projectId, name: 'Mid', baseNightlyThb: 800_000, status: 'live' });
    await createUnit({ projectId, name: 'Premium', baseNightlyThb: 2_000_000, status: 'live' });
  });

  async function names(query: Record<string, string>): Promise<string[]> {
    const params = new URLSearchParams({ projectId, adultsCount: '1', ...query });
    const body = await (
      await GET(new NextRequest(`http://localhost/api/search/units?${params}`))
    ).json();
    return (body.units as { name: string }[]).map((u) => u.name).sort();
  }

  it('a ceiling of ฿10,000 keeps the two villas under it, and drops the one over', async () => {
    expect(await names({ maxPrice: '10000' })).toEqual(['Budget', 'Mid']);
  });

  it('a floor of ฿5,000 drops the villa under it', async () => {
    expect(await names({ minPrice: '5000' })).toEqual(['Mid', 'Premium']);
  });

  it('a band selects only what falls inside it', async () => {
    expect(await names({ minPrice: '5000', maxPrice: '10000' })).toEqual(['Mid']);
  });

  it('no filter returns everything', async () => {
    expect(await names({})).toEqual(['Budget', 'Mid', 'Premium']);
  });

  it('returns the nightly rate in satang, so the display edge owns the conversion', async () => {
    const params = new URLSearchParams({ projectId, adultsCount: '1', maxPrice: '5000' });
    const body = await (
      await GET(new NextRequest(`http://localhost/api/search/units?${params}`))
    ).json();
    expect(body.units[0].baseNightlyThb).toBe(400_000);
  });
});
