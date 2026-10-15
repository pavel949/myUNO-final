import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import OrderWizard from './order-wizard';
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
const labels = new Proxy({ 'services.wizard.choose_stay': 'Choose stay', 'services.wizard.no_context': 'Open from your stay or message the team', 'services.wizard.place': 'Place {total}', 'services.wizard.quote_messages': 'Message team', 'services.wizard.when': 'Service time', 'services.standalone.area': 'Area', 'services.standalone.address': 'Address', 'services.standalone.recipient': 'Recipient', 'services.standalone.phone': 'Phone', 'services.standalone.responsibility': 'Responsible: {organization}', 'services.standalone.cancellation': 'Cancel before {hours}h' }, { get: (target, key) => target[key as keyof typeof target] ?? String(key) }) as Record<string, string>;
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
  it('reuses the creation key after a network failure and blocks same-tick repeated clicks', async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error('Network failed')).mockResolvedValue({ ok: true, json: async () => ({ order: { id: 'created' } }) });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('crypto', { randomUUID: () => 'd399bb9c-0ccc-49ae-9ea3-6cfe3768e80a' });
    render(<OrderWizard {...props} bookingId="stay" />);
    fireEvent.change(screen.getByLabelText(/Service time/), { target: { value: '2030-01-01T12:00' } });
    const place = screen.getByRole('button', { name: 'Place 500' });
    fireEvent.click(place); fireEvent.click(place);
    expect(await screen.findByText('Network failed')).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Place 500' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const first = JSON.parse(fetchMock.mock.calls[0][1].body);
    const second = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(first.requestKey).toBe(second.requestKey);
    expect(first.scheduledStart).toBe('2030-01-01T05:00:00.000Z');
  });

  it('places a configured standalone order from recipient and address fields without a fake booking', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => url.startsWith('/api/bookings/me') ? { ok: true, json: async () => ({ bookings: [] }) } : { ok: true, json: async () => ({ order: { id: 'standalone-order' } }) });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('crypto', { randomUUID: () => 'd399bb9c-0ccc-49ae-9ea3-6cfe3768e80a' });
    render(<OrderWizard {...props} standalone={{ destinationKey: 'phuket', responsibleOrganizationName: 'Real Organization', cancellationWindowHours: 24, areas: [{ key: 'bang-tao', label: 'Bang Tao' }] }} />);
    fireEvent.change(await screen.findByLabelText('Area'), { target: { value: 'bang-tao' } });
    fireEvent.change(screen.getByLabelText('Address'), { target: { value: '10 Example Road, Phuket' } });
    fireEvent.change(screen.getByLabelText('Recipient'), { target: { value: 'Test Guest' } });
    fireEvent.change(screen.getByLabelText('Phone'), { target: { value: '+66000000000' } });
    fireEvent.change(screen.getByLabelText(/Service time/), { target: { value: '2030-01-01T12:00' } });
    expect(screen.getByText('Responsible: Real Organization')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Place 500' }));
    await waitFor(() => expect(fetchMock.mock.calls.some(call => call[0] === '/api/service-orders')).toBe(true));
    const payload = JSON.parse(fetchMock.mock.calls.find(call => call[0] === '/api/service-orders')![1].body);
    expect(payload.serviceContext).toEqual({ kind: 'standalone', destinationKey: 'phuket', areaKey: 'bang-tao', address: '10 Example Road, Phuket', recipientName: 'Test Guest', recipientPhone: '+66000000000' });
    expect(payload.bookingId).toBeUndefined(); expect(payload.projectId).toBeUndefined();
    expect(payload.requestKey).toBeTruthy();
  });

});
