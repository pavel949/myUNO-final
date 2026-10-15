import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { SimilarAvailableHomes, alternativeSearchQuery } from './SimilarAvailableHomes';
import { guestSearchDefaults } from '@/modules/content/guest-search-ux.seed';
let selection = 'startDate=2026-11-01&endDate=2026-11-04&adults=2&children=1&projectId=p&inventoryCategoryId=c';
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(selection) }));
vi.mock('./PropertyImage', () => ({ PropertyImage: () => <div /> }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('available home alternatives', () => {
  it('retains explicit budget, amenities and stay while removing current property/category scope', () => {
    const query = alternativeSearchQuery(new URLSearchParams(selection + '&maxPrice=10000&amenities=wifi'), 3000);
    expect(Object.fromEntries(query)).toMatchObject({ startDate: '2026-11-01', endDate: '2026-11-04', adultsCount: '2', childrenCount: '1', maxPrice: '10000', amenities: 'wifi' });
    expect(query.has('projectId')).toBe(false); expect(query.has('inventoryCategoryId')).toBe(false);
    expect(query.has('minPrice')).toBe(false);
  });
  it('uses the quoted nightly baht to derive a comparable budget only when no price filters exist', () => {
    expect(Object.fromEntries(alternativeSearchQuery(new URLSearchParams(selection), 4000))).toMatchObject({ minPrice: '2800', maxPrice: '5200' });
    expect(alternativeSearchQuery(new URLSearchParams(selection), null).has('maxPrice')).toBe(false);
  });
  it('shows only other quoted homes that fit the party, formats satang once and keeps dates in links', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ units: [
      { id: 'current', name: 'Current', maxGuests: 4, pricing: { stayTotalThb: 900000 } },
      { id: 'small', name: 'Too small', maxGuests: 2, pricing: { stayTotalThb: 900000 } },
      { id: 'unquoted', name: 'No quote', maxGuests: 4, pricing: { stayTotalThb: null } },
      { id: 'other', name: 'Available villa', maxGuests: 4, pricing: { stayTotalThb: 900000 } },
    ] }) }));
    render(<SimilarAvailableHomes unitId="current" nightlyBaht={3000} copy={guestSearchDefaults('en')} photoLabel="Photos" />);
    const link = await screen.findByRole('link', { name: /Available villa/ });
    expect(link.getAttribute('href')).toContain('startDate=2026-11-01');
    expect(link.getAttribute('href')).not.toContain('projectId=');
    expect(screen.getByText(/฿9,000/)).toBeTruthy();
    expect(screen.queryByText('Too small')).toBeNull(); expect(screen.queryByText('No quote')).toBeNull();
  });
  it('distinguishes failed availability lookup from no alternatives and allows retry', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce({ ok: true, json: async () => ({ units: [] }) });
    vi.stubGlobal('fetch', fetcher);
    render(<SimilarAvailableHomes unitId="current" copy={guestSearchDefaults('en')} photoLabel="Photos" />);
    const retry = await screen.findByRole('button', { name: 'Try again' });
    retry.click();
    await waitFor(() => expect(screen.getByText('No available alternatives match this selection.')).toBeTruthy());
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
