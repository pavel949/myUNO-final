import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
// Next's server React supplies cache(); the client React used by jsdom does not.
vi.mock('react', async (original) => ({ ...(await original<typeof import('react')>()), cache: <T,>(fn: T) => fn }));
const state = vi.hoisted(() => ({ count: 1, labelsGate: null as Promise<void> | null, services: vi.fn(async () => []), singleCopy: vi.fn(async () => ''), batchCopy: vi.fn(async (): Promise<Record<string, string | null>> => ({})) }));
vi.mock('@/modules/projects', () => ({ getPublicProjectBySlug: async () => ({
  descriptionKey: 'project.synthetic-project.description', areaLabelKey: 'project.synthetic-project.area', handbookKey: null,
  id: 'synthetic-project', name: 'Synthetic project', slug: 'synthetic-project', address: 'Synthetic address',
  categories: [{ id: 'synthetic-category', key: 'synthetic', name: 'Synthetic category', unitCount: state.count, galleryUrls: [], bedrooms: null, fromNightlyThb: null, monthlyFromThb: null }],
  units: [], amenities: [], nearbyPlaces: [], reviews: { count: 0 }, galleryUrls: [],
}) }));
vi.mock('@/lib/i18n', () => ({ getRequestLocale: () => 'ru', getLabels: async (labels: Record<string, string>) => { await state.labelsGate; return ({ ...labels,
  'project_page.categories.homes_count': '{count} объектов', 'project_category.available': '{count} объектов',
}); } }));
vi.mock('@/modules/content', () => ({ t: state.singleCopy, tMany: state.batchCopy }));
vi.mock('@/lib/prisma', () => ({ prisma: {} }));
vi.mock('@/modules/services', () => ({ listPublicMarketplaceServices: state.services }));
vi.mock('@/modules/config', () => ({ getConfig: async () => null }));
vi.mock('@/modules/analytics', () => ({ track: async () => undefined }));
vi.mock('@/modules/destinations', () => ({ getDestination: () => ({ key: 'synthetic' }) }));
vi.mock('@/app/actions/getCurrentUser', () => ({ getCurrentUser: async () => null }));
vi.mock('@/modules/projects/commercial-discovery', () => ({ listPublicCommercialHomes: async () => [] }));
vi.mock('@/components/DiscoveryHomes', () => ({ discoveryCopy: async () => ({}) }));
vi.mock('@/components/UnitPhotoMosaic', () => ({ UnitPhotoMosaic: () => null }));
vi.mock('@/components/SearchBar', () => ({ SearchBar: () => null }));
vi.mock('@/app/(public)/lead-form-section', () => ({ LeadFormSection: () => null }));
vi.mock('@/components/projects/ProjectEditorialSections', () => ({ default: () => null }));
vi.mock('@/components/projects/ProjectServiceMarketplace', () => ({ default: () => null }));
vi.mock('@/components/projects/ProjectAmenitiesSection', () => ({ default: () => null }));
vi.mock('@/components/projects/ProjectNearbySection', () => ({ default: () => null }));
vi.mock('@/components/projects/ProjectPortalNav', () => ({ default: () => null }));
import ProjectLandingPage, { generateMetadata } from './[slug]/page';
import ProjectCategoryPage from './[slug]/categories/[categoryKey]/page';

describe('rendered project category property counts', () => {
  it.each([[1, 'объект'], [2, 'объекта'], [3, 'объекта'], [5, 'объектов'], [6, 'объектов'], [15, 'объектов']] as const)('renders %s on both public category surfaces', async (count, noun) => {
    state.count = count;
    const project = renderToStaticMarkup(await ProjectLandingPage({ params: { slug: 'synthetic-project' } }));
    const category = renderToStaticMarkup(await ProjectCategoryPage({ params: { slug: 'synthetic-project', categoryKey: 'synthetic' } }));
    expect(project).toContain(`>${count} ${noun}<`);
    expect(project).toContain('/projects/synthetic-project/categories/synthetic?');
    expect(category).toContain(`>${count} ${noun}<`);
    expect(category).toContain('Synthetic category');
  });
});


describe('project read scheduling', () => {
  it('starts services and batched category copy while labels are still pending', async () => {
    let release!: () => void;
    state.labelsGate = new Promise<void>(resolve => { release = resolve; });
    state.services.mockClear(); state.batchCopy.mockClear(); state.singleCopy.mockClear();
    const pending = ProjectLandingPage({ params: { slug: 'synthetic-project' } });
    try {
      await vi.waitFor(() => expect(state.services).toHaveBeenCalledTimes(1));
      expect(state.batchCopy).toHaveBeenCalledWith({}, expect.arrayContaining([
        'catalog.unit_categories.synthetic.label',
      ]), 'ru');
      expect(state.singleCopy).not.toHaveBeenCalledWith({}, 'catalog.unit_categories.synthetic.label', undefined, 'ru');
    } finally {
      release(); state.labelsGate = null;
      await pending;
    }
  });
});

it('batches optional project copy instead of issuing a fallback query chain per field', async () => {
  state.singleCopy.mockClear(); state.batchCopy.mockClear();
  await ProjectLandingPage({ params: { slug: 'synthetic-project' } });
  expect(state.singleCopy).not.toHaveBeenCalled();
  expect(state.batchCopy).toHaveBeenCalledWith({}, expect.arrayContaining([
    'project.synthetic-project.house_rules',
    'project.synthetic-project.shuttle_schedule',
    'project.synthetic-project.licence',
  ]), 'ru');
});


it('keeps translated project metadata and missing-copy behavior in the batch', async () => {
  state.batchCopy.mockResolvedValueOnce({
    'project.synthetic-project.description': 'Real translated description',
  });
  expect((await generateMetadata({ params: { slug: 'synthetic-project' } })).description).toBe('Real translated description');
  state.batchCopy.mockResolvedValueOnce({ 'project.synthetic-project.description': '—' });
  expect((await generateMetadata({ params: { slug: 'synthetic-project' } })).description).toBeUndefined();
});
