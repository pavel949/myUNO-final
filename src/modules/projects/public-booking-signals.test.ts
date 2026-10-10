import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const mocks = vi.hoisted(() => ({
  projects: vi.fn(), project: vi.fn(), unit: vi.fn(), categories: vi.fn(),
  bookings: vi.fn(), excluded: vi.fn(), imported: vi.fn(),
}));
vi.mock('@/lib/prisma', () => ({ prisma: {
  project: { findMany: mocks.projects, findUnique: mocks.project },
  unit: { findFirst: mocks.unit }, inventoryCategory: { findMany: mocks.categories },
  booking: { findMany: mocks.bookings },
} }));
vi.mock('@/modules/booking/source-authority', () => ({ allExcludedSourceControlledUnitIds: mocks.excluded }));
vi.mock('./public-managed-import', () => ({ managedImportedInventoryIds: mocks.imported }));
vi.mock('@/modules/content', () => ({ tMany: vi.fn().mockResolvedValue({}) }));
vi.mock('./project-amenities.service', () => ({ listPublicProjectAmenities: vi.fn().mockResolvedValue([]) }));
vi.mock('./project-nearby.service', () => ({ listProjectNearbyPlaces: vi.fn().mockResolvedValue([]) }));
import { getPublicProjectBySlug, getPublicUnitById, listPublicProjects } from './public.service';

const photos = [1, 2, 3].map(n => ({
  mediaId: `photo-${n}`, sort: n,
  media: { id: `photo-${n}`, storageKey: `/fixtures/photo-${n}.jpg`, kind: 'photo', mimeType: 'image/jpeg', encrypted: false, sizeBytes: 100 },
}));
function fixture(status = 'live', projectStatus = 'live') {
  const category = { id: 'category', categoryKey: 'villa', name: 'Villa', status: 'live', baseNightlyThb: 1080000, minNights: 1, coverMediaId: 'photo-1', galleryMedia: photos, bedrooms: 2 };
  const project = {
    id: 'project', status: projectStatus, projectType: 'villa_estate', slug: 'resort', name: 'Resort',
    coverMediaId: 'photo-1', galleryMedia: photos, area: null, amenities: [], orgRoles: [],
    latitude: 7, longitude: 98, amenityKeys: [], address: 'Test address',
  };
  const unit = {
    id: 'unit', status, assetStatus: 'active', name: 'Villa', accommodationType: 'exact_unit',
    coverMediaId: 'photo-1', media: photos, inventoryCategory: category,
    baseNightlyThb: 900000, instantBook: true, project,
    commercialOfferings: [{ offeringType: 'short_term_stay', status: 'active' }], engagements: [],
    descriptionKey: null, unitType: 'villa', bedrooms: 2, bathrooms: 2, maxGuests: 4,
    sizeSqm: null, usableAreaSqm: null, grossAreaSqm: null, outdoorAreaSqm: null, plotAreaSqm: null,
    unitFeatures: [], views: [], amenityKeys: [],
  };
  return { project: { ...project, units: [unit] }, unit, category };
}
function load(f = fixture()) {
  mocks.projects.mockResolvedValue([f.project]); mocks.project.mockResolvedValue(f.project);
  mocks.unit.mockResolvedValue(f.unit); mocks.categories.mockResolvedValue([f.category]);
  return f;
}
beforeEach(() => {
  vi.clearAllMocks(); mocks.excluded.mockResolvedValue([]);
  mocks.imported.mockResolvedValue({ unitIds: ['unit'], projectIds: ['project'] });
  mocks.bookings.mockResolvedValue([]); load();
});

