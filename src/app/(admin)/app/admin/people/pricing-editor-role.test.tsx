import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PeopleAdminClient from './people-client';
import { PRICING_EDITOR_ROLE_LOCALE_DRAFTS } from '@/modules/content/pricing-editor-role.seed';

import { CONTENT_CONTRIBUTOR_ROLE_LOCALE_DRAFTS } from '@/modules/content/content-contributor-role.seed';

const labels = new Proxy({} as Record<string, string>, { get: (_target, key) => String(key) });
const person = { id: 'person-a', firstName: 'Content', lastName: 'Editor', email: 'editor@example.test', status: 'active' };
const projects = [{ id: 'complex-a', name: 'Complex A' }, { id: 'complex-b', name: 'Complex B' }];
const json = (data: unknown, ok = true) => ({ ok, json: async () => data });
let calls: Array<{ url: string; body: any }>;
let lookup: (url: string) => Promise<any>;

async function openPricing() {
  render(<PeopleAdminClient projects={projects} labels={labels} />);
  fireEvent.click(screen.getByRole('button', { name: 'admin.people.search' }));
  fireEvent.click(await screen.findByRole('button', { name: /Content Editor/ }));
  fireEvent.change(screen.getByRole('combobox', { name: 'admin.people.role' }), { target: { value: 'pricing_editor' } });
}
const grantButton = () => screen.getByRole('button', { name: 'admin.people.grant_submit' });
const scope = () => screen.getByRole('combobox', { name: 'admin.people.scope' });
const unit = () => screen.getByRole('combobox', { name: 'admin.people.unit' });

