import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BookingModeClient from './booking-mode-client';
import { PROPERTY_BOOKING_MODE_LABELS } from '@/modules/content/property-booking-mode.seed';
const labels = { ...PROPERTY_BOOKING_MODE_LABELS, ...Object.fromEntries(['title', 'instant', 'request', 'instant_hint', 'request_hint', 'error'].map(key => [`admin.booking_mode.${key}`, key])) };
const fetchMock = vi.fn();
const preview = (mode: boolean, scope = 'unit') => ({ scope, instantBook: mode, baseline: 'a'.repeat(64),
  units: [{ id: 'unit-a', name: 'Assigned unit A', instantBook: !mode }], blocked: [] });
const response = (data: unknown, status = 200) => ({ ok: status < 400, status, json: async () => data });
const show = () => render(<BookingModeClient unitId="unit-a" instantBook categoryUnits={2} labels={labels} />);
const inspect = () => fireEvent.click(screen.getByRole('button', { name: 'Preview this unit' }));
const approve = async () => { fireEvent.click(await screen.findByRole('checkbox')); fireEvent.click(screen.getByRole('button', { name: 'Apply reviewed change' })); };
beforeEach(() => {
  vi.clearAllMocks(); vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockImplementation(async (_url, options) => {
    const body = JSON.parse(options.body);
    return response(options.method === 'POST' ? preview(body.instantBook, body.scope) : { updated: 1, instantBook: body.instantBook });
  });
});
describe('reviewed per-unit booking mode', () => {
  it('requires a real target preview and explicit confirmation before writing', async () => {
    show(); expect(screen.getByRole('button', { name: 'Preview this unit' })).toBeDisabled();
    fireEvent.click(screen.getByRole('radio', { name: 'request' })); inspect();
    expect(await screen.findByText(/Assigned unit A/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Apply reviewed change' })).toBeDisabled();
    expect(fetchMock.mock.calls[0][1].method).toBe('POST'); await approve();
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Saved for 1 unit'));
    expect(fetchMock.mock.calls[1][1].method).toBe('PUT');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({ instantBook: false, scope: 'unit', baseline: 'a'.repeat(64), requestId: expect.any(String) });
    expect(screen.getByRole('button', { name: 'Preview this unit' })).toBeDisabled();
  });
  it('can change back to instant booking after the first save without reloading', async () => {
    show(); fireEvent.click(screen.getByRole('radio', { name: 'request' })); inspect(); await approve();
    await screen.findByText(/Saved for 1 unit/);
    fireEvent.click(screen.getByRole('radio', { name: 'instant' })); inspect(); await approve();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
    expect(fetchMock.mock.calls.filter(([, options]) => options.method === 'PUT').map(([, options]) => JSON.parse(options.body).instantBook)).toEqual([false, true]);
  });
  it('retains the same request ID on an uncertain apply retry', async () => {
    let failed = false;
    fetchMock.mockImplementation(async (_url, options) => {
      const body = JSON.parse(options.body); if (options.method === 'POST') return response(preview(body.instantBook));
      if (!failed) { failed = true; throw new Error('offline'); }
      return response({ updated: 1, instantBook: body.instantBook, alreadyApplied: true });
    });
    show(); fireEvent.click(screen.getByRole('radio', { name: 'request' })); inspect(); await approve();
    expect(await screen.findByRole('alert')).toHaveTextContent('offline');
    fireEvent.click(screen.getByRole('button', { name: 'Apply reviewed change' }));
    await screen.findByText(/Saved for 1 unit/);
    const writes = fetchMock.mock.calls.filter(([, options]) => options.method === 'PUT').map(([, options]) => JSON.parse(options.body));
    expect(writes).toHaveLength(2); expect(writes[0]).toEqual(writes[1]);
  });
  it('forces a new preview after a conflict or revocation', async () => {
    fetchMock.mockImplementation(async (_url, options) => response(options.method === 'POST' ? preview(false) : { error: 'Preview changed' }, options.method === 'POST' ? 200 : 409));
    show(); fireEvent.click(screen.getByRole('radio', { name: 'request' })); inspect(); await approve();
    expect(await screen.findByRole('alert')).toHaveTextContent('Preview changed');
    expect(screen.queryByRole('button', { name: 'Apply reviewed change' })).not.toBeInTheDocument();
  });
  it('cannot enable instant mode when server readiness is incomplete', async () => {
    fetchMock.mockResolvedValue(response({ ...preview(true), blocked: [{ unitId: 'unit-a', name: 'Assigned unit A', codes: ['unit.source_authority'] }] }));
    show(); fireEvent.click(screen.getByRole('button', { name: 'Preview category (2 units)' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Instant booking cannot be enabled');
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument(); expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('clears stale confirmation when selected mode changes', async () => {
    show(); fireEvent.click(screen.getByRole('radio', { name: 'request' })); inspect();
    fireEvent.click(await screen.findByRole('checkbox')); fireEvent.click(screen.getByRole('radio', { name: 'instant' }));
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Apply reviewed change' })).not.toBeInTheDocument();
  });
  it('disables mode switching during an in-flight request', async () => {
    let finish!: (value: unknown) => void; fetchMock.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    show(); fireEvent.click(screen.getByRole('radio', { name: 'request' })); inspect();
    expect(screen.getByRole('radio', { name: 'instant' })).toBeDisabled();
    await act(async () => finish(response(preview(false))));
    expect(screen.getByRole('radio', { name: 'request' })).toHaveAttribute('aria-checked', 'true');
  });
});
