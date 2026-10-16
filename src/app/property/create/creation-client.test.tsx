import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CreationClient from './creation-client';
import { EMPLOYEE_CREATION_KEYS, EMPLOYEE_CREATION_LABELS } from '@/modules/content/employee-creation.seed';
import { parseEmployeeCreationCreate, parseEmployeeCreationUpdate } from '@/modules/onboarding/employee-creation.schema';

const API = '/api/property-creation';
const requestId = '12345678-1234-4234-8234-123456789abc';
const space = { id: 'space-a', name: 'Employee workspace', organizationId: 'org-a', canCreateUnit: true, canCreateComplex: true, projects: [{ id: 'project-a', name: 'Authorized complex' }] };
const unitDraft = { unitName: 'A101', unitType: 'condo', bedrooms: 1, bathrooms: 1, maxGuests: 2, sizeSqm: 55, floor: '1', description: '', descriptionLocale: null, photos: [] };
const saved = (extra: Record<string, unknown> = {}) => ({ id: 'application-a', spaceId: space.id, organizationId: space.organizationId, kind: 'unit', projectId: 'project-a', status: 'draft', revision: 1, draft: { ...unitDraft }, createdUnitId: null, createdProjectId: null, lastRequestId: requestId, hasCreationAccess: true, mayEdit: true, ...extra });
const response = (value: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => value }) as Response;
const l = (key: string) => EMPLOYEE_CREATION_LABELS[`property.creation.${key}`];
function setup(options: { spaces?: typeof space[]; items?: ReturnType<typeof saved>[]; override?: (url: string, init: RequestInit) => Response | Promise<Response> | undefined } = {}) {
  let rows = options.items || [];
  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const result = options.override?.(url, init);
    if (result !== undefined) return result;
    if (url === API && !init.method) return response({ spaces: options.spaces || [space], items: rows });
    if (url.includes('?id=')) return response(rows.find(row => row.id === new URL(url, 'https://example.test').searchParams.get('id')) || saved());
    if (url.includes('?spaceId=')) return response({ projects: [], units: [{ id: 'existing-a', name: 'Potential match', projectId: 'project-a' }] });
    if (init.method === 'POST' || init.method === 'PATCH') {
      const body = JSON.parse(String(init.body));
      if (init.method === 'POST') parseEmployeeCreationCreate(body); else parseEmployeeCreationUpdate(body);
      const record = saved({ ...body, id: body.id || 'application-a', revision: init.method === 'POST' ? 1 : body.expectedRevision + 1, lastRequestId: body.requestId, kind: body.kind || rows[0]?.kind || 'unit', projectId: body.projectId === undefined ? rows[0]?.projectId || 'project-a' : body.projectId, spaceId: body.spaceId || space.id });
      rows = [record];
      return response(record, init.method === 'POST' ? 201 : 200);
    }
    throw new Error(`Unexpected request ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('crypto', { randomUUID: vi.fn(() => requestId) });
  return fetchMock;
}
async function start(kind = 'unit') {
  await waitFor(() => expect(screen.getByLabelText(l('space'), { exact: true })).toBeEnabled());
  expect(screen.getByLabelText(l('space'), { exact: true })).toHaveValue('');
  fireEvent.change(screen.getByLabelText(l('space'), { exact: true }), { target: { value: space.id } });
  fireEvent.change(screen.getByLabelText(l('kind')), { target: { value: kind } });
  if (kind === 'unit') fireEvent.change(screen.getByLabelText(l('project')), { target: { value: 'project-a' } });
  fireEvent.click(screen.getByRole('button', { name: l('start') }));
  await screen.findByLabelText(l(kind === 'unit' ? 'field.unitName' : 'field.proposedProject'));
}
const mutations = (mock: ReturnType<typeof setup>) => mock.mock.calls.filter(([, init]) => ['POST', 'PATCH'].includes(init?.method || ''));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('employee creation editor', () => {
  it('registers complete four-locale defaults without empty translations', () => {
    expect(new Set(EMPLOYEE_CREATION_KEYS.map(row => row.key)).size).toBe(EMPLOYEE_CREATION_KEYS.length);
    for (const row of EMPLOYEE_CREATION_KEYS) for (const locale of ['en', 'ru', 'th', 'zh'] as const) expect(row[locale].trim()).not.toBe('');
  });
  it('does not infer all projects or auto-select a workspace and shows unsupported scope', async () => {
    setup({ spaces: [] }); render(<CreationClient labels={{}} fromOperations />);
    expect(await screen.findByText(l('no_scope'))).toBeInTheDocument();
    expect(screen.queryByLabelText(l('project'))).not.toBeInTheDocument();
    expect(screen.getByText(l('operations_notice'))).toBeInTheDocument();
  });
  it('offers only granted modes and eligible projects and clears a project on space change', async () => {
    setup({ spaces: [{ ...space, canCreateComplex: false }, { ...space, id: 'space-b', name: 'Second workspace', canCreateUnit: false, projects: [] }] });
    render(<CreationClient labels={{}} />);
    await screen.findByLabelText(l('space'), { exact: true });
    fireEvent.change(screen.getByLabelText(l('space'), { exact: true }), { target: { value: space.id } });
    expect(within(screen.getByLabelText(l('kind'))).queryByRole('option', { name: l('complex') })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(l('kind')), { target: { value: 'unit' } });
    expect(within(screen.getByLabelText(l('project'))).getAllByRole('option')).toHaveLength(2);
    fireEvent.change(screen.getByLabelText(l('project')), { target: { value: 'project-a' } });
    fireEvent.change(screen.getByLabelText(l('space'), { exact: true }), { target: { value: 'space-b' } });
    expect(screen.getByLabelText(l('kind'))).toHaveValue('');
    expect(screen.queryByLabelText(l('project'))).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: l('start') })).toBeDisabled();
  });
  it('sends only descriptive unit fields and prevents duplicate writes while pending', async () => {
    let resolve!: (value: Response) => void;
    const fetchMock = setup({ override: (_url, init) => init.method === 'POST' ? new Promise<Response>(done => { resolve = done; }) : undefined });
    render(<CreationClient labels={{}} />); await start();
    fireEvent.change(screen.getByLabelText(l('field.unitName')), { target: { value: 'A101' } });
    fireEvent.click(screen.getByRole('button', { name: l('save') }));
    fireEvent.click(screen.getByRole('button', { name: l('save') }));
    expect(screen.getByLabelText(l('field.unitName'))).toBeDisabled();
    expect(screen.getByRole('button', { name: l('new') })).toBeDisabled();
    expect(mutations(fetchMock)).toHaveLength(1);
    const body = JSON.parse(String(mutations(fetchMock)[0][1]?.body));
    expect(() => parseEmployeeCreationCreate(body)).not.toThrow();
    expect(body).toMatchObject({ spaceId: space.id, kind: 'unit', projectId: 'project-a', requestId, status: 'draft' });
    expect(body.draft).not.toHaveProperty('offers'); expect(body.draft).not.toHaveProperty('projectAddress');
    resolve(response(saved({ draft: body.draft })));
    await screen.findByText(l('saved'));
    expect(screen.getByLabelText(l('field.unitName'))).toHaveValue('A101');
    expect(screen.getByRole('button', { name: l('save') })).toBeDisabled();
  });
  it('saves complex-only data with no unit keys and no implicit parent project', async () => {
    const fetchMock = setup(); render(<CreationClient labels={{}} areas={[{ id: 'area-a', name: 'Area A' }]} />); await start('complex');
    fireEvent.change(screen.getByLabelText(l('field.proposedProject')), { target: { value: 'New complex' } });
    fireEvent.click(screen.getByRole('button', { name: l('save') }));
    await screen.findByText(l('saved'));
    const body = JSON.parse(String(mutations(fetchMock)[0][1]?.body));
    expect(body.projectId).toBeNull(); expect(body.draft).not.toHaveProperty('unitName'); expect(body.draft).not.toHaveProperty('photos');
    expect(() => parseEmployeeCreationCreate(body)).not.toThrow();
  });
  it('recovers an ambiguous initial save by exact request receipt without posting again', async () => {
    let wrote = false;
    const fetchMock = setup({ override: (url, init) => {
      if (init.method === 'POST') { wrote = true; return Promise.reject(new Error('Connection lost')); }
      if (url.includes('?requestId=')) return response({ item: saved(), requestReceipt: { requestId, revision: 1, status: 'draft' } });
      return undefined;
    } });
    render(<CreationClient labels={{}} />); await start();
    fireEvent.change(screen.getByLabelText(l('field.unitName')), { target: { value: 'A101' } }); fireEvent.click(screen.getByRole('button', { name: l('save') }));
    await screen.findByText(l('error.uncertain')); expect(wrote).toBe(true);
    expect(screen.getByLabelText(l('field.unitName'))).toBeDisabled(); expect(screen.getByRole('button', { name: l('retry') })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: l('check_saved') })); await screen.findByText(l('saved'));
    expect(mutations(fetchMock)).toHaveLength(1); expect(screen.getByLabelText(l('field.unitName'))).toBeEnabled();
  });
  it('retries only an identical command after an exact readback found no receipt', async () => {
    let attempts = 0;
    const fetchMock = setup({ override: (url, init) => {
      if (init.method === 'POST' && ++attempts === 1) return Promise.reject(new Error('Lost response'));
      if (url.includes('?requestId=')) return response({ item: null, requestReceipt: null });
      return undefined;
    } });
    render(<CreationClient labels={{}} />); await start(); fireEvent.click(screen.getByRole('button', { name: l('save') }));
    await screen.findByText(l('error.uncertain')); expect(screen.queryByRole('button', { name: l('retry_exact') })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: l('check_saved') })); await screen.findByText(l('not_saved'));
    fireEvent.click(screen.getByRole('button', { name: l('retry_exact') })); await screen.findByText(l('saved'));
    expect(mutations(fetchMock)).toHaveLength(2); expect(mutations(fetchMock)[0][1]?.body).toBe(mutations(fetchMock)[1][1]?.body);
  });
  it('keeps edits after validation failure and uses expected revision on resumed saves', async () => {
    const fetchMock = setup({ items: [saved()], override: (_url, init) => init.method === 'PATCH' ? response({}, 400) : undefined });
    render(<CreationClient labels={{}} initialId="application-a" />);
    await screen.findByLabelText(l('field.unitName')); fireEvent.change(screen.getByLabelText(l('field.unitName')), { target: { value: 'Local name' } });
    fireEvent.click(screen.getByRole('button', { name: l('save') })); await screen.findByText(l('error.validation'));
    expect(screen.getByLabelText(l('field.unitName'))).toHaveValue('Local name'); expect(screen.getByRole('button', { name: l('save') })).toBeEnabled();
    const body = JSON.parse(String(mutations(fetchMock)[0][1]?.body)); expect(body.expectedRevision).toBe(1); expect(body).not.toHaveProperty('spaceId'); expect(body).not.toHaveProperty('projectId');
  });
  it('blocks stale revision writes until explicit latest-version reload, preserving edits meanwhile', async () => {
    const fetchMock = setup({ items: [saved()], override: (_url, init) => init.method === 'PATCH' ? response({}, 409) : undefined });
    render(<CreationClient labels={{}} initialId="application-a" />);
    await screen.findByLabelText(l('field.unitName')); fireEvent.change(screen.getByLabelText(l('field.unitName')), { target: { value: 'Unsaved name' } });
    fireEvent.click(screen.getByRole('button', { name: l('save') })); await screen.findByText(l('error.conflict'));
    expect(screen.getByLabelText(l('field.unitName'))).toHaveValue('Unsaved name'); expect(screen.getByRole('button', { name: l('save') })).toBeDisabled();
    vi.spyOn(window, 'confirm').mockReturnValue(false); fireEvent.click(screen.getByRole('button', { name: l('load_latest') }));
    expect(screen.getByLabelText(l('field.unitName'))).toHaveValue('Unsaved name'); expect(mutations(fetchMock)).toHaveLength(1);
  });
  it('freezes editing after permission revocation and preserves descriptive inputs', async () => {
    setup({ items: [saved()], override: (_url, init) => init.method === 'PATCH' ? response({}, 403) : undefined });
    render(<CreationClient labels={{}} initialId="application-a" />);
    await screen.findByLabelText(l('field.unitName')); fireEvent.change(screen.getByLabelText(l('field.unitName')), { target: { value: 'Kept edit' } });
    fireEvent.click(screen.getByRole('button', { name: l('save') })); await screen.findByText(l('error.forbidden'));
    expect(screen.getByLabelText(l('field.unitName'))).toHaveValue('Kept edit'); expect(screen.getByLabelText(l('field.unitName'))).toBeDisabled();
  });
  it('shows submitted applications read-only and links converted output only to the exact new target', async () => {
    const fetchMock = setup({ items: [saved({ status: 'converted', createdUnitId: 'new-unit', createdProjectId: null })] });
    render(<CreationClient labels={{}} initialId="application-a" />); await screen.findByText(l('converted'));
    expect(screen.getByLabelText(l('field.unitName'))).toBeDisabled(); expect(screen.queryByRole('button', { name: l('save') })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: l('propose') })).toHaveAttribute('href', '/property/content?scope=unit&targetId=new-unit');
    expect(mutations(fetchMock)).toHaveLength(0);
  });
  it('shows duplicate suggestions without any merge or existing-record edit action', async () => {
    setup(); render(<CreationClient labels={{}} />); await start();
    fireEvent.change(screen.getByLabelText(l('duplicate_query')), { target: { value: 'A1' } }); fireEvent.click(screen.getByRole('button', { name: l('duplicates') }));
    await screen.findByText('Potential match'); expect(screen.queryByRole('button', { name: 'Potential match' })).not.toBeInTheDocument();
    expect(screen.getByText(l('duplicate_hint'))).toBeInTheDocument();
  });
});


it('retains creator-owned intake read-only after scope revocation and hides converted target links', async () => {
  setup({ spaces: [], items: [saved({ status: 'converted', hasCreationAccess: false, mayEdit: false, createdUnitId: null, createdProjectId: null })] });
  render(<CreationClient labels={{}} initialId="application-a" />);
  await screen.findByLabelText(l('field.unitName'));
  expect(screen.getByLabelText(l('field.unitName'))).toHaveValue('A101');
  expect(screen.getByLabelText(l('field.unitName'))).toBeDisabled();
  expect(screen.getByText(l('error.forbidden'))).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: l('propose') })).not.toBeInTheDocument();
});

it('honors server mayEdit false even when a stale index still lists the creation workspace', async () => {
  const fetchMock = setup({ items: [saved({ hasCreationAccess: false, mayEdit: false })] });
  render(<CreationClient labels={{}} initialId="application-a" />);
  await screen.findByLabelText(l('field.unitName'));
  expect(screen.getByLabelText(l('field.unitName'))).toBeDisabled();
  expect(screen.getByRole('button', { name: l('save') })).toBeDisabled();
  expect(mutations(fetchMock)).toHaveLength(0);
});


it('submits complete descriptive facts with an explicit prose language and becomes read-only', async () => {
  const fetchMock = setup(); render(<CreationClient labels={{}} />); await start();
  for (const [key, value] of [['unitName', 'A101'], ['bedrooms', '1'], ['bathrooms', '1'], ['maxGuests', '2'], ['description', 'A quiet home']]) fireEvent.change(screen.getByLabelText(l(`field.${key}`)), { target: { value } });
  fireEvent.change(screen.getByLabelText(l('field.descriptionLocale')), { target: { value: 'en' } });
  fireEvent.click(screen.getByRole('button', { name: l('submit') }));
  await screen.findByText(l('submitted'));
  const body = JSON.parse(String(mutations(fetchMock)[0][1]?.body));
  expect(body.status).toBe('submitted'); expect(body.draft.descriptionLocale).toBe('en');
  expect(screen.getByLabelText(l('field.unitName'))).toBeDisabled();
  expect(screen.queryByRole('button', { name: l('save') })).not.toBeInTheDocument();
  expect(screen.getByText(l('readonly'))).toBeInTheDocument();
});

it('warns before discarding edited inputs and keeps the current draft when declined', async () => {
  setup(); render(<CreationClient labels={{}} />); await start();
  fireEvent.change(screen.getByLabelText(l('field.unitName')), { target: { value: 'Keep this edit' } });
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  fireEvent.click(screen.getByRole('button', { name: l('new') }));
  expect(confirm).toHaveBeenCalledWith(l('discard'));
  expect(screen.getByLabelText(l('field.unitName'))).toHaveValue('Keep this edit');
  const before = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(before);
  expect(before.defaultPrevented).toBe(true);
});

it('preserves a loaded intake unit match without granting an existing-record edit control', async () => {
  const fetchMock = setup({ items: [saved({ draft: { ...unitDraft, existingUnitId: 'existing-unit' } })] });
  render(<CreationClient labels={{}} initialId="application-a" />);
  await screen.findByLabelText(l('field.unitName'));
  fireEvent.change(screen.getByLabelText(l('field.unitName')), { target: { value: 'New descriptive name' } });
  fireEvent.click(screen.getByRole('button', { name: l('save') })); await screen.findByText(l('saved'));
  expect(JSON.parse(String(mutations(fetchMock)[0][1]?.body)).draft.existingUnitId).toBe('existing-unit');
  expect(screen.queryByRole('link', { name: l('propose') })).not.toBeInTheDocument();
});

it('shows matched existing intake truthfully with no newly-created target link', async () => {
  setup({ items: [saved({ status: 'converted', matchedExisting: true, mayEdit: false })] });
  render(<CreationClient labels={{}} initialId="application-a" />);
  await screen.findByText(l('matched'));
  expect(screen.queryByText(l('status.converted'))).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: l('propose') })).not.toBeInTheDocument();
});

it('treats a mismatched successful mutation response as uncertain without replacing the current draft', async () => {
  setup({ override: (_url, init) => init.method === 'POST' ? response(saved({ spaceId: 'foreign-space', draft: { ...unitDraft, unitName: 'Other draft' } })) : undefined });
  render(<CreationClient labels={{}} />); await start();
  fireEvent.change(screen.getByLabelText(l('field.unitName')), { target: { value: 'Current draft' } });
  fireEvent.click(screen.getByRole('button', { name: l('save') })); await screen.findByText(l('error.uncertain'));
  expect(screen.getByLabelText(l('field.unitName'))).toHaveValue('Current draft');
  expect(screen.getByLabelText(l('field.unitName'))).toBeDisabled();
});
