import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import UnitsAdminClient from './units-client';
import { UNIT_PUBLICATION_LABELS } from '@/modules/content/unit-publication.seed';

const mocks = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
const row = {
  id: 'villa', name: 'Villa one', categoryName: null, projectName: 'Resort',
  status: 'draft', assetStatus: 'managed', baseNightlyThb: 3500,
  permittedUseConfirmed: true, coverUrl: null, ownerName: 'Owner',
};
const labels = {
  ...UNIT_PUBLICATION_LABELS,
  'admin.units.set_live': 'Publish',
  'admin.units.pause': 'Pause',
  'admin.units.error_generic': 'Action failed',
  'admin.units.asset_status': 'Asset status',
};
const response = (body: unknown, ok = true) => ({ ok, json: async () => body });
beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe('publication action feedback', () => {
  it('confirms the saved status and links to the same unit readiness after refresh', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ id: row.id, status: 'live' }));
    vi.stubGlobal('fetch', fetchMock);
    const { rerender } = render(<UnitsAdminClient units={[row]} labels={labels} />);
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Villa one is set to live');
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/units/villa', expect.objectContaining({
      method: 'PUT', body: JSON.stringify({ status: 'live' }),
    }));
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    rerender(<UnitsAdminClient units={[{ ...row, status: 'live' }]} labels={labels} />);
    expect(screen.getByRole('status')).toHaveTextContent('Review its public visibility and booking readiness');
    expect(screen.getByRole('link', { name: /Review publication and bookings/ }))
      .toHaveAttribute('href', '/app/admin/units/villa');
  });

  it('shows the canonical refusal, never reports success, and permits retry', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ error: 'Readiness requirements are missing' }, false))
      .mockResolvedValueOnce(response({ id: row.id, status: 'live' }));
    vi.stubGlobal('fetch', fetchMock);
    render(<UnitsAdminClient units={[row]} labels={labels} />);
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Readiness requirements are missing');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(mocks.refresh).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Villa one');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it.each([null, {}, { id: 'other', status: 'live' }, { id: 'villa', status: 'draft' }])(
    'does not confirm a malformed or mismatched successful response %j',
    async body => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(body)));
      render(<UnitsAdminClient units={[row]} labels={labels} />);
      fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('Action failed');
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      expect(mocks.refresh).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Publish' })).toBeEnabled();
    },
  );

  it('blocks repeated and cross-row mutations while a request is pending', async () => {
    let resolve!: (value: ReturnType<typeof response>) => void;
    const fetchMock = vi.fn().mockReturnValue(new Promise(done => { resolve = done; }));
    vi.stubGlobal('fetch', fetchMock);
    render(<UnitsAdminClient units={[row, { ...row, id: 'second', name: 'Villa two' }]} labels={labels} />);
    const [first, second] = screen.getAllByRole('button', { name: 'Publish' });
    fireEvent.click(first);
    fireEvent.click(first);
    fireEvent.click(second);
    expect(second).toBeDisabled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => resolve(response({ id: row.id, status: 'live' })));
    await waitFor(() => expect(second).toBeEnabled());
  });

  it('reports pause separately and clears the previous success if the next request fails', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(response({ id: row.id, status: 'paused' }))
      .mockRejectedValueOnce(new Error('Connection lost'));
    vi.stubGlobal('fetch', fetchMock);
    const { rerender } = render(<UnitsAdminClient units={[{ ...row, status: 'live' }]} labels={labels} />);
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Villa one is set to paused.');
    rerender(<UnitsAdminClient units={[{ ...row, status: 'paused' }]} labels={labels} />);
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Connection lost');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publish' })).toBeEnabled();
  });

  it('does not loosen the existing permitted-use gate', () => {
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    render(<UnitsAdminClient units={[{ ...row, permittedUseConfirmed: false }]} labels={labels} />);
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
