// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const push = vi.fn();
const params = new URLSearchParams({
  startDate: '2026-11-10',
  endDate: '2026-11-14',
  adults: '2',
  children: '0',
  projectId: 'project-1',
  inventoryCategoryId: 'cat-uuid-1',
});
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => params,
}));
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [k: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}));
vi.mock('next/image', () => ({ default: () => null }));
vi.mock('@/components/SearchBar', () => ({ SearchBar: () => null }));
vi.mock('@/components/search/SearchResultsMap', () => ({ SearchResultsMap: () => null }));

import SearchResults from './search-results';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

/**
 * Audit P0 #2: the category card's "Book" sent the legacy categoryKey, which
 * the review page cannot quote — the guest landed on a page with no price and
 * a Confirm button that never enabled. The card must hand over the canonical
 * InventoryCategory id the search API already returns.
 */
describe('SearchResults — category booking uses the canonical id', () => {
  it('retries a failed request without changing the search context', async () => {
    let unitCalls = 0;
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (String(url).includes('groupBy=category')) return { ok: true, json: async () => ({ categories: [] }) } as Response;
      unitCalls++;
      return unitCalls === 1
        ? { ok: false, json: async () => ({}) } as Response
        : { ok: true, json: async () => ({ units: [], mapProjects: [], total: 0 }) } as Response;
    }));
    const labels = new Proxy({}, { get: (_t, key) => String(key) });
    render(<SearchResults labels={labels as never} sortOptions={[{ key: 'recommended', label: 'Recommended' }]} typeOptions={[]} />);
    expect(await screen.findByRole('alert')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'retry' }));
    await waitFor(() => expect(unitCalls).toBe(2));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    const request = new URL(String(vi.mocked(fetch).mock.calls[1][0]), 'https://example.test');
    expect(request.searchParams.get('inventoryCategoryId')).toBe('cat-uuid-1');
    expect(request.searchParams.get('startDate')).toBe('2026-11-10');
  });

  it('routes "book category" to the review page with inventoryCategoryId, not categoryKey', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const body = String(url).includes('groupBy=category')
        ? { categories: [{ inventory_category_id: 'cat-uuid-1', category_key: 'standard_2br', label: 'Standard 2BR', available_count: 3, from_nightly_thb: 547900 }] }
        : { units: [], mapProjects: [], total: 0 };
      return { ok: true, json: async () => body } as Response;
    }));

    const labels = new Proxy({}, { get: (_t, key) => (key === 'categoryBook' ? 'Book category' : String(key)) });
    render(<SearchResults labels={labels as never} sortOptions={[{ key: 'recommended', label: 'Recommended' }]} typeOptions={[]} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Book category' }));
    await waitFor(() => expect(push).toHaveBeenCalled());
    const target = new URL(push.mock.calls[0][0], 'http://localhost');
    expect(target.pathname).toBe('/book/review');
    expect(target.searchParams.get('inventoryCategoryId')).toBe('cat-uuid-1');
    expect(target.searchParams.get('categoryKey')).toBeNull();
    const requests = vi.mocked(fetch).mock.calls.map(([url]) => new URL(String(url), 'https://example.test'));
    expect(requests.every(url => url.searchParams.get('inventoryCategoryId') === 'cat-uuid-1')).toBe(true);
  });
});
