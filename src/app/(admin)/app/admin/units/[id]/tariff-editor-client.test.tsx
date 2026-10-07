import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TariffEditorClient from './tariff-editor-client';

const labels = Object.fromEntries(['loading', 'load_error', 'save_unit', 'save_category', 'save_error', 'saved', 'rate_night'].map(key => ['admin.tariff_editor.' + key, key]));
const draft = { includesTaxes: true, includesServiceCharge: true, includesBreakfast: false,
  daily: [{ seasonCode: 'ALL', windows: [{ start: '01-01', end: '12-31' }], amountSatang: 600000, minimumNights: 1 }], monthly: [], yearly: null };
const response = (body: unknown, ok = true) => ({ ok, json: async () => body });
const load = () => response({ draft, categoryUnits: 2 });
afterEach(() => vi.unstubAllGlobals());

describe('tariff editor failure recovery', () => {
  it('shows a load error rather than loading forever after an HTTP failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ error: 'forbidden' }, false)));
    render(<TariffEditorClient unitId="unit" labels={labels} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('load_error');
    expect(screen.queryByText('loading')).not.toBeInTheDocument();
  });
  it('handles a malformed successful load response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({})));
    render(<TariffEditorClient unitId="unit" labels={labels} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('load_error');
  });
  it('preserves edited amounts and allows retry after network failure', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(load()).mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(response({ saved: 1 }));
    vi.stubGlobal('fetch', fetchMock);
    render(<TariffEditorClient unitId="unit" labels={labels} />);
    const save = await screen.findByRole('button', { name: 'save_unit' });
    fireEvent.change(screen.getByLabelText('rate_night'), { target: { value: '7200' } });
    fireEvent.click(save);
    expect(await screen.findByRole('alert')).toHaveTextContent('save_error');
    expect(save).toBeEnabled();
    expect(screen.getByLabelText('rate_night')).toHaveValue(7200);
    fireEvent.click(save);
    expect(await screen.findByRole('status')).toHaveTextContent('saved');
    expect(JSON.parse(fetchMock.mock.calls[2][1].body).draft.daily[0].amountSatang).toBe(720000);
  });
  it('reports invalid save responses and restores controls', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(load()).mockResolvedValueOnce(response({})));
    render(<TariffEditorClient unitId="unit" labels={labels} />);
    const save = await screen.findByRole('button', { name: 'save_unit' });
    fireEvent.click(save);
    expect(await screen.findByRole('alert')).toHaveTextContent('save_error');
    expect(save).toBeEnabled();
  });
  it('aborts the previous load when switching units', async () => {
    const fetchMock = vi.fn().mockImplementation(() => new Promise(() => {}));
    vi.stubGlobal('fetch', fetchMock);
    const { rerender } = render(<TariffEditorClient unitId="old" labels={labels} />);
    rerender(<TariffEditorClient unitId="new" labels={labels} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
    expect(fetchMock.mock.calls[1][1].signal.aborted).toBe(false);
  });
});
