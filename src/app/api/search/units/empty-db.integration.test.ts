import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { resetDb } from '@/test/util';

vi.mock('@/lib/prisma', async () => {
  const util = await import('@/test/util');
  return { prisma: util.db };
});

import { GET } from './route';

/**
 * The deployed database has the schema and nothing else: no config, no content
 * keys, no units. No other test covers that, because every one of them seeds
 * something first — so a failure that only appears on a fresh deployment would
 * never be caught here.
 */
describe('search against a database with schema but no data', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('returns an empty result rather than failing', async () => {
    const res = await GET(
      new NextRequest('http://localhost/api/search/units?adultsCount=2&startDate=2026-08-20&endDate=2026-08-29')
    );
    const body = await res.json();

    if (res.status !== 200) console.log('STATUS', res.status, 'BODY', JSON.stringify(body));
    expect(res.status).toBe(200);
    expect(body.units).toEqual([]);
    expect(body.total).toBe(0);
  });
});
