import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { readFileSync } from 'node:fs';

const h = vi.hoisted(() => ({
  project: vi.fn(), unit: vi.fn(), categories: vi.fn(), contentKey: vi.fn(), copy: vi.fn(),
  guard: vi.fn(), labels: vi.fn(), locale: 'en', translations: new Map<string, string>(),
}));
vi.mock('@/lib/prisma', () => ({ prisma: {
  unit: { findFirst: h.unit, findUnique: h.unit, count: vi.fn().mockResolvedValue(1) },
  project: { findUnique: h.project }, inventoryCategory: { findMany: h.categories },
  booking: { findMany: vi.fn().mockResolvedValue([]) },
  contentKey: { findUnique: h.contentKey }, ratePlan: { findMany: vi.fn().mockResolvedValue([]) },
} }));
vi.mock('@/modules/booking/source-authority', () => ({ allExcludedSourceControlledUnitIds: vi.fn().mockResolvedValue([]), excludedSourceControlledUnits: vi.fn().mockResolvedValue([]) }));
vi.mock('./public-managed-import', () => ({ managedImportedInventoryIds: vi.fn().mockResolvedValue({ unitIds: [], projectIds: [] }) }));
vi.mock('./public-discovery', () => ({ discoveryVisibility: () => ({ assetStatus: { not: 'suspended' } }) }));
vi.mock('./public-sleeping', () => ({ PUBLIC_SLEEPING_SPACES_QUERY: {}, publicSleepingSpaces: () => [] }));
vi.mock('./project-editorial', () => ({ categoryEditorialKeys: () => ({ titleKey: 'category.title', descriptionKey: 'category.description' }) }));
vi.mock('./project-amenities.service', () => ({ listPublicProjectAmenities: vi.fn().mockResolvedValue([]) }));
vi.mock('./project-nearby.service', () => ({ listProjectNearbyPlaces: vi.fn().mockResolvedValue([]) }));
vi.mock('./public-responsibility', () => ({ resolveProjectResponsibility: () => null, resolveUnitResponsibility: () => null }));
vi.mock('@/modules/content', () => ({ tMany: h.copy }));
vi.mock('@/modules/analytics', () => ({ track: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/modules/core', () => ({ MOBILIZATION_STEPS: [], computePriceBreakdown: vi.fn(), checkAvailability: vi.fn() }));
vi.mock('@/modules/booking', () => ({ resolveStayCancellationPolicy: vi.fn().mockResolvedValue({ name: 'existing-policy' }), resolveStayCancellationPolicyForDates: vi.fn() }));
vi.mock('@/app/actions/getCurrentUser', () => ({ getCurrentUser: vi.fn().mockResolvedValue(null) }));
vi.mock('@/app/libs/requireAdminPage', () => ({ requireAdminPage: h.guard }));
vi.mock('@/lib/i18n', () => ({ getRequestLocale: () => h.locale, getLabels: h.labels }));
vi.mock('@/lib/format', () => ({ UI_LOCALE: 'en-US' }));
vi.mock('@/modules/content/tariff-editor-usability.seed', () => ({ TARIFF_EDITOR_USABILITY_DRAFTS: {} }));
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('NOT_FOUND'); } }));
vi.mock('next/link', () => ({ default: 'a' }));
vi.mock('@/components/Breadcrumb', () => ({ Breadcrumb: 'nav' }));
vi.mock('@/components/units/UnitPublicationPanel', () => ({ default: 'section' }));
vi.mock('@/components/units/AvailabilityPricingPanel', () => ({ default: 'section' }));
vi.mock('@/app/(admin)/app/admin/units/[id]/onboarding-client', () => ({ default: 'section' }));
vi.mock('@/app/(admin)/app/admin/units/[id]/tariff-preview-client', () => ({ default: 'section' }));
vi.mock('@/app/(admin)/app/admin/units/[id]/tariff-editor-client', () => ({ default: 'section' }));
vi.mock('@/app/(admin)/app/admin/units/[id]/booking-mode-client', () => ({ default: 'section' }));

