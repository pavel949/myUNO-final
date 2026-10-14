import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BookingModeClient from './booking-mode-client';

const labels = Object.fromEntries(['title', 'instant', 'request', 'instant_hint', 'request_hint',
  'save_unit', 'save_category', 'saved', 'error'].map(key => [`admin.booking_mode.${key}`, key]));
const fetchMock = vi.fn();
const renderMode = () => render(<BookingModeClient unitId="unit-a" instantBook categoryUnits={2} labels={labels} />);

describe('saved per-unit booking mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockImplementation(async (_url, options) => ({ ok: true,
      json: async () => ({ updated: 1, instantBook: JSON.parse(options.body).instantBook }) }));
  });

  it('can save request mode and then save the original instant mode without a reload', async () => {
    renderMode();
    expect(screen.getByRole('button', { name: 'save_unit' })).toBeDisabled();
    fireEvent.click(screen.getByRole('radio', { name: 'request' }));
    fireEvent.click(screen.getByRole('button', { name: 'save_unit' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('saved'));
    expect(screen.getByRole('button', { name: 'save_unit' })).toBeDisabled();
    fireEvent.click(screen.getByRole('radio', { name: 'instant' }));
    expect(screen.getByRole('button', { name: 'save_unit' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'save_unit' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls.map(([, options]) => JSON.parse(options.body))).toEqual([
      { instantBook: false, scope: 'unit' }, { instantBook: true, scope: 'unit' },
    ]);
  });

  it('restores retry after a network error without pretending the mode was saved', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    renderMode();
    fireEvent.click(screen.getByRole('radio', { name: 'request' }));
    fireEvent.click(screen.getByRole('button', { name: 'save_unit' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('error');
    expect(screen.getByRole('button', { name: 'save_unit' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'save_unit' }));
    expect(await screen.findByRole('status')).toHaveTextContent('saved');
  });

  it('does not allow the selected mode to change during an in-flight save', async () => {
    let finish!: (result: unknown) => void;
    fetchMock.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    renderMode();
    fireEvent.click(screen.getByRole('radio', { name: 'request' }));
    fireEvent.click(screen.getByRole('button', { name: 'save_unit' }));
    expect(screen.getByRole('radio', { name: 'instant' })).toBeDisabled();
    await act(async () => finish({ ok: true, json: async () => ({ instantBook: false, updated: 1 }) }));
    expect(screen.getByRole('radio', { name: 'request' })).toHaveAttribute('aria-checked', 'true');
  });
});
