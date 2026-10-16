import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TariffEditorClient from './tariff-editor-client';

const labels = Object.fromEntries(['loading', 'load_error', 'save_unit', 'save_category', 'save_error', 'saved', 'rate_night'].map(key => ['admin.tariff_editor.' + key, key]));
const draft = { includesTaxes: true, includesServiceCharge: true, includesBreakfast: false,
  daily: [{ seasonCode: 'ALL', windows: [{ start: '01-01', end: '12-31' }], amountSatang: 600000, minimumNights: 1 }], monthly: [], yearly: null };
const response = (body: unknown, ok = true) => ({ ok, json: async () => body });
const revision = 'a'.repeat(64);
const load = () => response({ draft, categoryUnits: 2, unitRevision: revision, categoryRevision: revision });
afterEach(() => { vi.unstubAllGlobals(); });

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
      .mockResolvedValueOnce(response({ saved: 1, revision }));
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


it('previews the base-date replacement and saves only the explicitly applied draft', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(load()).mockResolvedValueOnce(response({ saved: 1, revision }));
  vi.stubGlobal('fetch', fetch);
  render(<TariffEditorClient unitId="unit" labels={labels} />);
  await screen.findByRole('button', { name: 'save_unit' });
  fireEvent.click(screen.getAllByRole('button', { name: 'add_season' })[0]);
  fireEvent.change(screen.getAllByLabelText('season')[1], { target: { value: 'HOLIDAY' } });
  fireEvent.change(screen.getAllByLabelText('from')[1], { target: { value: '12-20' } });
  fireEvent.change(screen.getAllByLabelText('to')[1], { target: { value: '01-10' } });
  fireEvent.change(screen.getAllByLabelText('rate_night')[1], { target: { value: '2345.67' } });
  fireEvent.click(screen.getAllByRole('button', { name: 'remaining_dates' })[0]);
  expect(screen.getByRole('region', { name: 'remaining_preview' })).toHaveTextContent('01-11 – 12-19');
  expect(screen.getByRole('button', { name: 'save_unit' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'cancel_dates' }));
  expect(screen.getAllByLabelText('from')[0]).toHaveValue('01-01');
  fireEvent.click(screen.getAllByRole('button', { name: 'remaining_dates' })[0]);
  fireEvent.click(screen.getByRole('button', { name: 'apply_dates' }));
  expect(screen.getAllByLabelText('from')[0]).toHaveValue('01-11');
  fireEvent.click(screen.getByRole('button', { name: 'save_unit' }));
  await screen.findByRole('status');
  const saved = JSON.parse(fetch.mock.calls[1][1].body).draft;
  expect(saved.daily[0].windows).toEqual([{ start: '01-11', end: '12-19' }]);
  expect(saved.daily[1]).toMatchObject({ seasonCode: 'HOLIDAY', amountSatang: 234567,
    windows: [{ start: '12-20', end: '01-10' }] });
});

const employeePermissions = { canSave: true, canEditMonthly: false, canEditInclusions: false, canSaveCategory: false, reason: null };
describe('scoped employee controls', () => {
  it('hides category fan-out and locks inclusions and unapproved monthly supply', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ draft, unitRevision: revision, categoryRevision: revision, categoryUnits: 99, permissions: employeePermissions })));
    render(<TariffEditorClient unitId="unit" labels={labels} />);
    expect(await screen.findByRole('button', { name: 'save_unit' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: /save_category/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText('includesTaxes')).toBeDisabled();
    expect(screen.getByLabelText('yearly_enabled')).toBeDisabled();
    expect(screen.getByLabelText('rate_night')).toBeEnabled();
  });
  it('makes missing or unapproved offering setup visible and prevents save', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ draft, unitRevision: revision, categoryRevision: revision, categoryUnits: 1,
      permissions: { ...employeePermissions, canSave: false, reason: 'Administrator setup required' } })));
    render(<TariffEditorClient unitId="unit" labels={labels} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Administrator setup required');
    expect(screen.getByRole('button', { name: 'save_unit' })).toBeDisabled();
  });
  it('keeps the draft after a rejected scope/policy save and shows the actionable reason', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response({ draft, unitRevision: revision, permissions: employeePermissions }))
      .mockResolvedValueOnce(response({ error: 'This season needs an approved booking policy' }, false));
    vi.stubGlobal('fetch', fetcher); render(<TariffEditorClient unitId="unit" labels={labels} />);
    const input = await screen.findByLabelText('rate_night'); fireEvent.change(input, { target: { value: '2500' } });
    fireEvent.click(screen.getByRole('button', { name: 'save_unit' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('This season needs an approved booking policy');
    expect(input).toHaveValue(2500); expect(screen.getByRole('button', { name: 'save_unit' })).toBeEnabled();
  });
});

it('binds the rendered tariff revision and requires an explicit reload after a stale conflict', async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce(load())
    .mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({ error: 'Tariffs changed' }) })
    .mockResolvedValueOnce(response({ draft: { ...draft, daily: [{ ...draft.daily[0], amountSatang: 810000 }] }, unitRevision: 'b'.repeat(64), categoryUnits: 1 }));
  vi.stubGlobal('fetch', fetchMock); render(<TariffEditorClient unitId="unit" labels={labels} />);
  const amount = await screen.findByLabelText('rate_night'); fireEvent.change(amount, { target: { value: '7200' } });
  fireEvent.click(screen.getByRole('button', { name: 'save_unit' }));
  await screen.findByText('Tariffs changed');
  expect(amount).toHaveValue(7200); expect(screen.getByRole('button', { name: 'save_unit' })).toBeDisabled();
  expect(JSON.parse(fetchMock.mock.calls[1][1].body).expectedRevision).toBe(revision);
  fireEvent.click(screen.getByRole('button', { name: 'reload_current' }));
  await waitFor(() => expect(screen.getByLabelText('rate_night')).toHaveValue(8100));
  expect(screen.getByRole('button', { name: 'save_unit' })).toBeEnabled();
});
