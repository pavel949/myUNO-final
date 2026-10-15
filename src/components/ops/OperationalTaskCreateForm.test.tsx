import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import OperationalTaskCreateForm from './OperationalTaskCreateForm';

const mocks = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
const labels = {
  'staff.task_form.title': 'Task title', 'staff.task_form.create': 'Create task',
  'staff.task_form.creating': 'Creating…', 'staff.task_form.property': 'Property',
  'staff.task_form.employee': 'Employee', 'staff.task_form.team': 'Team',
};
function setup(timeZone = 'Asia/Bangkok') {
  const { container } = render(<OperationalTaskCreateForm operatingSpaceId="space" timeZone={timeZone}
    units={[{ id: 'unit', name: 'Villa', project: { name: 'Estate' } }]}
    teams={[]} members={[{ identity: { id: 'staff', firstName: 'Test', lastName: 'Staff' } }]}
    labels={labels} />);
  const form = container.querySelector('form')!;
  fireEvent.change(form.querySelector('[name=title]')!, { target: { value: 'Shift task' } });
  fireEvent.change(form.querySelector('[name=unitId]')!, { target: { value: 'unit' } });
  fireEvent.change(form.querySelector('[name=assignedIdentityId]')!, { target: { value: 'staff' } });
  fireEvent.change(form.querySelector('[name=dueAt]')!, { target: { value: '2027-01-10T10:00' } });
  return form;
}
beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe('operational task form submission', () => {
  it('resets the captured form after asynchronous success and releases its busy state', async () => {
    let resolve!: (response: { ok: boolean; json: () => Promise<unknown> }) => void;
    const fetchMock = vi.fn().mockReturnValue(new Promise(done => { resolve = done; }));
    vi.stubGlobal('fetch', fetchMock);
    const form = setup(); fireEvent.submit(form);
    expect(screen.getByRole('button', { name: 'Creating…' })).toBeDisabled();
    await act(async () => resolve({ ok: true, json: async () => ({ task: { id: 'task' } }) }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Create task' })).toBeEnabled());
    expect(form.querySelector('[name=title]')).toHaveValue('');
    expect(form.querySelector('[name=unitId]')).toHaveValue('');
    expect(form.querySelector('[name=dueAt]')).toHaveValue('');
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(fetchMock.mock.calls[0][0]).toBe('/api/ops/tasks');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      operatingSpaceId: 'space', unitId: 'unit', taskType: 'custom', title: 'Shift task',
      assignedIdentityId: 'staff', dueAt: '2027-01-10T03:00:00.000Z', mediaAssetIds: [],
    });
  });

  it('uses the configured space zone instead of the browser zone', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ task: { id: 'task' } }) });
    vi.stubGlobal('fetch', fetchMock);
    const form = setup('America/New_York'); fireEvent.submit(form);
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).dueAt).toBe('2027-01-10T15:00:00.000Z');
    expect(screen.getByText(/America\/New_York/)).toBeInTheDocument();
  });

  it('rejects an ambiguous due time before uploads or task writes and preserves inputs', async () => {
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    const form = setup('America/New_York');
    fireEvent.change(form.querySelector('[name=dueAt]')!, { target: { value: '2026-11-01T01:30' } });
    fireEvent.change(form.querySelector('[name=photos]')!, { target: { files: [new File(['synthetic'], 'task.png', { type: 'image/png' })] } });
    fireEvent.submit(form);
    expect(await screen.findByRole('alert')).toHaveTextContent('Choose a valid, unambiguous due time in America/New_York.');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(form.querySelector('[name=title]')).toHaveValue('Shift task');
    expect(form.querySelector('[name=dueAt]')).toHaveValue('2026-11-01T01:30');
    expect(screen.getByRole('button', { name: 'Create task' })).toBeEnabled();
  });

  it('preserves a canonical refusal and the entered task without refresh', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'Assignment is outside your scope' }) }));
    const form = setup(); fireEvent.submit(form);
    expect(await screen.findByRole('alert')).toHaveTextContent('Assignment is outside your scope');
    expect(screen.getByRole('button', { name: 'Create task' })).toBeEnabled();
    expect(form.querySelector('[name=title]')).toHaveValue('Shift task');
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it.each(['network', 'invalid-json'])('recovers from %s without leaving the form busy', async failure => {
    const fetchMock = failure === 'network'
      ? vi.fn().mockRejectedValue(new Error('Connection lost'))
      : vi.fn().mockResolvedValue({ ok: true, json: async () => { throw new Error('Invalid JSON'); } });
    vi.stubGlobal('fetch', fetchMock);
    const form = setup(); fireEvent.submit(form);
    expect(await screen.findByRole('alert')).toHaveTextContent('Task creation failed');
    expect(screen.getByRole('button', { name: 'Create task' })).toBeEnabled();
    expect(form.querySelector('[name=title]')).toHaveValue('Shift task');
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it('stops after an upload refusal without creating a task or clearing inputs', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'Photo rejected' }) });
    vi.stubGlobal('fetch', fetchMock);
    const form = setup();
    fireEvent.change(form.querySelector('[name=photos]')!, { target: { files: [new File(['synthetic'], 'task.png', { type: 'image/png' })] } });
    fireEvent.submit(form);
    expect(await screen.findByRole('alert')).toHaveTextContent('Photo rejected');
    expect(screen.getByRole('button', { name: 'Create task' })).toBeEnabled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/media/upload');
    expect(form.querySelector('[name=title]')).toHaveValue('Shift task');
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});


describe('calendar unit context', () => {
  function contextForm(initialUnitId?: string) {
    const { container } = render(<OperationalTaskCreateForm operatingSpaceId="space" timeZone="Asia/Bangkok"
      initialUnitId={initialUnitId}
      units={[{ id: 'v1', name: 'V1', project: { name: 'Estate' } }, { id: 'v2', name: 'V2', project: { name: 'Estate' } }]}
      teams={[]} members={[]} labels={labels} />);
    return container.querySelector('form')!;
  }

  it('preselects the authorized unit, submits it and preserves context after reset', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ task: { id: 'task' } }) });
    vi.stubGlobal('fetch', fetchMock);
    const form = contextForm('v1');
    expect(form.querySelector('[name=unitId]')).toHaveValue('v1');
    fireEvent.change(form.querySelector('[name=title]')!, { target: { value: 'Inspect V1' } });
    fireEvent.change(form.querySelector('[name=dueAt]')!, { target: { value: '2027-01-10T10:00' } });
    fireEvent.submit(form);
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ operatingSpaceId: 'space', unitId: 'v1' });
    expect(form.querySelector('[name=unitId]')).toHaveValue('v1');
  });

  it.each([undefined, 'foreign-unit'])('keeps the placeholder for missing or unauthorized context (%s)', initialUnitId => {
    const form = contextForm(initialUnitId);
    expect(form.querySelector('[name=unitId]')).toHaveValue('');
    expect(form.querySelector('option[value="foreign-unit"]')).toBeNull();
  });

  it('allows an explicit choice of another authorized unit', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ task: { id: 'task' } }) });
    vi.stubGlobal('fetch', fetchMock);
    const form = contextForm('v1');
    fireEvent.change(form.querySelector('[name=unitId]')!, { target: { value: 'v2' } });
    fireEvent.change(form.querySelector('[name=dueAt]')!, { target: { value: '2027-01-10T10:00' } });
    fireEvent.submit(form);
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).unitId).toBe('v2');
  });
});
