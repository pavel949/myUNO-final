import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import OrderWizard from './order-wizard';
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
const labels = new Proxy({ 'services.wizard.choose_stay': 'Choose stay', 'services.wizard.no_context': 'Open from your stay or message the team', 'services.wizard.place': 'Place {total}', 'services.wizard.quote_messages': 'Message team' }, { get: (target, key) => target[key as keyof typeof target] ?? String(key) }) as Record<string, string>;
const props = { service: { id: 'clean', title: 'Cleaning', priceModel: 'fixed', basePriceThb: 50000 }, bookingId: null, whatsappNumber: null, labels };
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe('service stay context', () => {
  it('requires an explicit choice between multiple future stays', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ bookings: [{ id: 'stay-a', startDate: '2030-01-01', endDate: '2030-01-03', status: 'confirmed', unit: { name: 'Home A' } }, { id: 'stay-b', startDate: '2030-02-01', endDate: '2030-02-03', status: 'confirmed', unit: { name: 'Home B' } }] }) }));
    render(<OrderWizard {...props} />);
    const selector = await screen.findByRole('combobox');
    expect((selector as HTMLSelectElement).value).toBe('');
    expect(screen.getByRole('option', { name: /Home A/ })).toBeTruthy();
    expect(screen.getByRole('option', { name: /Home B/ })).toBeTruthy();
  });
  it('offers a handoff when online order context cannot be established', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ bookings: [] }) }));
    render(<OrderWizard {...props} />);
    expect(await screen.findByText('Open from your stay or message the team')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Message team' }).getAttribute('href')).toBe('/messages');
    expect(screen.queryByRole('button', { name: /Place/ })).toBeNull();
  });
  it('does not fetch an unrelated trip when explicit unit context is supplied', async () => {
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    render(<OrderWizard {...props} projectId="project" unitId="unit" />);
    await waitFor(() => expect(fetchMock).not.toHaveBeenCalled());
  });
});
