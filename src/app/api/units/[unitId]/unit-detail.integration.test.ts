import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { resetDb, createProject, createUnit, createIdentity, createBooking, db } from '@/test/util';

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


import { POST as postCanonicalQuote } from '@/app/api/pricing/breakdown/route';

function datedRequest(unitId: string, start = '2026-12-15', end = '2026-12-18') {
  return new NextRequest(
    'http://localhost/api/units/' + unitId +
      '?startDate=' + start + '&endDate=' + end + '&guests=2'
  );
}

describe('public unit detail uses the canonical booking price and inventory authority', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('returns exactly the guest quote subtotal/tax/total for the same stay', async () => {
    const project = await createProject({ status: 'live' });
    const unit = await createUnit({
      projectId: project.id, status: 'live', baseNightlyThb: 500000,
    });
    const quoteRequest = new NextRequest('http://localhost/api/pricing/breakdown', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        unitId: unit.id, startDate: '2026-12-15',
        endDate: '2026-12-18', guestCount: 2,
      }),
    });

    const [detail, quote] = await Promise.all([
      GET(datedRequest(unit.id), { params: { unitId: unit.id } }),
      postCanonicalQuote(quoteRequest),
    ]);
    expect(detail.status).toBe(200);
    expect(quote.status).toBe(200);
    const detailData = await detail.json();
    const quoteData = await quote.json();
    expect(detailData.pricing.subtotal).toBe(quoteData.subtotal);
    expect(detailData.pricing.vatTax).toBe(quoteData.occupancyTax);
    expect(detailData.pricing.total).toBe(quoteData.total);
    expect(detailData.pricing.nights).toBe(quoteData.nights);
    expect(detailData.pricing.isAvailable).toBe(true);
    expect(detailData.pricing.availableCapacity).toBe(1);
    expect(quoteData.isAvailable).toBe(detailData.pricing.isAvailable);
    expect(quoteData.availableCapacity).toBe(detailData.pricing.availableCapacity);
  });

  it('applies dated unit overrides to both public surfaces without per-night SQL divergence', async () => {
    const project = await createProject({ status: 'live' });
    const unit = await createUnit({
      projectId: project.id, status: 'live', baseNightlyThb: 500000,
    });
    await db.pricingRule.create({
      data: {
        unitId: unit.id,
        startDate: new Date('2026-12-16'),
        endDate: new Date('2026-12-17'),
        nightlyThb: 700000,
        label: 'One-night override',
      },
    });
    const detailResponse = await GET(datedRequest(unit.id), { params: { unitId: unit.id } });
    const quoteResponse = await postCanonicalQuote(
      new NextRequest('http://localhost/api/pricing/breakdown', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unitId: unit.id, startDate: '2026-12-15',
          endDate: '2026-12-18', guestCount: 2,
        }),
      })
    );
    expect(detailResponse.status).toBe(200);
    expect(quoteResponse.status).toBe(200);
    const detail = await detailResponse.json();
    const quote = await quoteResponse.json();
    expect(detail.pricing.total).toBe(quote.total);
    expect(quote.lines.map((line: { nightly_thb: number }) => line.nightly_thb))
      .toEqual([5000, 7000, 5000]);
  });

  it('marks a confirmed booking unavailable, without hiding the unit detail', async () => {
    const project = await createProject({ status: 'live' });
    const unit = await createUnit({ projectId: project.id, status: 'live' });
    const guest = await createIdentity();
    await createBooking({
      unitId: unit.id, projectId: project.id, guestIdentityId: guest.id,
      startDate: new Date('2026-12-16'), endDate: new Date('2026-12-18'),
      status: 'confirmed',
    });
    const response = await GET(datedRequest(unit.id), { params: { unitId: unit.id } });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.pricing.isAvailable).toBe(false);
    expect(data.pricing.availableCapacity).toBe(0);
  });

  it('honors an owner block and treats the checkout boundary as exclusive', async () => {
    const project = await createProject({ status: 'live' });
    const unit = await createUnit({ projectId: project.id, status: 'live' });
    await db.blockedDate.create({
      data: {
        unitId: unit.id,
        startDate: new Date('2026-12-16'),
        endDate: new Date('2026-12-18'),
        reason: 'owner_hold',
      },
    });
    const blocked = await GET(datedRequest(unit.id), { params: { unitId: unit.id } });
    expect((await blocked.json()).pricing.isAvailable).toBe(false);
    const checkoutDay = await GET(
      datedRequest(unit.id, '2026-12-18', '2026-12-20'),
      { params: { unitId: unit.id } }
    );
    expect((await checkoutDay.json()).pricing.isAvailable).toBe(true);
  });

  it('does not publish a unit belonging to an inactive category', async () => {
    const project = await createProject({ status: 'live' });
    const unit = await createUnit({ projectId: project.id, status: 'live' });
    await db.inventoryCategory.update({
      where: { id: unit.inventoryCategoryId! },
      data: { status: 'draft' },
    });
    const response = await GET(makeRequest(), { params: { unitId: unit.id } });
    expect(response.status).toBe(404);
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
