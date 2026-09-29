import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { db, resetDb, createIdentity, createProject, createUnit } from '@/test/util';

vi.mock('@/app/actions/getCurrentUser', () => ({
  getCurrentUser: async () => null,
}));

vi.mock('@/lib/prisma', async () => {
  const util = await import('@/test/util');
  return { prisma: util.db };
});

import { GET } from './route';

function makeRequest(): NextRequest {
  return new NextRequest('http://localhost/api/units/x');
}

describe('GET /api/units/[unitId] — satang-to-baht display boundary (Q47)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('converts baseNightlyThb to baht for the guest-facing unit page', async () => {
    const project = await createProject({ status: 'live' });
    // 500000 satang stored — the guest must see ฿5,000/night, not ฿500,000.
    const unit = await createUnit({
      projectId: project.id,
      status: 'live',
      baseNightlyThb: 500000,
    });

    const response = await GET(makeRequest(), { params: { unitId: unit.id } });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.baseNightlyThb).toBe(5000);
  });
});

/**
 * A unit is public only when its project is public too.
 *
 * This route checked the unit's status alone, so archiving a project left its
 * villas' pages live — the screen a guest books from — while the SEO/metadata
 * read (`getPublicUnitById`) already 404'd them.
 */
describe('GET /api/units/[unitId] — a unit is only as public as its project', () => {
  beforeEach(async () => {
    await resetDb();
  });

  async function unitInProjectWithStatus(status: 'live' | 'draft' | 'archived') {
    const project = await createProject({ slug: `unit-detail-${status}`, status });
    return createUnit({ projectId: project.id, status: 'live', baseNightlyThb: 500000 });
  }

  it('serves a live unit in a live project', async () => {
    const unit = await unitInProjectWithStatus('live');
    const res = await GET(makeRequest(), { params: { unitId: unit.id } });
    expect(res.status).toBe(200);
  });

  it('404s a live unit whose project is archived', async () => {
    const unit = await unitInProjectWithStatus('archived');
    const res = await GET(makeRequest(), { params: { unitId: unit.id } });
    expect(res.status).toBe(404);
  });

  it('404s a live unit whose project is still a draft', async () => {
    const unit = await unitInProjectWithStatus('draft');
    const res = await GET(makeRequest(), { params: { unitId: unit.id } });
    expect(res.status).toBe(404);
  });

  it('does not leak the project status into the public payload', async () => {
    const unit = await unitInProjectWithStatus('live');
    const res = await GET(makeRequest(), { params: { unitId: unit.id } });
    const data = await res.json();

    expect(data.project).toEqual({ id: expect.any(String), name: expect.any(String) });
    expect(data.status).toBeUndefined();
  });
});

describe('GET /api/units/[unitId] — truthful gallery scope', () => {
  beforeEach(resetDb);

  async function roomWithCategoryPhoto(projectType: 'hotel' | 'resort') {
    const actor = await createIdentity();
    const project = await createProject({ status: 'live' });
    await db.project.update({ where: { id: project.id }, data: { projectType } });
    const unit = await createUnit({ projectId: project.id, status: 'live' });
    const category = await db.inventoryCategory.findUniqueOrThrow({
      where: { id: unit.inventoryCategoryId! },
    });
    const asset = await db.mediaAsset.create({ data: {
      uploadedByIdentityId: actor.id, kind: 'photo', mimeType: 'image/jpeg',
      sizeBytes: 12, storageKey: 'https://example.com/representative.jpg',
    } });
    await db.inventoryCategoryMedia.create({ data: {
      categoryId: category.id, mediaId: asset.id, sort: 0,
    } });
    await db.inventoryCategory.update({ where: { id: category.id }, data: { coverMediaId: asset.id } });
    return unit;
  }

  it('uses labeled category representative images for hotel rooms', async () => {
    const unit = await roomWithCategoryPhoto('hotel');
    const result = await GET(makeRequest(), { params: { unitId: unit.id } });
    const body = await result.json();
    expect(result.status).toBe(200);
    expect(body.photoScope).toBe('room_type');
    expect(body.images).toEqual(['https://example.com/representative.jpg']);
  });

  it('does not impersonate a private resort villa with category photos', async () => {
    const unit = await roomWithCategoryPhoto('resort');
    const result = await GET(makeRequest(), { params: { unitId: unit.id } });
    const body = await result.json();
    expect(result.status).toBe(200);
    expect(body.photoScope).toBe('none');
    expect(body.images).toEqual([]);
  });
});
