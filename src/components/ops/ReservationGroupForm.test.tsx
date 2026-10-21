import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ReservationGroupForm from './ReservationGroupForm';

const mocks = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
const labels = {
  'reservations.group_title': 'Group title', 'reservations.guest': 'Guest',
  'reservations.note': 'Notes', 'reservations.create_group': 'Create group',
  'reservations.creating': 'Creating…', 'reservations.group_failed': 'Group creation failed',
};
function setup() {
  const { container } = render(<ReservationGroupForm operatingSpaceId="space"
    guests={[{ id: 'guest', firstName: 'Test', lastName: 'Guest', email: null }]} labels={labels} />);
  fireEvent.change(screen.getByPlaceholderText('Group title'), { target: { value: 'Family stay' } });
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'guest' } });
  fireEvent.change(screen.getByPlaceholderText('Notes'), { target: { value: 'Keep this draft' } });
  return container.querySelector('form')!;
}
beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe('reservation group submission recovery', () => {
  it('captures the form across an asynchronous success and suppresses repeated pending submissions', async () => {
    let resolve!: (response: { ok: boolean; json: () => Promise<unknown> }) => void;
    const fetchMock = vi.fn().mockReturnValue(new Promise(done => { resolve = done; }));
    vi.stubGlobal('fetch', fetchMock);
    const form = setup();
    act(() => { fireEvent.submit(form); fireEvent.submit(form); });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Creating…' })).toBeDisabled();
    await act(async () => resolve({ ok: true, json: async () => ({ group: { id: 'saved-group' } }) }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Create group' })).toBeEnabled());
    expect(screen.getByPlaceholderText('Group title')).toHaveValue('');
    expect(screen.getByRole('combobox')).toHaveValue('');
    expect(screen.getByPlaceholderText('Notes')).toHaveValue('');
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      operatingSpaceId: 'space', guestIdentityId: 'guest', title: 'Family stay', notes: 'Keep this draft',
    });
  });

  it.each(['network', 'invalid-json', 'missing-group', 'refused'] as const)
    ('preserves the draft and permits retry after %s', async failure => {
      const fetchMock = vi.fn();
      if (failure === 'network') fetchMock.mockRejectedValueOnce(new Error('Offline'));
      else if (failure === 'invalid-json') fetchMock.mockResolvedValueOnce({ ok: true, json: async () => { throw new Error('Invalid JSON'); } });
      else fetchMock.mockResolvedValueOnce({ ok: failure !== 'refused', json: async () => failure === 'refused' ? { error: 'Forbidden scope' } : {} });
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ group: { id: 'retry-group' } }) });
      vi.stubGlobal('fetch', fetchMock);
      const form = setup();
      fireEvent.submit(form);
      expect(await screen.findByRole('alert')).toHaveTextContent(failure === 'refused' ? 'Forbidden scope' : 'Group creation failed');
      expect(screen.getByRole('button', { name: 'Create group' })).toBeEnabled();
      expect(screen.getByPlaceholderText('Group title')).toHaveValue('Family stay');
      expect(screen.getByPlaceholderText('Notes')).toHaveValue('Keep this draft');
      expect(mocks.refresh).not.toHaveBeenCalled();
      fireEvent.submit(form);
      await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
});
