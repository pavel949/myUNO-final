import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ findMany: vi.fn(), imported: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: { unit: { findMany: mocks.findMany } } }));
vi.mock('./public-managed-import', () => ({ managedImportedInventoryIds: mocks.imported }));
import { discoveryVisibility, listPublicDiscoveryUnits } from './public-discovery';

const unit = {
  id: 'visible', name: 'Villa', descriptionKey: 'unit.description', bedrooms: 2, bathrooms: 2,
  maxGuests: 4, sizeSqm: 150, grossAreaSqm: null, coverMediaId: null, accommodationType: 'exact_unit',
  project: { id: 'project', slug: 'resort', name: 'Resort', projectType: 'villa_estate', area: { slug: 'layan' } },
  media: [], inventoryCategory: null,
};
beforeEach(() => {
  mocks.imported.mockResolvedValue({ unitIds: ['imported'], projectIds: ['imported-project'] });
  mocks.findMany.mockResolvedValue([unit]);
});
describe('public discovery visibility separate from booking', () => {
  it('limits draft exposure to explicit imported IDs and excludes suspended units', () => {
    const where = discoveryVisibility({ unitIds: ['imported'], projectIds: ['imported-project'] });
    expect(where.assetStatus).toEqual({ not: 'suspended' });
    expect(where.OR).toEqual([{ status: 'live' }, { status: 'draft', id: { in: ['imported'] } }]);
    expect(where.project).toEqual({ OR: [{ status: 'live' }, { status: 'draft', id: { in: ['imported-project'] } }] });
  });
  it('retains visible homes without publishing incomplete photos or booking permission', async () => {
    const [result] = await listPublicDiscoveryUnits();
    expect(result).toMatchObject({ id: 'visible', coverUrl: null, galleryUrls: [] });
    expect(result).not.toHaveProperty('bookable');
    expect(result).not.toHaveProperty('instantBook');
    expect(result).not.toHaveProperty('baseNightlyThb');
    expect(result).not.toHaveProperty('ownerIdentityId');
  });
  it('applies project, area and exact category jointly, with visibility independent of the filters', async () => {
    await listPublicDiscoveryUnits({ projectId: 'project', areaSlug: 'layan', inventoryCategoryId: 'category' });
    expect(mocks.findMany.mock.lastCall?.[0].where.AND).toEqual([
      discoveryVisibility({ unitIds: ['imported'], projectIds: ['imported-project'] }),
      { projectId: 'project', project: { area: { slug: 'layan' } }, inventoryCategoryId: 'category' },
    ]);
  });
});
