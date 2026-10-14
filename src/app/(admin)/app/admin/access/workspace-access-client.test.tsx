import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WorkspaceAccessClient from './workspace-access-client';
import { OPERATING_GOVERNANCE_LABELS as labels } from '@/modules/content/operating-governance.seed';
const state = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: state.refresh }) }));
const organization = { id: 'org-a', name: 'Operations A', units: [{ id: 'unit-a', name: 'Villa A', project: { name: 'Estate A' } }] };
const space = { id: 'space-a', name: 'Workspace A', organizationId: 'org-a', updatedAt: '2026-10-14T00:00:00.000Z', unitIds: ['unit-a'], currentUnits: organization.units, members: [] };
const person = { id: 'person-a', firstName: 'Alex', lastName: 'Operator', email: 'alex@example.test', status: 'active' };
const response = (body: unknown, ok = true) => ({ ok, json: async () => body });
beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe('explicit founder workspace setup', () => {
  it('starts with no organization, unit or space selected', () => {
    render(<WorkspaceAccessClient organizations={[organization]} spaces={[space]} labels={labels} />);
    expect(screen.getByRole('combobox', { name: 'Existing operating organization' })).toHaveValue('');
    expect(screen.getByRole('combobox', { name: 'Existing workspace' })).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Create workspace' })).toBeDisabled();
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  });
  it('creates only the explicitly chosen organization and units', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ space: { id: space.id } }, true));
    vi.stubGlobal('fetch', fetchMock);
    render(<WorkspaceAccessClient organizations={[organization]} spaces={[]} labels={labels} />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Existing operating organization' }), { target: { value: organization.id } });
    expect(screen.getByRole('checkbox', { name: /Villa A/ })).not.toBeChecked();
    fireEvent.change(screen.getByLabelText('Workspace name'), { target: { value: 'Workspace A' } });
    fireEvent.change(screen.getByLabelText('Workspace key'), { target: { value: 'workspace-a' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /Villa A/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Create workspace' }));
    await waitFor(() => expect(state.refresh).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0][0]).toBe('/api/admin/operating-spaces');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ organizationId: 'org-a', name: 'Workspace A', key: 'workspace-a', unitIds: ['unit-a'] });
  });
  it('searches with q and grants only explicitly checked capabilities using the observed scope version', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(response({ identities: [person] })).mockResolvedValueOnce(response({ member: { id: 'member' } }));
    vi.stubGlobal('fetch', fetchMock);
    render(<WorkspaceAccessClient organizations={[organization]} spaces={[space]} labels={labels} />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Existing workspace' }), { target: { value: space.id } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Find existing person' }), { target: { value: 'alex@example.test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Find existing person' }));
    fireEvent.click(await screen.findByRole('button', { name: /Alex Operator/ }));
    expect(fetchMock.mock.calls[0][0]).toBe('/api/admin/people/search?q=alex%40example.test');
    expect(screen.getByRole('checkbox', { name: 'manage tasks' })).not.toBeChecked();
    fireEvent.click(screen.getByRole('checkbox', { name: 'manage tasks' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save member access' }));
    await waitFor(() => expect(state.refresh).toHaveBeenCalledTimes(1));
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ identityId: 'person-a', active: true, capabilities: ['manage_tasks'], expectedUpdatedAt: space.updatedAt });
  });
  it('keeps selected units and version-conflict feedback without reporting success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ error: 'This space changed. Refresh and review before saving.' }, false)));
    render(<WorkspaceAccessClient organizations={[organization]} spaces={[space]} labels={labels} />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Existing workspace' }), { target: { value: space.id } });
    fireEvent.click(screen.getByRole('button', { name: 'Save selected homes' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('This space changed');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Villa A/ })).toBeChecked();
    expect(state.refresh).not.toHaveBeenCalled();
  });
  it('does not apply a delayed person search to a different workspace', async () => {
    let resolve!: (r: ReturnType<typeof response>) => void;
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(done => { resolve = done; })));
    render(<WorkspaceAccessClient organizations={[organization]} spaces={[space]} labels={labels} />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Existing workspace' }), { target: { value: space.id } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Find existing person' }), { target: { value: 'alex' } });
    fireEvent.click(screen.getByRole('button', { name: 'Find existing person' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Existing workspace' }), { target: { value: '' } });
    await act(async () => resolve(response({ identities: [person] })));
    expect(screen.queryByRole('button', { name: /Alex Operator/ })).not.toBeInTheDocument();
  });
});