describe('pricing editor assignment in People & Roles', () => {
  beforeEach(() => {
    calls = [];
    lookup = async url => json({ items: [{ id: url.includes('complex-b') ? 'unit-b' : 'unit-a', name: 'Apartment 1' }], hasMore: false });
    vi.stubGlobal('fetch', vi.fn(async (input: string, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null });
      if (url.startsWith('/api/admin/roles/units?')) return lookup(url);
      if (url.startsWith('/api/admin/people/search?')) return json({ identities: [person] });
      if (url.endsWith('/roles')) return json({ assignments: [], identity: person });
      if (url === '/api/admin/roles/grant') return json({ success: true });
      throw new Error(`Unexpected fetch: ${url}`);
    }));
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it('defaults to an exact unit and never offers platform scope', async () => {
    await openPricing();
    expect((scope() as HTMLSelectElement).value).toBe('unit');
    expect(within(scope()).queryByRole('option', { name: 'admin.people.scope_platform' })).toBeNull();
    expect(screen.getByText('admin.people.pricing_scope_note')).toBeTruthy();
    expect((grantButton() as HTMLButtonElement).disabled).toBe(true);
    await screen.findByRole('option', { name: 'Apartment 1 · unit-a' });
    fireEvent.change(unit(), { target: { value: 'unit-a' } });
    fireEvent.click(grantButton());
    await waitFor(() => expect(calls.filter(call => call.url === '/api/admin/roles/grant')).toHaveLength(1));
    expect(calls.find(call => call.url === '/api/admin/roles/grant')!.body).toEqual({
      identityId: 'person-a', role: 'pricing_editor', canDelegate: false, expiresAt: null, scopeType: 'unit', projectId: 'complex-a', unitId: 'unit-a',
    });
  });

  it('sends explicit project pricing separately with no leftover unit ID', async () => {
    await openPricing();
    await screen.findByRole('option', { name: 'Apartment 1 · unit-a' });
    fireEvent.change(unit(), { target: { value: 'unit-a' } });
    fireEvent.change(scope(), { target: { value: 'project' } });
    expect(screen.queryByRole('combobox', { name: 'admin.people.unit' })).toBeNull();
    expect(within(scope()).getByRole('option', { name: 'admin.people.scope_pricing_project' })).toBeTruthy();
    fireEvent.click(grantButton());
    await waitFor(() => expect(calls.filter(call => call.url === '/api/admin/roles/grant')).toHaveLength(1));
    expect(calls.find(call => call.url === '/api/admin/roles/grant')!.body).toEqual({
      identityId: 'person-a', role: 'pricing_editor', canDelegate: false, expiresAt: null, scopeType: 'project', projectId: 'complex-a',
    });
  });

  it('clears the selected unit when the project or search changes', async () => {
    await openPricing();
    await screen.findByRole('option', { name: 'Apartment 1 · unit-a' });
    fireEvent.change(unit(), { target: { value: 'unit-a' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'admin.people.project' }), { target: { value: 'complex-b' } });
    expect((grantButton() as HTMLButtonElement).disabled).toBe(true);
    expect((unit() as HTMLSelectElement).value).toBe('');
    await screen.findByRole('option', { name: 'Apartment 1 · unit-b' });
    expect(screen.queryByRole('option', { name: 'Apartment 1 · unit-a' })).toBeNull();
    fireEvent.change(unit(), { target: { value: 'unit-b' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'admin.people.unit_search' }), { target: { value: 'unit-b' } });
    expect((grantButton() as HTMLButtonElement).disabled).toBe(true);
    expect((unit() as HTMLSelectElement).value).toBe('');
  });

  it('does not let a late previous-project response replace current unit options', async () => {
    let resolveOld!: (result: any) => void;
    lookup = async url => url.includes('complex-a') ? new Promise(resolve => { resolveOld = resolve; }) : json({ items: [{ id: 'unit-b', name: 'Current' }] });
    await openPricing();
    await waitFor(() => expect(resolveOld).toBeTruthy());
    fireEvent.change(screen.getByRole('combobox', { name: 'admin.people.project' }), { target: { value: 'complex-b' } });
    await screen.findByRole('option', { name: 'Current · unit-b' });
    resolveOld(json({ items: [{ id: 'unit-a', name: 'Stale' }] }));
    await waitFor(() => expect(screen.queryByRole('option', { name: 'Stale · unit-a' })).toBeNull());
    expect(screen.getByRole('option', { name: 'Current · unit-b' })).toBeTruthy();
  });

  it('fails closed on lookup failure, distinguishes empty results, and retries', async () => {
    lookup = async () => json({}, false);
    await openPricing();
    await screen.findByText('admin.people.units_error');
    expect((grantButton() as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByText('admin.people.units_none')).toBeNull();
    lookup = async () => json({ items: [], hasMore: false });
    fireEvent.click(screen.getByRole('button', { name: 'admin.people.units_retry' }));
    await screen.findByText('admin.people.units_none');
    expect((grantButton() as HTMLButtonElement).disabled).toBe(true);
  });

  it('clears exact-unit scope when switching to an unrelated role', async () => {
    await openPricing();
    fireEvent.change(screen.getByRole('combobox', { name: 'admin.people.role' }), { target: { value: 'owner' } });
    expect((scope() as HTMLSelectElement).value).toBe('project');
    expect(screen.queryByRole('combobox', { name: 'admin.people.unit' })).toBeNull();
    expect(screen.queryByText('admin.people.pricing_scope_note')).toBeNull();
  });

  it('associates exact visible Russian labels with filled fields, without including option text in labels', async () => {
    const russianLabels = new Proxy({
      ...Object.fromEntries(Object.entries({ ...CONTENT_CONTRIBUTOR_ROLE_LOCALE_DRAFTS, ...PRICING_EDITOR_ROLE_LOCALE_DRAFTS }).map(([key, drafts]) => [key, drafts.ru])),
      'admin.people.role': 'Роль',
      'admin.people.scope': 'Область доступа',
      'admin.people.project': 'Комплекс',
    } as Record<string, string>, { get: (target, key) => target[String(key)] ?? String(key) });
    render(<PeopleAdminClient projects={projects} labels={russianLabels} />);
    fireEvent.click(screen.getByRole('button', { name: 'admin.people.search' }));
    fireEvent.click(await screen.findByRole('button', { name: /Content Editor/ }));

    const roleField = screen.getByLabelText('Роль', { exact: true }) as HTMLSelectElement;
    fireEvent.change(roleField, { target: { value: 'pricing_editor' } });
    const scopeField = screen.getByLabelText('Область доступа', { exact: true }) as HTMLSelectElement;
    const projectField = screen.getByLabelText('Комплекс', { exact: true }) as HTMLSelectElement;
    const searchField = screen.getByLabelText('Найти объект по названию или точному ID', { exact: true }) as HTMLInputElement;
    const unitField = screen.getByLabelText('Конкретный объект', { exact: true }) as HTMLSelectElement;

    fireEvent.change(searchField, { target: { value: 'unit-a' } });
    await screen.findByRole('option', { name: 'Apartment 1 · unit-a' });
    fireEvent.change(unitField, { target: { value: 'unit-a' } });
    expect(roleField.value).toBe('pricing_editor');
    expect(scopeField.value).toBe('unit');
    expect(projectField.value).toBe('complex-a');
    expect(searchField.value).toBe('unit-a');
    expect(unitField.value).toBe('unit-a');

    for (const [field, text] of [
      [roleField, 'Роль'], [scopeField, 'Область доступа'], [projectField, 'Комплекс'],
      [searchField, 'Найти объект по названию или точному ID'], [unitField, 'Конкретный объект'],
    ] as const) {
      const label = field.labels?.item(0);
      expect(label?.control).toBe(field);
      expect(label?.htmlFor).toBe(field.id);
      expect(label?.textContent?.trim()).toBe(text);
      expect(label?.contains(field)).toBe(false);
    }
    expect((grantButton() as HTMLButtonElement).disabled).toBe(false);
  });
});
