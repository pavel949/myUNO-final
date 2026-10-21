import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ManagedAccountForm from './ManagedAccountForm';

const labels = { save: 'Save', saved: 'Saved', displayName: 'Workspace name', disable: 'Disable access',
  enable: 'Restore access', active: 'Active', disabled: 'Disabled', firstName: 'First name', lastName: 'Last name',
  language: 'Language', confirmDisable: 'Disable access here?', failed: 'Failed' };
const initial = { firstName: 'Test', lastName: 'Colleague', active: true, updatedAt: '2026-10-21T00:00:00.000Z' };
const fetcher = vi.fn();
beforeEach(() => {
  fetcher.mockReset(); vi.stubGlobal('fetch', fetcher);
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});
describe('bounded account-management forms', () => {
  it('sends a local membership edit without identity or privilege fields', async () => {
    fetcher.mockResolvedValue({ ok: true, json: async () => ({ member: { displayName: 'Reception', updatedAt: initial.updatedAt } }) });
    render(<ManagedAccountForm endpoint="/api/ops/spaces/a/people/b" kind="workspace" initial={initial} labels={labels} />);
    fireEvent.change(screen.getByLabelText('Workspace name'), { target: { value: 'Reception' } });
    fireEvent.click(screen.getByText('Save'));
    await screen.findByText('Saved');
    const payload = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(payload).toEqual({ action: 'profile', displayName: 'Reception', expectedUpdatedAt: initial.updatedAt });
  });
  it('disables only local access after confirmation and does not announce success on stale rejection', async () => {
    fetcher.mockResolvedValue({ ok: false, json: async () => ({ error: 'Refresh and review before saving' }) });
    render(<ManagedAccountForm endpoint="/api/ops/spaces/a/people/b" kind="workspace" initial={initial} labels={labels} />);
    fireEvent.click(screen.getByText('Disable access'));
    await screen.findByText('Refresh and review before saving');
    expect(window.confirm).toHaveBeenCalledWith(labels.confirmDisable);
    expect(JSON.parse(fetcher.mock.calls[0][1].body).action).toBe('disable');
    expect(screen.queryByText('Saved')).toBeNull();
    expect(screen.getByText('Disable access')).not.toBeDisabled();
  });
  it('keeps protected controls disabled and never sends a request', async () => {
    render(<ManagedAccountForm endpoint="/api/ops/spaces/a/people/b" kind="workspace" initial={initial} labels={labels} canManage={false} />);
    fireEvent.click(screen.getByText('Disable access'));
    await waitFor(() => expect(fetcher).not.toHaveBeenCalled());
    expect(screen.getByLabelText('Workspace name')).toBeDisabled();
  });
});
