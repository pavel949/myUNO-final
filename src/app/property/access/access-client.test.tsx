import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PropertyAccessClient from './access-client';
import { PROPERTY_DELEGATION_LABELS } from '@/modules/content/property-delegation.seed';
import { PROPERTY_WORKSPACE_LABELS } from '@/modules/content/property-workspace.seed';
const labels = { ...PROPERTY_DELEGATION_LABELS, ...PROPERTY_WORKSPACE_LABELS };
const parent = { id: 'root', role: 'pricing_editor', scopeType: 'unit', projectId: 'p', unitId: 'a', projectName: 'Complex', unitName: 'A', expiresAt: '2028-01-01T00:00:00.000Z' };
let workspace: { grants: any[]; assignments: any[] }, calls: Array<{ url: string; body?: any }>, result: { status: number; body: unknown };
const json = (body: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
beforeEach(() => {
  workspace = { grants: [parent], assignments: [] }; calls = []; result = { status: 200, body: { id: 'child' } };
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (init?.method === 'POST') return json(result.body, result.status);
    if (url.includes('?')) return json({ units: [{ id: 'a', name: 'A' }], hasMore: false });
    return json(workspace);
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
async function fill() {
  render(<PropertyAccessClient labels={labels} />);
  await screen.findByRole('option', { name: 'A' });
  fireEvent.change(screen.getByLabelText('Employee account email', { exact: true }), { target: { value: 'employee@example.test' } });
}
const confirmation = () => screen.getByLabelText('I reviewed the employee, right and exact properties.', { exact: true });
const submit = () => screen.getByRole('button', { name: 'Assign this right' });
describe('scoped manager assignment UI', () => {
  it('associates filled select labels and requires a reviewed exact-unit assignment', async () => {
    await fill();
    expect(screen.getByLabelText('Your delegable right', { exact: true })).toHaveValue('root');
    expect(screen.getByLabelText('Properties to assign', { exact: true })).toHaveValue('unit');
    expect(screen.getByLabelText('Properties to assign', { exact: true })).toBeDisabled();
    expect(screen.getByLabelText('Choose a unit', { exact: true })).toHaveValue('a');
    expect(submit()).toBeDisabled(); fireEvent.click(confirmation()); fireEvent.click(submit());
    await screen.findByText('Assignment saved.');
    expect(calls.find(call => call.body)?.body).toEqual({ action: 'grant', email: 'employee@example.test', role: 'pricing_editor',
      parentGrantId: 'root', scopeType: 'unit', projectId: 'p', unitId: 'a' });
    expect(confirmation()).not.toBeChecked();
  });
  it('does not invent root capabilities or offer re-delegation', async () => {
    workspace.grants = []; render(<PropertyAccessClient labels={labels} />); await screen.findByLabelText('Employee account email');
    expect(submit()).toBeDisabled(); expect(screen.queryByText(/Allow this person to delegate/)).toBeNull();
  });
  it('clears confirmation whenever recipient or scope changes', async () => {
    workspace.grants = [{ ...parent, scopeType: 'project', unitId: null }]; await fill();
    fireEvent.change(screen.getByLabelText('Choose a unit', { exact: true }), { target: { value: 'a' } });
    fireEvent.click(confirmation()); expect(submit()).not.toBeDisabled();
    fireEvent.change(screen.getByLabelText('Properties to assign', { exact: true }), { target: { value: 'project' } });
    expect(confirmation()).not.toBeChecked(); expect(screen.queryByLabelText('Choose a unit', { exact: true })).toBeNull();
    fireEvent.click(confirmation()); fireEvent.change(screen.getByLabelText('Employee account email'), { target: { value: 'other@example.test' } });
    expect(submit()).toBeDisabled();
  });
  it('sends current revision when explicitly editing an existing child assignment', async () => {
    workspace.assignments = [{ id: 'child', parentGrantId: 'root', role: 'pricing_editor', scopeType: 'unit', projectId: 'p', unitId: 'a',
      name: 'Employee', email: 'employee@example.test', status: 'revoked', accountStatus: 'active', updatedAt: '2026-01-01T00:00:00.000Z' }];
    await fill(); fireEvent.click(confirmation()); fireEvent.click(submit());
    await waitFor(() => expect(calls.some(call => call.body)).toBe(true));
    expect(calls.find(call => call.body)?.body.expectedUpdatedAt).toBe('2026-01-01T00:00:00.000Z');
  });
  it('removes stale names and form after a server-side revocation response', async () => {
    result = { status: 403, body: { error: 'Authority was revoked' } };
    await fill(); fireEvent.click(confirmation()); fireEvent.click(submit());
    expect(await screen.findByRole('alert')).toHaveTextContent('Authority was revoked');
    expect(screen.queryByLabelText('Employee account email')).toBeNull(); expect(screen.queryByText('Complex')).toBeNull();
  });
  it('revoke sends only the selected child identifier', async () => {
    workspace.assignments = [{ id: 'child', parentGrantId: 'root', role: 'pricing_editor', scopeType: 'unit', projectId: 'p', unitId: 'a',
      name: 'Employee', email: 'employee@example.test', status: 'active', accountStatus: 'active' }];
    await fill(); fireEvent.click(screen.getByRole('button', { name: 'Revoke' }));
    await screen.findByText('Assignment revoked.');
    expect(calls.find(call => call.body)?.body).toEqual({ action: 'revoke', roleAssignmentId: 'child' });
  });
});
