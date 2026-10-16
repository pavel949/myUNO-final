import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PeopleAdminClient from './people-client';
import { PROPERTY_WORKSPACE_LABELS } from '@/modules/content/property-workspace.seed';
const labels = new Proxy(PROPERTY_WORKSPACE_LABELS, { get: (target, key) => target[String(key)] ?? String(key) });
const person = { id: 'person', firstName: 'Staff', lastName: 'Member', email: 'staff@example.test', status: 'active' };
let assignments: any[], calls: Array<{ url: string; body?: any }>;
const json = (body: unknown) => ({ ok: true, json: async () => body });
beforeEach(() => {
  assignments = []; calls = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (url.includes('/roles/units?')) return json({ items: [{ id: 'unit', name: 'Condo' }] });
    if (url.includes('/people/search?')) return json({ identities: [person] });
    if (url.endsWith('/roles')) return json({ assignments, identity: person });
    if (url === '/api/admin/people/invite') return json({ identity: { ...person, status: 'invited' }, created: true, alreadyActive: false,
      emailed: false, emailStatus: 'unavailable', claimUrl: 'http://localhost/auth/claim?token=synthetic&next=%2Fproperty' });
    return json({ success: true });
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function show() { render(<PeopleAdminClient projects={[{ id: 'project', name: 'Complex' }]} labels={labels} />); }
async function open() {
  show(); fireEvent.click(screen.getByRole('button', { name: 'admin.people.search' }));
  fireEvent.click(await screen.findByRole('button', { name: /Staff Member/ }));
  await waitFor(() => expect(calls.some(call => call.url.endsWith('/roles'))).toBe(true));
}
describe('founder employee invitation and independent capability controls', () => {
  it('offers the property destination and a reusable login entry without shared credentials', async () => {
    show();
    expect(screen.getByLabelText('After password setup', { exact: true })).toHaveValue('property');
    expect(screen.getByRole('link', { name: 'Employee sign-in link' })).toHaveAttribute('href', '/login?next=%2Fproperty');
    fireEvent.change(screen.getByLabelText('admin.people.invite_first_name'), { target: { value: 'Staff' } });
    fireEvent.change(screen.getByLabelText('admin.people.invite_last_name'), { target: { value: 'Member' } });
    fireEvent.change(screen.getByLabelText('admin.people.invite_email'), { target: { value: 'staff@example.test' } });
    fireEvent.click(screen.getByRole('button', { name: 'admin.people.invite_submit' }));
    await screen.findByText('admin.people.invite_not_emailed');
    expect(calls.find(call => call.url === '/api/admin/people/invite')?.body).toEqual({ firstName: 'Staff', lastName: 'Member', email: 'staff@example.test', destination: 'property' });
    expect(screen.getByLabelText('After password setup', { exact: true })).toHaveValue('property');
    expect(screen.getByLabelText('admin.people.invite_email')).toHaveValue('');
    expect(screen.queryByLabelText(/Password/)).toBeNull();
  });
  it('assigns booking mode as its own exact-unit right, without platform scope or automatic delegation', async () => {
    await open(); fireEvent.change(screen.getByLabelText('admin.people.role'), { target: { value: 'booking_mode_editor' } });
    await screen.findByRole('option', { name: 'Condo · unit' });
    expect(screen.getByLabelText('admin.people.scope')).toHaveValue('unit');
    expect(within(screen.getByLabelText('admin.people.scope')).queryByRole('option', { name: 'admin.people.scope_platform' })).toBeNull();
    expect(screen.getByLabelText('Allow this person to delegate this right within this scope')).not.toBeChecked();
    fireEvent.change(screen.getByLabelText('admin.people.unit'), { target: { value: 'unit' } });
    fireEvent.click(screen.getByRole('button', { name: 'admin.people.grant_submit' }));
    await waitFor(() => expect(calls.some(call => call.url === '/api/admin/roles/grant')).toBe(true));
    expect(calls.find(call => call.url === '/api/admin/roles/grant')?.body).toEqual({ identityId: 'person', role: 'booking_mode_editor',
      scopeType: 'unit', projectId: 'project', unitId: 'unit', canDelegate: false, expiresAt: null });
  });
  it('loads current revision for an explicit root edit and locks its immutable scope', async () => {
    assignments = [{ id: 'root', role: 'pricing_editor', scopeType: 'unit', projectId: 'project', unitId: 'unit', unitName: 'Condo',
      status: 'active', canDelegate: true, parentGrantId: null, expiresAt: null, updatedAt: '2026-01-01T00:00:00.000Z' }];
    await open(); fireEvent.click(await screen.findByRole('button', { name: 'Edit this assignment' }));
    await screen.findByRole('option', { name: 'Condo · unit' });
    expect(screen.getByLabelText('admin.people.role')).toBeDisabled(); expect(screen.getByLabelText('admin.people.scope')).toBeDisabled();
    expect(screen.getByLabelText('admin.people.project')).toBeDisabled(); expect(screen.getByLabelText('admin.people.unit')).toBeDisabled();
    fireEvent.click(screen.getByLabelText('Allow this person to delegate this right within this scope'));
    fireEvent.click(screen.getByRole('button', { name: 'admin.people.grant_submit' }));
    await waitFor(() => expect(calls.some(call => call.url === '/api/admin/roles/grant')).toBe(true));
    expect(calls.find(call => call.url === '/api/admin/roles/grant')?.body).toMatchObject({ canDelegate: false, expectedUpdatedAt: '2026-01-01T00:00:00.000Z', role: 'pricing_editor', unitId: 'unit' });
  });
  it('does not offer converting a delegated assignment into a new root through edit', async () => {
    assignments = [{ id: 'child', role: 'pricing_editor', scopeType: 'unit', unitId: 'unit', projectId: 'project', status: 'active',
      parentGrantId: 'root', canDelegate: false, updatedAt: '2026-01-01T00:00:00.000Z' }];
    await open(); await screen.findByText(/Delegated by a manager/);
    expect(screen.queryByRole('button', { name: 'Edit this assignment' })).toBeNull();
  });
});