describe('public booking signals are stricter than inquiry visibility', () => {
  it('keeps a fully photographed, offered, priced imported draft visible without booking or price-from promises', async () => {
    load(fixture('draft'));
    const project = await getPublicProjectBySlug('resort');
    expect(project?.units).toHaveLength(1);
    expect(project?.units[0]).toMatchObject({ id: 'unit', mediaReady: true, bookable: false, instantBook: false });
    expect(project?.units[0].galleryUrls).toHaveLength(3);
    expect(project?.categories[0]).toMatchObject({ unitCount: 1, fromNightlyThb: null });
    expect((await listPublicProjects())[0]).toMatchObject({ liveUnitCount: 1, fromNightlyThb: null });
    // Null selects the existing inquiry-only page fallback instead of the priced widget.
    expect(await getPublicUnitById('unit')).toBeNull();
  });
  it.each(['draft', 'paused', 'archived'])('does not advertise booking for %s inventory', async status => {
    load(fixture(status));
    expect((await getPublicProjectBySlug('resort'))?.units[0].bookable).toBe(false);
    expect((await listPublicProjects())[0].fromNightlyThb).toBeNull();
    expect(await getPublicUnitById('unit')).toBeNull();
  });
  it('keeps live units inside imported draft projects inquiry-only', async () => {
    load(fixture('live', 'draft'));
    expect((await getPublicProjectBySlug('resort'))?.units[0]).toMatchObject({ bookable: false, instantBook: false });
    expect((await listPublicProjects())[0].fromNightlyThb).toBeNull();
    expect(await getPublicUnitById('unit')).toBeNull();
  });
  it('preserves canonical price and instant/request mode for ready live inventory', async () => {
    expect((await getPublicProjectBySlug('resort'))?.units[0]).toMatchObject({ bookable: true, instantBook: true, baseNightlyThb: 1080000 });
    expect((await getPublicProjectBySlug('resort'))?.categories[0].fromNightlyThb).toBe(1080000);
    expect((await listPublicProjects())[0].fromNightlyThb).toBe(1080000);
    expect(await getPublicUnitById('unit')).toMatchObject({ bookable: true, instantBook: true, baseNightlyThb: 1080000 });
    const f = fixture(); f.unit.instantBook = false; load(f);
    expect((await getPublicProjectBySlug('resort'))?.units[0]).toMatchObject({ bookable: true, instantBook: false });
    expect(await getPublicUnitById('unit')).toMatchObject({ bookable: true, instantBook: false });
  });
  it('does not let a cheaper draft lower the project or category live price', async () => {
    const f = fixture(); const draft = fixture('draft').unit;
    draft.id = 'draft'; draft.inventoryCategory.baseNightlyThb = 100;
    f.project.units.push(draft); load(f);
    expect((await listPublicProjects())[0].fromNightlyThb).toBe(1080000);
    expect((await getPublicProjectBySlug('resort'))?.categories[0]).toMatchObject({ unitCount: 2, fromNightlyThb: 1080000 });
  });
  it('excludes suspended inventory in all query paths and defensively blocks its booking signals', async () => {
    const f = fixture(); f.unit.assetStatus = 'suspended'; load(f);
    expect((await getPublicProjectBySlug('resort'))?.units[0].bookable).toBe(false);
    expect((await listPublicProjects())[0].fromNightlyThb).toBeNull();
    expect(await getPublicUnitById('unit')).toBeNull();
    expect(mocks.project.mock.lastCall?.[0].include.units.where.assetStatus).toEqual({ not: 'suspended' });
    expect(mocks.projects.mock.lastCall?.[0].include.units.where.assetStatus).toEqual({ not: 'suspended' });
    expect(mocks.unit.mock.lastCall?.[0].where.assetStatus).toEqual({ not: 'suspended' });
  });
  it('preserves media readiness and source-authority exclusions', async () => {
    const f = fixture(); f.unit.media = []; load(f);
    expect((await getPublicProjectBySlug('resort'))?.units[0]).toMatchObject({ bookable: false, mediaReady: false });
    expect((await listPublicProjects())[0].fromNightlyThb).toBeNull();
    expect(await getPublicUnitById('unit')).toBeNull();
    load(); mocks.excluded.mockResolvedValue(['unit']);
    expect((await getPublicProjectBySlug('resort'))?.units[0].bookable).toBe(false);
    expect((await listPublicProjects())[0].fromNightlyThb).toBeNull();
  });
  it('does not turn missing rates into a booking offer', async () => {
    const f = fixture(); f.category.baseNightlyThb = 0; load(f);
    expect((await getPublicProjectBySlug('resort'))?.units[0].bookable).toBe(false);
    expect((await listPublicProjects())[0].fromNightlyThb).toBeNull();
    // A zero category base can still have an approved seasonal tariff.
    expect(await getPublicUnitById('unit')).toMatchObject({ bookable: true, baseNightlyThb: 0 });
  });
  it.each(['unit', 'draft', 'excluded', 'unknown'])('keeps the requested %s identity constrained with nonempty source exclusions', async requestedId => {
    mocks.excluded.mockResolvedValue(['excluded']);
    mocks.unit.mockImplementation(async ({ where }) => {
      // Model Prisma identity filtering with another ready live row present.
      const live = fixture().unit;
      if (typeof where.id === 'string') return where.id === live.id ? live : null;
      return (!where.id.equals || where.id.equals === live.id) &&
        !where.id.notIn?.includes(live.id) ? live : null;
    });
    const result = await getPublicUnitById(requestedId);
    expect(mocks.unit.mock.lastCall?.[0].where.id).toEqual({ equals: requestedId, notIn: ['excluded'] });
    if (requestedId === 'unit') expect(result?.id).toBe('unit');
    else expect(result).toBeNull();
  });
  it('keeps the exact-unit page inquiry fallback, without passing a false-present booking DTO', async () => {
    load(fixture('draft'));
    const stay = await getPublicUnitById('unit');
    const discovery = { id: 'unit', name: 'Villa', galleryUrls: photos.map(p => p.media.storageKey) };
    const selected = stay ?? discovery;
    expect('bookable' in selected).toBe(false);
    const page = readFileSync(new URL('../../app/units/[id]/page.tsx', import.meta.url), 'utf8');
    expect(page).toContain("getPublicUnitById(params.id).catch(() => null) ?? (await listPublicDiscoveryUnits({ unitId: params.id }))[0]");
    expect(page).toContain("if (!('bookable' in unit))");
    expect(page).toContain('LeadFormSection audience={inquiryAudience}');
  });
});