import { getPublicProjectBySlug, getPublicUnitById } from './public.service';
import { GET } from '@/app/api/units/[unitId]/route';
import UnitOnboardingPage from '@/app/(admin)/app/admin/units/[id]/page';

const photos = [1, 2, 3].map(n => ({ mediaId: `p${n}`, sort: n,
  media: { id: `p${n}`, storageKey: `/fixtures/${n}.jpg`, kind: 'photo', mimeType: 'image/jpeg', encrypted: false, sizeBytes: 100 },
}));
function fixture(marketingTitleKey: string | null = 'unit.original.title') {
  const project = { id: 'project', name: 'Project', slug: 'project', status: 'live', projectType: 'villa_estate',
    coverMediaId: 'p1', galleryMedia: photos, area: null, amenities: [], orgRoles: [], latitude: 7, longitude: 98, amenityKeys: [], address: 'Address' };
  const category = { id: 'category', categoryKey: 'villa', name: 'Villa', status: 'live', baseNightlyThb: 10000, minNights: 1, coverMediaId: 'p1', galleryMedia: photos, bedrooms: 2 };
  const unit = { id: 'unit', projectId: 'project', name: 'Villa A1', status: 'live', assetStatus: 'active',
    marketingTitleKey, descriptionKey: 'unit.changed.description', accommodationType: 'exact_unit',
    coverMediaId: 'p1', media: photos, inventoryCategoryId: 'category', inventoryCategory: category, project,
    baseNightlyThb: 10000, minNights: 1, instantBook: true,
    commercialOfferings: [{ offeringType: 'short_stay', status: 'active' }], engagements: [], complianceRecords: [], mobilizationChecklist: [],
    unitType: 'villa', bedrooms: 2, bathrooms: 2, maxGuests: 4,
    sizeSqm: null, usableAreaSqm: null, grossAreaSqm: null, outdoorAreaSqm: null, plotAreaSqm: null,
    unitFeatures: [], views: [], amenityKeys: [], owner: null,
  };
  h.project.mockResolvedValue({ ...project, units: [unit] }); h.unit.mockResolvedValue(unit); h.categories.mockResolvedValue([category]);
  return unit;
}
const props = (result: unknown) => JSON.stringify(result, (key, value) => key === 'type' || key === '_owner' ? undefined : value);
const api = () => GET(new NextRequest('http://localhost/api/units/unit'), { params: { unitId: 'unit' } });

beforeEach(() => {
  vi.clearAllMocks(); h.locale = 'en'; h.guard.mockResolvedValue(undefined); h.labels.mockImplementation(async (value: object) => value);
  h.contentKey.mockResolvedValue({ namespace: 'legacy' }); h.translations.clear();
  h.translations.set('unit.original.title', 'Original marketing title');
  h.translations.set('unit.changed.title', 'Wrong newly derived title');
  h.translations.set('unit.changed.description', 'Updated description');
  h.copy.mockImplementation(async (_db: unknown, keys: string[]) => Object.fromEntries(keys.filter(key => h.translations.has(key)).map(key => [key, h.translations.get(key)])));
  fixture();
});

