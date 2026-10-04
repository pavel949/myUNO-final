import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createProject, createUnit, db, resetDb } from '@/test/util';

vi.mock('@/lib/prisma', async () => {
  const util = await import('@/test/util');
  return { prisma: util.db };
});

vi.mock('@/app/actions/getCurrentUser', () => ({
  getCurrentUser: async () => null,
}));

vi.mock('@/modules/analytics', () => ({
  track: async () => undefined,
}));

import { GET } from './route';

describe('GET /api/units/[unitId] — public media readiness', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('returns 404 for a live unit whose public gallery is incomplete', async () => {
    const project = await createProject({ status: 'live' });
    const unit = await createUnit({
      projectId: project.id,
      status: 'live',
      publicMediaReady: false,
    });

    const response = await GET(
      new NextRequest(`http://localhost/api/units/${unit.id}`),
      { params: { unitId: unit.id } }
    );

    expect(response.status).toBe(404);
  });

  it('returns an exact-unit gallery only after the unit is media-ready', async () => {
    const project = await createProject({ status: 'live' });
    const unit = await createUnit({
      projectId: project.id,
      status: 'live',
    });

    const response = await GET(
      new NextRequest(`http://localhost/api/units/${unit.id}`),
      { params: { unitId: unit.id } }
    );
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.photoScope).toBe('exact_unit');
    expect(body.mediaReadiness).toMatchObject({
      ready: true,
      representative: false,
    });
    expect(body.images).toHaveLength(3);
    expect(body.images.every((url: string) => url.includes(`unit-${unit.id}`))).toBe(true);

    const stored = await db.unit.findUnique({
      where: { id: unit.id },
      select: { coverMediaId: true, media: { select: { mediaId: true } } },
    });
    expect(stored?.coverMediaId).toBeTruthy();
    expect(stored?.media).toHaveLength(3);
  });
});
