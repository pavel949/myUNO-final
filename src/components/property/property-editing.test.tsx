import userEvent from '@testing-library/user-event';
import ManagedSleepingSpaces from './ManagedSleepingSpaces';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ManagedUnitEditor from '@/app/ops/units/[unitId]/edit/managed-unit-editor';
import ProjectFactsForm from '@/app/ops/projects/[id]/edit/project-facts-form';
import ManagedGallery from './ManagedGallery';
import { PROPERTY_EDITOR_DEFAULTS as copy } from '@/modules/content/property-editor.seed';
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
const fetcher = vi.fn();
const unit = {
  id: 'unit',
  name: 'Home',
  bedrooms: 1,
  bathrooms: 1,
  maxGuests: 2,
  floor: '',
  addressSupplement: 'Door',
  sizeSqm: 90,
  grossAreaSqm: 120,
  usableAreaSqm: 80,
  outdoorAreaSqm: null,
  plotAreaSqm: null,
  updatedAt: '2026-10-21T01:00:00.000Z',
};
beforeEach(() => {
  fetcher.mockReset();
  vi.stubGlobal('fetch', fetcher);
});
describe('property edit recovery', () => {
  it('guards synchronous reentry, sends a version and explicit distinct areas', async () => {
    let done!: (value: unknown) => void;
    fetcher.mockReturnValue(new Promise((resolve) => (done = resolve)));
    render(<ManagedUnitEditor unit={unit} copy={copy} />);
    const form = screen.getByRole('button', { name: 'Save changes' }).closest('form')!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({
      expectedUpdatedAt: unit.updatedAt,
      grossAreaSqm: 120,
      usableAreaSqm: 80,
      sizeSqm: 90,
    });
    await act(async () =>
      done({
        ok: true,
        status: 200,
        json: async () => ({ ...unit, updatedAt: '2026-10-21T02:00:00.000Z' }),
      })
    );
  });
  it('keeps edits typed during a save dirty after submitted values commit', async () => {
    let done!: (value: unknown) => void;
    fetcher.mockReturnValue(new Promise((resolve) => (done = resolve)));
    render(<ManagedUnitEditor unit={unit} copy={copy} />);
    fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'Submitted' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Save changes' }).closest('form')!);
    fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'Newer unsaved text' } });
    await act(async () =>
      done({
        ok: true,
        status: 200,
        json: async () => ({ ...unit, updatedAt: '2026-10-21T02:00:00.000Z' }),
      })
    );
    expect(screen.getByLabelText('Name')).toHaveValue('Newer unsaved text');
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    expect(screen.getByRole('status')).toHaveTextContent('Newer edits are not saved yet');
  });
  it('does not discard additional typing when a new room create completes', async () => {
    let done!: (value: unknown) => void;
    fetcher.mockReturnValue(new Promise((resolve) => (done = resolve)));
    const user = userEvent.setup();
    render(<ManagedSleepingSpaces unitId="unit" rooms={[]} copy={copy} />);
    await user.click(screen.getByRole('button', { name: 'Add sleeping space' }));
    const name = screen.getByLabelText('Internal room name (optional)');
    await user.type(name, 'Submitted room');
    await user.clear(screen.getByLabelText('Single bed'));
    await user.type(screen.getByLabelText('Single bed'), '1');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(name).toBeDisabled();
    expect(screen.getByLabelText('Space type')).toBeDisabled();
    expect(screen.getByLabelText('Single bed')).toBeDisabled();
    await user.type(name, ' NEW');
    const lastAcceptedName = (name as HTMLInputElement).value;
    await act(async () =>
      done({
        ok: true,
        status: 201,
        json: async () => ({ id: 'created', updatedAt: unit.updatedAt }),
      })
    );
    expect(screen.getByRole('button', { name: 'Add sleeping space' })).toBeInTheDocument();
    expect(JSON.parse(fetcher.mock.calls[0][1].body).name).toBe(lastAcceptedName);
  });
  it('unlocks the new-room fields after a failed create and retains entered facts', async () => {
    fetcher.mockResolvedValue({ ok: false, status: 500, json: async () => ({ error: 'failure' }) });
    const user = userEvent.setup();
    render(<ManagedSleepingSpaces unitId="unit" rooms={[]} copy={copy} />);
    await user.click(screen.getByRole('button', { name: 'Add sleeping space' }));
    await user.type(screen.getByLabelText('Internal room name (optional)'), 'Retry room');
    await user.clear(screen.getByLabelText('Single bed'));
    await user.type(screen.getByLabelText('Single bed'), '1');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await screen.findByText(/Could not save/);
    expect(screen.getByLabelText('Internal room name (optional)')).toBeEnabled();
    expect(screen.getByLabelText('Internal room name (optional)')).toHaveValue('Retry room');
    expect(screen.getByLabelText('Single bed')).toHaveValue(1);
    expect(screen.queryByRole('button', { name: 'Add sleeping space' })).not.toBeInTheDocument();
  });
  it('retains input on conflict and blocks stale retries until explicit reload', async () => {
    fetcher.mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ code: 'property_edit_conflict' }),
    });
    render(<ManagedUnitEditor unit={unit} copy={copy} />);
    fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'My retained edit' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Save changes' }).closest('form')!);
    await screen.findByText(/This property changed elsewhere/);
    expect(screen.getByLabelText('Name')).toHaveValue('My retained edit');
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Reload current record' })).toBeEnabled();
  });
  it('does not send facilities in the project save contract', async () => {
    fetcher.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ updatedAt: unit.updatedAt }),
    });
    render(
      <ProjectFactsForm
        project={{
          id: 'project',
          name: 'Complex',
          brand: null,
          address: 'Road',
          city: null,
          district: null,
          projectType: null,
          totalUnits: null,
          updatedAt: unit.updatedAt,
        }}
        copy={copy}
      />
    );
    fireEvent.submit(screen.getByRole('button', { name: 'Save changes' }).closest('form')!);
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).not.toHaveProperty('facilities');
  });
  it('protects dirty link navigation and native unload; preserves inputs when cancelled', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(
      <>
        <a href="/elsewhere">Back</a>
        <ManagedUnitEditor unit={unit} copy={copy} />
      </>
    );
    fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'Unsaved' } });
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    screen.getByRole('link', { name: 'Back' }).dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    expect(screen.getByLabelText('Name')).toHaveValue('Unsaved');
    vi.restoreAllMocks();
  });
  it('refreshes partial upload results after failure rather than hiding saved photos', async () => {
    const photo = { mediaId: 'saved', sort: 0, media: { storageKey: '/photo.png' } };
    fetcher
      .mockResolvedValueOnce({ ok: true, json: async () => ({ media: [], coverMediaId: null }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ mediaAssetId: 'saved' }) })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'failure' }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ media: [photo], coverMediaId: 'saved' }),
      });
    render(<ManagedGallery scope="unit" id="unit" copy={copy} />);
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByLabelText('Upload photos'), {
      target: {
        files: [
          new File(['a'], 'a.png', { type: 'image/png' }),
          new File(['b'], 'b.png', { type: 'image/png' }),
        ],
      },
    });
    await screen.findByRole('alert');
    expect(screen.getByRole('img', { name: 'Property photo 1' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('retry only missing photos');
  });
});