describe('public title readers', () => {
  it('keeps project/category unit cards and bookable detail on the explicit key', async () => {
    expect((await getPublicProjectBySlug('project'))?.units[0].titleKey).toBe('unit.original.title');
    expect((await getPublicUnitById('unit'))?.titleKey).toBe('unit.original.title');
  });
  it('keeps legacy title fallback in both public projections', async () => {
    fixture(null);
    expect((await getPublicProjectBySlug('project'))?.units[0].titleKey).toBe('unit.changed.title');
    expect((await getPublicUnitById('unit'))?.titleKey).toBe('unit.changed.title');
  });
  it('returns localized explicit-title copy and independent current description in the actual API', async () => {
    h.locale = 'ru'; h.translations.set('unit.original.title', 'Исходный заголовок');
    const response = await api(); expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ marketingTitle: 'Исходный заголовок', description: 'Updated description' });
    expect(h.copy).toHaveBeenCalledWith(expect.anything(), expect.arrayContaining(['unit.original.title', 'unit.changed.description']), 'ru');
    expect(h.copy.mock.lastCall?.[1]).not.toContain('unit.changed.title');
    expect(h.unit.mock.lastCall?.[0].select.marketingTitleKey).toBe(true);
  });
  it('does not substitute another title if an explicit key has no translation, then sees late creation and edits', async () => {
    h.translations.delete('unit.original.title');
    expect((await (await api()).json()).marketingTitle).not.toBe('Wrong newly derived title');
    h.translations.set('unit.original.title', 'Late creation');
    expect((await (await api()).json()).marketingTitle).toBe('Late creation');
    h.translations.set('unit.original.title', 'Concurrent CMS edit');
    expect((await (await api()).json()).marketingTitle).toBe('Concurrent CMS edit');
  });
  it('retains API fallback for a legacy unit and does not expose the new raw pointer', async () => {
    fixture(null); const body = await (await api()).json();
    expect(body.marketingTitle).toBe('Wrong newly derived title'); expect(body).not.toHaveProperty('marketingTitleKey');
  });
  it.each(['draft', 'paused'])('preserves public booking gate for %s inventory', async status => {
    const unit = fixture(); unit.status = status; h.unit.mockResolvedValue(unit);
    expect((await api()).status).toBe(404); expect(h.copy).not.toHaveBeenCalled();
    expect(await getPublicUnitById('unit')).toBeNull();
  });
});

describe('existing CMS title editor target', () => {
  it('links the explicit original key and its real namespace after description COW', async () => {
    const rendered = props(await UnitOnboardingPage({ params: { id: 'unit' } }));
    expect(rendered).toContain('/app/admin/content?ns=legacy&key=unit.original.title');
    expect(rendered).toContain('Edit marketing title');
    expect(rendered).toContain('/app/admin/content?ns=legacy&key=unit.changed.description');
    expect(rendered).not.toContain('key=unit.changed.title');
    expect(h.guard.mock.invocationCallOrder[0]).toBeLessThan(h.contentKey.mock.invocationCallOrder[0]);
  });
  it('links the derived title only when the canonical pointer is null', async () => {
    fixture(null); expect(props(await UnitOnboardingPage({ params: { id: 'unit' } }))).toContain('key=unit.changed.title');
  });
  it('does not invent a title or fall back when the explicit title ContentKey is absent', async () => {
    h.contentKey.mockImplementation(async ({ where }) => where.key === 'unit.original.title' ? null : { namespace: 'unit' });
    const rendered = props(await UnitOnboardingPage({ params: { id: 'unit' } }));
    expect(rendered).not.toContain('key=unit.original.title'); expect(rendered).not.toContain('key=unit.changed.title');
    expect(rendered).toContain('Edit description');
  });
  it('does not read content before admin authorization', async () => {
    h.guard.mockRejectedValue(new Error('Denied'));
    await expect(UnitOnboardingPage({ params: { id: 'unit' } })).rejects.toThrow('Denied');
    expect(h.unit).not.toHaveBeenCalled(); expect(h.contentKey).not.toHaveBeenCalled();
  });
});

it.each(['reconcile-layantara-a13', 'audit-layantara-public-copy', 'reconcile-layantara-public-content'])('keeps maintenance reader %s pointer-aware without a backfill', name => {
  const source = readFileSync(new URL(`../../../scripts/${name}.ts`, import.meta.url), 'utf8');
  expect(source).toContain('marketingTitleKey: true');
  expect(source).toContain('const titleKey = resolveUnitMarketingTitleKey(unit)');
  expect(source).not.toContain("descriptionKey.replace(/\\.description$/");
  expect([...source.matchAll(/marketingTitleKey\s*:\s*(\w+)/g)].map(match => match[1])).toEqual(['true']);
});
