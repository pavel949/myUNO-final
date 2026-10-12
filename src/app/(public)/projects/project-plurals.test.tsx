import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ count: 1 }));
vi.mock('@/modules/projects', () => ({ getPublicProjectBySlug: async () => ({
  id: 'synthetic-project', name: 'Synthetic project', slug: 'synthetic-project', address: 'Synthetic address',
  categories: [{ id: 'synthetic-category', key: 'synthetic', name: 'Synthetic category', unitCount: state.count, galleryUrls: [], bedrooms: null, fromNightlyThb: null, monthlyFromThb: null }],
  units: [], amenities: [], nearbyPlaces: [], reviews: { count: 0 }, galleryUrls: [],
}) }));
vi.mock('@/lib/i18n', () => ({ getRequestLocale: () => 'ru', getLabels: async (labels: Record<string, string>) => ({ ...labels,
  'project_page.categories.homes_count': '{count} объектов', 'project_category.available': '{count} объектов',
}) }));
vi.mock('@/modules/content', () => ({ t: async () => '', tMany: async () => ({}) }));
vi.mock('@/lib/prisma', () => ({ prisma: {} }));
vi.mock('@/modules/services', () => ({ listPublicMarketplaceServices: async () => [] }));
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
import ProjectLandingPage from './[slug]/page';
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
