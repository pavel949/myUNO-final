import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import TripsList from './trips-list';
const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
const labels = new Proxy({ 'booking.trips.load_more': 'More trips', 'booking.trips.fetch_error': 'Could not load trips', 'booking.trips.retry': 'Retry' }, { get: (target, key) => target[key as keyof typeof target] ?? String(key) }) as Record<string, string>;
const trip = (id: string) => ({ id, status: 'confirmed', startDate: '2030-01-01', endDate: '2030-01-03', totalThb: 500, unit: { id, name: `Home ${id}` }, project: { id: 'project', name: 'Project' } });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe('trip history pagination', () => {
  it('loads the next API page while keeping existing trips', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ bookings: [trip('one')], total: 2 }) }).mockResolvedValueOnce({ ok: true, json: async () => ({ bookings: [trip('two')], total: 2 }) });
    vi.stubGlobal('fetch', fetchMock);
    render(<TripsList labels={labels} />);
    await screen.findByText('Home one');
    fireEvent.click(screen.getByRole('button', { name: 'More trips' }));
    expect(await screen.findByText('Home two')).toBeTruthy();
    expect(screen.getByText('Home one')).toBeTruthy();
    expect(fetchMock.mock.calls[1][0]).toBe('/api/bookings/me?limit=50&offset=1');
    expect(screen.queryByRole('button', { name: 'More trips' })).toBeNull();
  });
  it('keeps existing trips and exposes retry if the next page fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ bookings: [trip('one')], total: 2 }) }).mockRejectedValueOnce(new Error('Network failure')));
    render(<TripsList labels={labels} />);
    await screen.findByText('Home one');
    fireEvent.click(screen.getByRole('button', { name: 'More trips' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy());
    expect(screen.getByText('Home one')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toBe('Could not load trips');
  });
});
