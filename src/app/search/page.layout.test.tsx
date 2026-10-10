import React from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  params: new URLSearchParams(),
  discover: vi.fn(),
  router: { push: vi.fn(), replace: vi.fn() },
}));
vi.mock('next/navigation', () => ({
  useRouter: () => state.router,
  useSearchParams: () => state.params,
}));
vi.mock('@/lib/i18n', () => ({
  getRequestLocale: () => 'en',
  getLabels: async (defaults: Record<string, string>) => defaults,
}));
vi.mock('@/modules/browse', () => ({
  UNIT_SORTS: [{ key: 'recommended', labelKey: 'search.sort.recommended' }],
}));
vi.mock('@/modules/projects/public-discovery', () => ({
  listPublicDiscoveryUnits: state.discover,
}));
vi.mock('@/components/DiscoveryHomes', () => ({
  discoveryCopy: async () => ({ retry: 'Try again' }),
  default: ({ units, context }: { units: { id: string; name: string }[]; context: string }) => (
    <section aria-label="Discover homes" data-context={context}>
      {units.map((unit) => <p key={unit.id}>{unit.name}</p>)}
    </section>
  ),
}));
vi.mock('@/components/SearchBar', () => ({
  SearchBar: () => <form aria-label="Stay search" />,
}));
vi.mock('@/components/search/SearchResultsMap', () => ({ SearchResultsMap: () => null }));

import SearchPage from './page';

beforeEach(() => {
  state.params = new URLSearchParams();
  state.discover.mockReset().mockResolvedValue([{ id: 'unit-1', name: 'Discovery home' }]);
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    json: async () => ({ units: [], mapProjects: [], total: 0 }),
  })));
});
afterEach(() => { vi.unstubAllGlobals(); });

// DOM composition/class regression only: jsdom does not certify rendered geometry.
describe('search page discovery composition', () => {
  it.each(['', 'startDate=2026-11-10', 'endDate=2026-11-14'])(
    'keeps the search section content-height before discovery without a complete date range (%s)',
    async (dates) => {
      state.params = new URLSearchParams(dates);
      state.params.set('projectId', 'project-1');
      const { container } = render(await SearchPage({ searchParams: Object.fromEntries(state.params) }));
      const searchSection = container.firstElementChild;
      const discovery = screen.getByRole('region', { name: 'Discover homes' });

      expect(searchSection).toContainElement(screen.getByRole('form', { name: 'Stay search' }));
      expect(searchSection).not.toHaveClass('stitch-workspace');
      expect(searchSection).not.toHaveClass('min-h-screen');
      expect(searchSection).toHaveClass('bg-surface-mint', 'text-text-ink');
      expect(searchSection?.nextElementSibling).toBe(discovery);
      expect(discovery).toHaveTextContent('Discovery home');
      expect(discovery).toHaveAttribute('data-context', state.params.toString());
      expect(state.discover).toHaveBeenCalledWith(expect.objectContaining({ projectId: 'project-1' }));
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it('preserves the full-page workspace for dated results without a discovery sibling', async () => {
    state.params = new URLSearchParams('startDate=2026-11-10&endDate=2026-11-14');
    const { container } = render(await SearchPage({ searchParams: Object.fromEntries(state.params) }));

    expect(container.firstElementChild).toHaveClass('stitch-workspace');
    expect(screen.queryByRole('region', { name: 'Discover homes' })).toBeNull();
    expect(state.discover).not.toHaveBeenCalled();
    expect(await screen.findByText('No homes are available for these dates.')).toBeInTheDocument();
  });
});
