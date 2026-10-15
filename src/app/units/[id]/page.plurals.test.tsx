import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ locale: 'ru', bedrooms: 1, guests: 1 }));
vi.mock('@/modules/config', () => ({ getConfig: vi.fn() }));
vi.mock('@/modules/projects', () => ({ getPublicUnitById: vi.fn(async () => null) }));
vi.mock('@/modules/projects/public-discovery', () => ({ listPublicDiscoveryUnits: vi.fn(async () => [{
  id: 'synthetic-unit', name: 'Synthetic home', project: { id: 'synthetic-project', name: 'Synthetic project', slug: 'synthetic-project' },
  descriptionKey: null, bedrooms: state.bedrooms, maxGuests: state.guests, sizeSqm: 38, galleryUrls: [], sleepingSpaces: [],
}]) }));
vi.mock('@/lib/i18n', () => ({ getRequestLocale: () => state.locale, getLabels: async (labels: Record<string, string>) => labels }));
vi.mock('@/components/DiscoveryHomes', () => ({ discoveryCopy: async () => ({
  bedrooms: state.locale === 'ru' ? 'спальни' : 'bedrooms', guests: state.locale === 'ru' ? 'гостей' : 'guests',
  project: 'Project', photos: 'Photos pending', pending: 'Inquiry only', ask: 'Ask about this home',
}) }));
vi.mock('@/modules/analytics', () => ({ track: vi.fn(async () => undefined) }));
vi.mock('@/modules/destinations', () => ({ getDestination: () => ({ key: 'synthetic' }) }));
vi.mock('@/lib/prisma', () => ({ prisma: {} }));
vi.mock('@/modules/content', () => ({ t: vi.fn() }));
vi.mock('@/components/UnitPhotoMosaic', () => ({ UnitPhotoMosaic: () => null }));
vi.mock('@/components/units/PublicSleepingSummary', () => ({ PublicSleepingSummary: () => null }));
vi.mock('@/app/(public)/lead-form-section', () => ({ LeadFormSection: () => null }));
vi.mock('./unit-client', () => ({ default: () => null }));
import UnitDetailPage from './page';

describe('rendered inquiry-only unit detail counts', () => {
  beforeEach(() => { state.locale = 'ru'; state.bedrooms = 1; state.guests = 1; });
  it.each([[1, 'спальня', 'гость'], [2, 'спальни', 'гостя'], [5, 'спален', 'гостей']] as const)(
    'inflects the actual detail facts for %s without changing inquiry links or size', async (count, bedrooms, guests) => {
      state.bedrooms = count; state.guests = count;
      const html = renderToStaticMarkup(await UnitDetailPage({ params: { id: 'synthetic-unit' } }));
      expect(html).toContain(`${count} ${bedrooms} · ${count} ${guests} · 38 m²`);
      expect(html).toContain('href="/projects/synthetic-project#homes"');
      expect(html).toContain('Inquiry only');
    },
  );
  it('preserves non-Russian editorial nouns', async () => {
    state.locale = 'en';
    const html = renderToStaticMarkup(await UnitDetailPage({ params: { id: 'synthetic-unit' } }));
    expect(html).toContain('1 bedrooms · 1 guests · 38 m²');
  });
  it('keeps absent zero-valued facts hidden', async () => {
    state.bedrooms = 0; state.guests = 0;
    const html = renderToStaticMarkup(await UnitDetailPage({ params: { id: 'synthetic-unit' } }));
    expect(html).toContain('<p>38 m²</p>');
    expect(html).not.toContain('0 спаль');
  });
});
