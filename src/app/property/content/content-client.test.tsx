import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ContentClient from './content-client';
import { CONTENT_UI_LABELS } from './UI-labels';

const API = '/api/property-content-proposals';
const PUT_URL = 'https://vercel.com/api/blob/?pathname=media%2Fphoto.jpg&signature=synthetic';
const PHOTO_URL = 'https://store.public.blob.vercel-storage.com/media/photo.jpg';
const A = 'a1234567-1234-4123-8123-123456789abc';
const B = 'b1234567-1234-4123-8123-123456789abc';
const C = 'c1234567-1234-4123-8123-123456789abc';
const unitTarget = { scope: 'unit', id: 'managed-legendary-d201', projectId: 'project-1', name: 'D201', projectName: 'Legendary' };
const projectTarget = { scope: 'project', id: 'project-1', projectId: 'project-1', name: 'Legendary' };
const unitFacts = { name: 'D201', bedrooms: 2, bathrooms: 1, maxGuests: 0, sizeSqm: null, grossAreaSqm: null, floor: null, addressSupplement: '', amenityKeys: ['wifi'] };
const projectFacts = { name: 'Legendary', brand: null, address: '123 Road', city: null, district: null, projectType: null, totalUnits: null };
const gallery = () => ({ mediaIds: [A, B], coverMediaId: A });
const snapshot = (scope = 'unit') => ({ facts: scope === 'unit' ? { ...unitFacts } : { ...projectFacts }, descriptionKey: 'property.description', descriptions: { en: 'Existing English', th: 'คำอธิบายเดิม', ru: 'Русский текст' }, gallery: { ...gallery(), media: [{ id: A, url: '/media/a.jpg' }, { id: B, url: '/media/b.jpg' }] } });
const payload = (scope = 'unit') => ({ facts: scope === 'unit' ? { ...unitFacts } : { ...projectFacts }, description: null as null | { locale: string; value: string }, gallery: gallery() });
const detail = (status = 'draft', scope = 'unit') => ({ id: 'proposal-1', scope, targetId: scope === 'unit' ? unitTarget.id : projectTarget.id, projectId: 'project-1', status, revision: 2, baselineVersion: 'baseline-v1', baseline: snapshot(scope), proposal: payload(scope), reviewNote: status === 'returned' ? 'Please verify the area.' : null, media: [{ id: A, url: '/media/a.jpg' }, { id: B, url: '/media/b.jpg' }] });
const ok = (value: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => value }) as Response;
const label = (key: string) => CONTENT_UI_LABELS[`property.content.${key}`];

function setup(options: {
  saved?: ReturnType<typeof detail> | null;
  override?: (url: string, init: RequestInit) => Response | Promise<Response> | undefined;
} = {}) {
  let saved = options.saved ?? null;
  const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
    const overridden = options.override?.(url, init);
    if (overridden !== undefined) return overridden;
    if (url === API && (!init.method || init.method === 'GET')) {
      return ok({ targets: [unitTarget, projectTarget], items: saved ? [{ ...saved, targetName: saved.scope === 'unit' ? 'D201' : 'Legendary' }] : [] });
    }
    if (url.startsWith(`${API}/target?`)) {
      const scope = new URL(url, 'https://example.test').searchParams.get('scope');
      return ok({ target: scope === 'project' ? projectTarget : unitTarget, snapshot: snapshot(scope ?? 'unit'), baselineVersion: 'baseline-v1' });
    }
    if (url === `${API}/proposal-1` && !init.method) return ok(saved ?? detail());
    if (url === '/api/media/upload') {
      const body = JSON.parse(String(init.body));
      return body.action === 'initiate' ? ok({ intent: 'synthetic-intent', uploadUrl: PUT_URL, headers: { 'Content-Type': body.mimeType }, expiresAt: new Date(Date.now() + 60_000).toISOString() }, 201) : ok({ mediaAssetId: C, url: PHOTO_URL }, 201);
    }
    if (url === PUT_URL) return ok(null);
    if (init.method === 'POST' || init.method === 'PATCH') {
      const body = JSON.parse(String(init.body));
      const scope = body.scope ?? saved?.scope ?? 'unit';
      saved = { ...detail(body.status ?? 'draft', scope), revision: (saved?.revision ?? 0) + 1, proposal: body.action === 'rebase' ? payload(scope) : body.proposal };
      if (body.action === 'rebase') saved.baselineVersion = 'baseline-v2';
      return ok(saved, init.method === 'POST' ? 201 : 200);
    }
    throw new Error(`Unexpected request: ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

async function openTarget(scope = 'unit') {
  await waitFor(() => expect(screen.getByLabelText(label('target'))).toBeEnabled());
  fireEvent.change(screen.getByLabelText(label('target')), { target: { value: `${scope}:${scope === 'unit' ? unitTarget.id : projectTarget.id}` } });
  fireEvent.click(screen.getByRole('button', { name: label('new') }));
  await screen.findByLabelText(label(scope === 'unit' ? 'field.unitName' : 'field.name'));
  await waitFor(() => expect(screen.getByRole('button', { name: label('save') })).toBeEnabled());
}

const saveCalls = (fetchMock: ReturnType<typeof setup>) => fetchMock.mock.calls.filter(([url, init]) => url.startsWith(API) && ['POST', 'PATCH'].includes(init?.method ?? ''));

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('assigned-target content editor', () => {
  it('keeps legacy target 409 blocked and directs the contributor to administrator cleanup', async () => {
    const fetchMock = setup({ override: url => url.startsWith(`${API}/target?`) ? ok({ error: 'Legacy canonical state' }, 409) : undefined });
    render(<ContentClient labels={{}}/>);
    await waitFor(() => expect(screen.getByLabelText(label('target'))).toBeEnabled());
    fireEvent.change(screen.getByLabelText(label('target')), { target: { value: `unit:${unitTarget.id}` } });
    fireEvent.click(screen.getByRole('button', { name: label('new') }));
    await screen.findByText(label('target_unavailable'));
    expect(screen.queryByLabelText(label('field.unitName'))).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: label('save') })).not.toBeInTheDocument();
    expect(saveCalls(fetchMock)).toHaveLength(0);
  });

  it('loads only the contributor collection and exact selected target, with associated field labels', async () => {
    const fetchMock = setup();
    render(<ContentClient labels={{ 'property.content.title': 'Translated content title' }}/>);
    expect(screen.getByRole('heading', { level: 1, name: 'Translated content title' })).toBeInTheDocument();
    await openTarget();
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([API, `${API}/target?scope=unit&id=managed-legendary-d201`]);
    for (const key of ['name', 'bedrooms', 'bathrooms', 'maxGuests', 'sizeSqm', 'floor', 'addressSupplement', 'amenityKeys']) expect(screen.getByLabelText(label(`field.${key === 'name' ? 'unitName' : key}`))).toBeInTheDocument();
    expect(screen.getByLabelText(label('field.maxGuests'))).toHaveValue(0);
    expect(screen.queryByLabelText(/Owner|Manager|Price|Permissions/)).not.toBeInTheDocument();
  });

  it('creates a complete allowlisted draft tied to the loaded server baseline', async () => {
    const fetchMock = setup();
    render(<ContentClient labels={{}}/>);
    await openTarget();
    fireEvent.change(screen.getByLabelText(label('field.unitName')), { target: { value: '  New unit name  ' } });
    fireEvent.click(screen.getByRole('button', { name: label('save') }));
    await screen.findByText(label('saved'));
    const [url, init] = saveCalls(fetchMock)[0];
    expect(url).toBe(API); expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ scope: 'unit', targetId: unitTarget.id, baselineVersion: 'baseline-v1', proposal: { ...payload(), facts: { ...unitFacts, name: 'New unit name' } }, status: 'draft' });
    expect(saveCalls(fetchMock)).toHaveLength(1);
    expect(screen.getByLabelText(label('field.unitName'))).toHaveValue('New unit name');
  });

  it('edits the public-card gross area separately from integer fallback area', async () => {
    const fetchMock = setup(); render(<ContentClient labels={{}}/>); await openTarget();
    const gross = screen.getByLabelText(label('field.grossAreaSqm'));
    expect(gross).toHaveAttribute('step', '0.01');
    expect(screen.getByText(label('unit_name_hint'))).toBeInTheDocument();
    fireEvent.change(gross, { target: { value: '85.25' } });
    fireEvent.click(screen.getByRole('button', { name: label('save') }));
    await screen.findByText(label('saved'));
    expect(JSON.parse(String(saveCalls(fetchMock)[0][1].body)).proposal.facts).toMatchObject({ grossAreaSqm: 85.25, sizeSqm: null });
  });

  it('edits project fields and submits directly in one request', async () => {
    const fetchMock = setup(); render(<ContentClient labels={{}}/>); await openTarget('project');
    expect(screen.queryByLabelText(label('field.bedrooms'))).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(label('field.projectType')), { target: { value: 'resort' } });
    fireEvent.change(screen.getByLabelText(label('field.totalUnits')), { target: { value: '0' } });
    expect(screen.queryByLabelText(/Facilities/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: label('submit') }));
    await screen.findByText(label('submitted'));
    const body = JSON.parse(String(saveCalls(fetchMock)[0][1].body));
    expect(body).toMatchObject({ scope: 'project', targetId: 'project-1', status: 'submitted', proposal: { facts: { ...projectFacts, projectType: 'resort', totalUnits: 0 } } });
    expect(body.proposal.facts).not.toHaveProperty('facilities');
    expect(saveCalls(fetchMock)).toHaveLength(1);
    expect(screen.getByRole('button', { name: label('save') })).toBeDisabled();
  });

  it('requires explicit description opt-in and keeps the selected locale separate from interface locale', async () => {
    const fetchMock = setup(); render(<ContentClient labels={{}} initialLocale="ru"/>); await openTarget();
    expect(screen.getByLabelText(label('description_enabled'))).not.toBeChecked();
    expect(screen.queryByLabelText(label('description_value'))).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(label('description_enabled')));
    expect(screen.getByLabelText(label('description_locale'))).toHaveValue('ru');
    fireEvent.change(screen.getByLabelText(label('description_locale')), { target: { value: 'th' } });
    expect(screen.getByLabelText(label('description_value'))).toHaveValue('คำอธิบายเดิม');
    fireEvent.change(screen.getByLabelText(label('description_value')), { target: { value: 'Explicitly tagged Thai text' } });
    fireEvent.click(screen.getByRole('button', { name: label('save') }));
    await screen.findByText(label('saved'));
    expect(JSON.parse(String(saveCalls(fetchMock)[0][1].body)).proposal.description).toEqual({ locale: 'th', value: 'Explicitly tagged Thai text' });
  });

  it('preserves resumed description locale, shows returned feedback and sends exact revision on correction', async () => {
    const saved = detail('returned');
    saved.proposal.description = { locale: 'th', value: 'Saved Thai draft' };
    saved.proposal.gallery.mediaIds.push(C); saved.media.push({ id: C, url: '/media/c.jpg' });
    const fetchMock = setup({ saved });
    render(<ContentClient labels={{}} initialLocale="ru" initialProposalId="proposal-1"/>);
    await screen.findByText('Please verify the area.');
    expect(screen.getByLabelText(label('description_locale'))).toHaveValue('th');
    expect(screen.getByLabelText(label('description_value'))).toHaveValue('Saved Thai draft');
    expect(screen.getByAltText(`${label('photo')} 3`)).toHaveAttribute('src', '/media/c.jpg');
    fireEvent.change(screen.getByLabelText(label('field.sizeSqm')), { target: { value: '85' } });
    fireEvent.click(screen.getByRole('button', { name: label('submit') }));
    await screen.findByText(label('submitted'));
    const [url, init] = saveCalls(fetchMock)[0];
    expect(url).toBe(`${API}/proposal-1`);
    expect(init.method).toBe('PATCH');
    expect(Object.keys(JSON.parse(String(init.body))).sort()).toEqual(['expectedRevision', 'proposal', 'status']);
    expect(JSON.parse(String(init.body))).toMatchObject({ expectedRevision: 2, status: 'submitted', proposal: { facts: { sizeSqm: 85 }, description: { locale: 'th' } } });
  });

  it.each(['submitted', 'approved'])('keeps a %s proposal read-only', async status => {
    const fetchMock = setup({ saved: detail(status) });
    render(<ContentClient labels={{}} initialProposalId="proposal-1"/>);
    await screen.findByText(label('read_only'));
    expect(screen.getByLabelText(label('field.unitName'))).toBeDisabled();
    for (const action of ['save', 'submit', 'refresh']) expect(screen.getByRole('button', { name: label(action) })).toBeDisabled();
    expect(screen.getByLabelText(label('upload'))).toBeDisabled();
    expect(saveCalls(fetchMock)).toHaveLength(0);
  });

  it('keeps 409 edits intact and rebases only after explicit confirmation', async () => {
    let fail = true;
    const fetchMock = setup({ saved: detail(), override: (url, init) => url === `${API}/proposal-1` && init.method === 'PATCH' && !String(init.body).includes('rebase') && fail ? ok({ error: 'internal secret' }, 409) : undefined });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<ContentClient labels={{}} initialProposalId="proposal-1"/>);
    await screen.findByLabelText(label('field.unitName'));
    fireEvent.change(screen.getByLabelText(label('field.unitName')), { target: { value: 'Unsaved conflict edit' } });
    fireEvent.click(screen.getByRole('button', { name: label('save') }));
    await screen.findByText(label('conflict'));
    expect(screen.getByLabelText(label('field.unitName'))).toHaveValue('Unsaved conflict edit');
    expect(screen.queryByText('internal secret')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: label('refresh') }));
    expect(confirm).toHaveBeenCalledWith(label('refresh_confirm'));
    expect(saveCalls(fetchMock)).toHaveLength(1);
    fail = false; confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: label('refresh') }));
    await screen.findByText(label('rebased'));
    expect(JSON.parse(String(saveCalls(fetchMock)[1][1].body))).toEqual({ expectedRevision: 2, action: 'rebase' });
    expect(screen.getByLabelText(label('field.unitName'))).toHaveValue('D201');
  });

  it('refreshes an unsaved proposal through a target read only after confirmation', async () => {
    const fetchMock = setup(); const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<ContentClient labels={{}}/>); await openTarget();
    fireEvent.change(screen.getByLabelText(label('field.unitName')), { target: { value: 'Discard me' } });
    fireEvent.click(screen.getByRole('button', { name: label('refresh') }));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: label('refresh') }));
    await screen.findByText(label('rebased'));
    expect(screen.getByLabelText(label('field.unitName'))).toHaveValue('D201');
    expect(saveCalls(fetchMock)).toHaveLength(0);
  });

  it('protects unsaved edits when changing the target', async () => {
    const fetchMock = setup(); const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<ContentClient labels={{}}/>); await openTarget();
    fireEvent.change(screen.getByLabelText(label('field.unitName')), { target: { value: 'Keep me' } });
    fireEvent.change(screen.getByLabelText(label('target')), { target: { value: 'project:project-1' } });
    fireEvent.click(screen.getByRole('button', { name: label('new') }));
    expect(screen.getByLabelText(label('field.unitName'))).toHaveValue('Keep me');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: label('new') }));
    await screen.findByLabelText(label('field.address'));
    expect(screen.getByLabelText(label('field.name'))).toHaveValue('Legendary');
    expect(saveCalls(fetchMock)).toHaveLength(0);
  });

  it('edits gallery order, cover and removal locally until a proposal save', async () => {
    const fetchMock = setup(); render(<ContentClient labels={{}}/>); await openTarget();
    fireEvent.click(screen.getByRole('button', { name: `${label('move_up')} 2` }));
    fireEvent.click(screen.getByRole('button', { name: `${label('make_cover')} 1` }));
    fireEvent.click(screen.getByRole('button', { name: `${label('remove')} 2` }));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('button', { name: label('save') }));
    await screen.findByText(label('saved'));
    expect(JSON.parse(String(saveCalls(fetchMock)[0][1].body)).proposal.gallery).toEqual({ mediaIds: [B], coverMediaId: B });
    expect(fetchMock.mock.calls.every(([url]) => !url.includes('/api/admin/'))).toBe(true);
  });

  it('uploads an owned photo directly with scoped JSON registration and keeps attachment changes in the proposal', async () => {
    const fetchMock = setup(); render(<ContentClient labels={{}}/>); await openTarget();
    const file = new File(['photo'], 'photo.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByLabelText(label('upload')), { target: { files: [file] } });
    await screen.findByAltText(`${label('photo')} 3`);
    const [, init] = fetchMock.mock.calls.find(([url]) => url === '/api/media/upload')!;
    expect(init.method).toBe('POST'); expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(String(init.body))).toEqual({ action: 'initiate', scope: 'unit', targetId: unitTarget.id, mimeType: file.type, sizeBytes: file.size });
    const [, put] = fetchMock.mock.calls.find(([url]) => url === PUT_URL)!;
    expect(put.method).toBe('PUT'); expect(put.body).toBe(file); expect(put.credentials).toBe('omit');
    const finalize = fetchMock.mock.calls.filter(([url]) => url === '/api/media/upload')[1][1];
    expect(JSON.parse(String(finalize.body))).toEqual({ action: 'finalize', intent: 'synthetic-intent' });
    expect(saveCalls(fetchMock)).toHaveLength(0);
    await waitFor(() => expect(screen.getByRole('button', { name: label('save') })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: label('save') }));
    await screen.findByText(label('saved'));
    expect(JSON.parse(String(saveCalls(fetchMock)[0][1].body)).proposal.gallery.mediaIds).toEqual([A, B, C]);
  });

  it('rejects invalid file types and oversized files without upload calls', async () => {
    const fetchMock = setup(); render(<ContentClient labels={{}}/>); await openTarget();
    for (const file of [new File(['x'], 'file.svg', { type: 'image/svg+xml' }), new File([new Uint8Array(8 * 1024 * 1024 + 1)], 'large.jpg', { type: 'image/jpeg' })]) {
      fireEvent.change(screen.getByLabelText(label('upload')), { target: { files: [file] } });
      expect(screen.getByText(label('upload_invalid'))).toBeInTheDocument();
    }
    expect(fetchMock.mock.calls.some(([url]) => url === '/api/media/upload')).toBe(false);
  });

  it('retains successful photos after a partial upload failure and allows retry', async () => {
    let count = 0;
    const fetchMock = setup({ override: (url, init) => url === '/api/media/upload' && JSON.parse(String(init.body)).action === 'initiate' && ++count === 2 ? ok({}, 500) : undefined });
    render(<ContentClient labels={{}}/>); await openTarget();
    const files = ['one.jpg', 'two.jpg'].map(name => new File(['photo'], name, { type: 'image/jpeg' }));
    fireEvent.change(screen.getByLabelText(label('upload')), { target: { files } });
    await screen.findByText(label('upload_partial'));
    expect(screen.getByAltText(`${label('photo')} 3`)).toBeInTheDocument();
    expect(screen.getByLabelText(label('upload'))).toBeEnabled();
    expect(fetchMock.mock.calls.filter(([url]) => url === '/api/media/upload')).toHaveLength(3);
  });

  it('blocks writes after a grant is revoked and reloads current assignments', async () => {
    const fetchMock = setup({ override: (url, init) => url === API && init.method === 'POST' ? ok({}, 403) : undefined });
    render(<ContentClient labels={{}}/>); await openTarget();
    fireEvent.click(screen.getByRole('button', { name: label('save') }));
    await screen.findByText(label('forbidden'));
    expect(screen.getByLabelText(label('field.unitName'))).toBeDisabled();
    expect(screen.getByRole('button', { name: label('submit') })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: label('retry') }));
    await waitFor(() => expect(fetchMock.mock.calls.filter(([url, init]) => url === API && !init.method)).toHaveLength(2));
  });

  it('blocks duplicate creation after an unconfirmed save response until the stored proposal is reopened', async () => {
    let failed = false;
    const fetchMock = setup({ saved: detail(), override: (url, init) => {
      if (url === API && init.method === 'POST') { failed = true; return Promise.reject(new TypeError('connection lost')); }
      return undefined;
    } });
    render(<ContentClient labels={{}}/>); await openTarget();
    fireEvent.click(screen.getByRole('button', { name: label('save') }));
    await screen.findByText(label('save_uncertain'));
    expect(failed).toBe(true);
    expect(screen.getByRole('button', { name: label('save') })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: `${label('open')}: D201` }));
    await waitFor(() => expect(screen.getByRole('button', { name: label('save') })).toBeEnabled());
    expect(saveCalls(fetchMock)).toHaveLength(1);
  });

  it('locks repeated save clicks until the first response is confirmed', async () => {
    let resolve!: (response: Response) => void;
    const pending = new Promise<Response>(done => { resolve = done; });
    const fetchMock = setup({ override: (url, init) => url === API && init.method === 'POST' ? pending : undefined });
    render(<ContentClient labels={{}}/>); await openTarget();
    const button = screen.getByRole('button', { name: label('save') });
    fireEvent.click(button); fireEvent.click(button);
    expect(saveCalls(fetchMock)).toHaveLength(1);
    expect(button).toBeDisabled(); expect(screen.getByLabelText(label('target'))).toBeDisabled();
    expect(screen.getByLabelText(label('upload'))).toBeDisabled();
    resolve(ok(detail()));
    await screen.findByText(label('saved'));
  });

  it('recovers from an initial list failure using the actual retry request', async () => {
    let first = true;
    const fetchMock = setup({ override: url => { if (url === API && first) { first = false; return ok({}, 500); } return undefined; } });
    render(<ContentClient labels={{}}/>);
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: label('retry') }));
    await waitFor(() => expect(screen.getByLabelText(label('target'))).toBeEnabled());
    expect(fetchMock.mock.calls.filter(([url]) => url === API)).toHaveLength(2);
    expect(screen.getByRole('option', { name: /D201/ })).toBeInTheDocument();
  });

  it('validates duplicate list entries before sending a draft', async () => {
    const fetchMock = setup(); render(<ContentClient labels={{}}/>); await openTarget();
    fireEvent.change(screen.getByLabelText(label('field.amenityKeys')), { target: { value: 'wifi\n wifi ' } });
    fireEvent.click(screen.getByRole('button', { name: label('save') }));
    expect(screen.getByText(label('validation'))).toBeInTheDocument();
    expect(saveCalls(fetchMock)).toHaveLength(0);
  });

  it('blocks uploads that would exceed the 200-photo gallery cap', async () => {
    const saved = detail();
    saved.proposal.gallery.mediaIds = Array.from({ length: 200 }, (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`);
    saved.proposal.gallery.coverMediaId = saved.proposal.gallery.mediaIds[0];
    const fetchMock = setup({ saved });
    render(<ContentClient labels={{}} initialProposalId="proposal-1"/>);
    await screen.findByLabelText(label('upload'));
    fireEvent.change(screen.getByLabelText(label('upload')), { target: { files: [new File(['x'], 'photo.jpg', { type: 'image/jpeg' })] } });
    expect(screen.getByText(label('upload_invalid'))).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => url === '/api/media/upload')).toBe(false);
  });

  it('blocks repeated rebase after an unconfirmed write response', async () => {
    const fetchMock = setup({ saved: detail(), override: (_url, init) => init.method === 'PATCH' && String(init.body).includes('rebase') ? Promise.reject(new TypeError('connection lost')) : undefined });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<ContentClient labels={{}} initialProposalId="proposal-1"/>);
    await screen.findByLabelText(label('field.unitName'));
    fireEvent.click(screen.getByRole('button', { name: label('refresh') }));
    await screen.findByText(label('save_uncertain'));
    expect(screen.getByRole('button', { name: label('refresh') })).toBeDisabled();
    expect(screen.getByRole('button', { name: label('save') })).toBeDisabled();
    expect(saveCalls(fetchMock)).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: label('retry') }));
    await waitFor(() => expect(screen.getByText(label('save_uncertain'))).toBeInTheDocument());
  });

  it('can explicitly leave every description unchanged when revising a resumed draft', async () => {
    const saved = detail(); saved.proposal.description = { locale: 'en', value: 'Draft prose' };
    const fetchMock = setup({ saved });
    render(<ContentClient labels={{}} initialProposalId="proposal-1"/>);
    await screen.findByLabelText(label('description_enabled'));
    fireEvent.click(screen.getByLabelText(label('description_enabled')));
    fireEvent.click(screen.getByRole('button', { name: label('save') }));
    await screen.findByText(label('saved'));
    expect(JSON.parse(String(saveCalls(fetchMock)[0][1].body)).proposal.description).toBeNull();
  });

  it('aborts reads on unmount and does not update an abandoned editor', async () => {
    const fetchMock = setup({ override: () => new Promise<Response>(() => {}) });
    const view = render(<ContentClient labels={{}}/>);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const signal = fetchMock.mock.calls[0][1].signal;
    view.unmount();
    expect(signal?.aborted).toBe(true);
  });
});

const amenitySnapshot = {
  id: 'facility-pool', name: 'Main pool', shortDescription: 'Outdoor pool', description: 'Original pool details\nSecond line',
  locationLabel: 'Roof / floor 4', accessInstructions: 'Use your resident card',
  openingHours: { monday: [['07:00', '12:00'], ['15:00', '20:00']], timezone: 'Asia/Bangkok' },
  rules: { safety: ['No diving', 'Children need supervision'] },
  translations: { en: { name: 'Main pool' }, ru: { name: 'Главный бассейн', description: 'Русское описание' } },
};
const secondAmenity = { ...amenitySnapshot, id: 'facility-gym', name: 'Gym', translations: {}, openingHours: { daily: [['06:00', '23:00']] }, rules: ['Wear sports shoes'] };
const amenityProposal = {
  id: 'facility-pool', locale: 'en' as const, name: 'Main pool', shortDescription: 'Outdoor pool', description: 'Original pool details\nSecond line',
  locationLabel: 'Roof / floor 4', accessInstructions: 'Use your resident card', openingHours: { mode: 'keep' as const }, rules: { mode: 'keep' as const },
};
function setupAmenities(options: { saved?: ReturnType<typeof detail>; baseline?: unknown[]; rejectSave?: boolean } = {}) {
  const baseline = options.baseline ?? [amenitySnapshot, secondAmenity];
  return setup({ saved: options.saved, override: (url, init) => {
    if (url.startsWith(`${API}/target?`) && url.includes('scope=project')) return ok({ target: projectTarget, snapshot: { ...snapshot('project'), amenities: baseline }, baselineVersion: 'baseline-v2' });
    if (['POST', 'PATCH'].includes(init.method ?? '') && url.startsWith(API)) {
      if (options.rejectSave) return ok({}, 409);
      const body = JSON.parse(String(init.body));
      return ok({ ...detail(body.status, 'project'), baselineVersion: 'baseline-v2', baseline: { ...snapshot('project'), amenities: baseline }, proposal: body.action === 'rebase' ? payload('project') : body.proposal });
    }
    return undefined;
  } });
}

describe('project facility proposals', () => {
  it('exposes facilities only for projects and requires explicit selection of existing rows', async () => {
    const fetchMock = setupAmenities(); render(<ContentClient labels={{}}/>); await openTarget();
    expect(screen.queryByText(label('amenities.title'))).not.toBeInTheDocument();
    await openTarget('project');
    expect(screen.getByText(label('amenities.review_hint'))).toBeInTheDocument();
    expect(screen.queryByLabelText(label('amenities.name'))).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: label('save') }));
    await screen.findByText(label('saved'));
    expect(JSON.parse(String(saveCalls(fetchMock)[0][1].body)).proposal).not.toHaveProperty('amenities');
  });

  it('submits only the selected existing facility and preserves custom schedule and rules by default', async () => {
    const fetchMock = setupAmenities(); render(<ContentClient labels={{}}/>); await openTarget('project');
    fireEvent.click(screen.getByRole('button', { name: `${label('amenities.edit')}: Main pool` }));
    expect(screen.getByLabelText(label('amenities.hours'))).toHaveValue('keep');
    expect(screen.getByLabelText(label('amenities.rules'))).toHaveValue('keep');
    expect(screen.getByText(label('amenities.custom_hours'))).toBeInTheDocument();
    expect(screen.getByText(label('amenities.custom_rules'))).toBeInTheDocument();
    expect(screen.queryByLabelText(/JSON|booking|capacity|price|slug|publish/i, { selector: 'input, select, textarea' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(label('amenities.locationLabel')), { target: { value: 'Pool deck / floor 5' } });
    fireEvent.click(screen.getByText(label('amenities.compare')));
    expect(screen.getAllByText('monday: 07:00–12:00')).toHaveLength(2);
    expect(screen.getAllByText('safety: No diving')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: label('save') }));
    await screen.findByText(label('saved'));
    expect(JSON.parse(String(saveCalls(fetchMock)[0][1].body)).proposal.amenities).toEqual([{ ...amenityProposal, description: 'Русское описание', locationLabel: 'Pool deck / floor 5' }]);
  });

  it('creates a new unpublished proposal using normal time controls, explicit all-day and plain text rules', async () => {
    const fetchMock = setupAmenities({ baseline: [] }); render(<ContentClient labels={{}} initialLocale="ru"/>); await openTarget('project');
    fireEvent.click(screen.getByRole('button', { name: label('amenities.add') }));
    expect(screen.getByLabelText(label('amenities.locale'))).toHaveValue('ru');
    fireEvent.change(screen.getByLabelText(label('amenities.name')), { target: { value: 'Сауна' } });
    fireEvent.change(screen.getByLabelText(label('amenities.description')), { target: { value: 'Первая строка\nВторая строка' } });
    fireEvent.change(screen.getByLabelText(label('amenities.locationLabel')), { target: { value: 'Этаж 2' } });
    fireEvent.change(screen.getByLabelText(label('amenities.accessInstructions')), { target: { value: 'Обратитесь на стойку' } });
    fireEvent.change(screen.getByLabelText(label('amenities.hours')), { target: { value: 'daily' } });
    expect(screen.getByLabelText(label('amenities.open'))).toHaveAttribute('type', 'time');
    expect(screen.getByLabelText(label('amenities.timezone'))).toHaveValue('');
    fireEvent.click(screen.getByLabelText(label('amenities.all_day')));
    expect(screen.getByLabelText(label('amenities.open'))).toBeDisabled();
    fireEvent.change(screen.getByLabelText(label('amenities.rules')), { target: { value: 'replace' } });
    fireEvent.change(screen.getByLabelText(label('amenities.rules_lines')), { target: { value: '  Чистая обувь  \n\nБез стекла\n' } });
    fireEvent.click(screen.getByRole('button', { name: label('submit') }));
    await screen.findByText(label('submitted'));
    const proposed = JSON.parse(String(saveCalls(fetchMock)[0][1].body)).proposal.amenities;
    expect(proposed).toEqual([{ id: null, locale: 'ru', name: 'Сауна', shortDescription: null, description: 'Первая строка\nВторая строка', locationLabel: 'Этаж 2', accessInstructions: 'Обратитесь на стойку', openingHours: { mode: 'daily', open: '00:00', close: '24:00', timezone: null }, rules: { mode: 'replace', lines: ['Чистая обувь', 'Без стекла'] } }]);
    expect(screen.getByLabelText(label('amenities.name'))).toBeDisabled();
    expect(screen.getByRole('button', { name: label('amenities.add') })).toBeDisabled();
  });

  it('permits overnight schedules and never invents the time zone', async () => {
    const fetchMock = setupAmenities(); render(<ContentClient labels={{}}/>); await openTarget('project');
    fireEvent.click(screen.getByRole('button', { name: `${label('amenities.edit')}: Gym` }));
    fireEvent.change(screen.getByLabelText(label('amenities.hours')), { target: { value: 'daily' } });
    expect(screen.getByLabelText(label('amenities.open'))).toHaveValue('06:00');
    fireEvent.change(screen.getByLabelText(label('amenities.open')), { target: { value: '22:00' } });
    fireEvent.change(screen.getByLabelText(label('amenities.close')), { target: { value: '02:00' } });
    fireEvent.click(screen.getByRole('button', { name: label('save') })); await screen.findByText(label('saved'));
    expect(JSON.parse(String(saveCalls(fetchMock)[0][1].body)).proposal.amenities[0].openingHours).toEqual({ mode: 'daily', open: '22:00', close: '02:00', timezone: null });
  });

  it('blocks equal times and excessive rule lines without a request or lost edits', async () => {
    const fetchMock = setupAmenities(); render(<ContentClient labels={{}}/>); await openTarget('project');
    fireEvent.click(screen.getByRole('button', { name: `${label('amenities.edit')}: Gym` }));
    fireEvent.change(screen.getByLabelText(label('amenities.hours')), { target: { value: 'daily' } });
    fireEvent.change(screen.getByLabelText(label('amenities.close')), { target: { value: '06:00' } });
    fireEvent.click(screen.getByRole('button', { name: label('save') }));
    expect(screen.getByRole('alert')).toHaveTextContent(label('validation'));
    expect(saveCalls(fetchMock)).toHaveLength(0);
    expect(screen.getByLabelText(label('amenities.name'))).toHaveValue('Gym');
    fireEvent.change(screen.getByLabelText(label('amenities.hours')), { target: { value: 'keep' } });
    fireEvent.change(screen.getByLabelText(label('amenities.rules')), { target: { value: 'replace' } });
    fireEvent.change(screen.getByLabelText(label('amenities.rules_lines')), { target: { value: Array.from({ length: 51 }, (_, i) => `Rule ${i}`).join('\n') } });
    fireEvent.click(screen.getByRole('button', { name: label('save') }));
    expect(saveCalls(fetchMock)).toHaveLength(0);
    expect(screen.getByLabelText(label('amenities.rules_lines'))).toHaveValue(Array.from({ length: 51 }, (_, i) => `Rule ${i}`).join('\n'));
  });

  it('loads locale fallbacks and retains entered unsaved text while switching facility languages', async () => {
    const fetchMock = setupAmenities(); render(<ContentClient labels={{}} initialLocale="ru"/>); await openTarget('project');
    fireEvent.click(screen.getByRole('button', { name: `${label('amenities.edit')}: Главный бассейн` }));
    expect(screen.getByLabelText(label('amenities.name'))).toHaveValue('Главный бассейн');
    expect(screen.getByLabelText(label('amenities.description'))).toHaveValue('Русское описание');
    fireEvent.change(screen.getByLabelText(label('amenities.name')), { target: { value: 'Новый бассейн' } });
    fireEvent.change(screen.getByLabelText(label('amenities.locale')), { target: { value: 'en' } });
    expect(screen.getByLabelText(label('amenities.name'))).toHaveValue('Main pool');
    fireEvent.change(screen.getByLabelText(label('amenities.name')), { target: { value: 'New pool name' } });
    fireEvent.change(screen.getByLabelText(label('amenities.locale')), { target: { value: 'th' } });
    expect(screen.getByLabelText(label('amenities.name'))).toHaveValue('Main pool');
    fireEvent.change(screen.getByLabelText(label('amenities.locale')), { target: { value: 'ru' } });
    expect(screen.getByLabelText(label('amenities.name'))).toHaveValue('Новый бассейн');
    fireEvent.change(screen.getByLabelText(label('amenities.locale')), { target: { value: 'en' } });
    expect(screen.getByLabelText(label('amenities.name'))).toHaveValue('New pool name');
    fireEvent.click(screen.getByRole('button', { name: label('save') })); await screen.findByText(label('saved'));
    const proposed = JSON.parse(String(saveCalls(fetchMock)[0][1].body)).proposal.amenities[0];
    expect(proposed).toMatchObject({ locale: 'en', name: 'New pool name', description: 'Русское описание' });
    expect(proposed).not.toHaveProperty('textsByLocale');
    expect(proposed).not.toHaveProperty('translations');
  });

  it('discarding an existing facility proposal removes only its proposed change', async () => {
    const fetchMock = setupAmenities(); render(<ContentClient labels={{}}/>); await openTarget('project');
    fireEvent.click(screen.getByRole('button', { name: `${label('amenities.edit')}: Gym` }));
    fireEvent.click(screen.getByRole('button', { name: label('amenities.discard_change') }));
    expect(screen.getByRole('button', { name: `${label('amenities.edit')}: Gym` })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: label('save') })); await screen.findByText(label('saved'));
    expect(JSON.parse(String(saveCalls(fetchMock)[0][1].body)).proposal.amenities).toEqual([]);
  });

  it('keeps an older project proposal editable without adding amenities until explicit rebase', async () => {
    const saved = detail('returned', 'project'); const fetchMock = setupAmenities({ saved });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<ContentClient labels={{}} initialProposalId="proposal-1"/>);
    await screen.findByText(label('amenities.legacy_baseline'));
    expect(screen.queryByRole('button', { name: label('amenities.add') })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(label('field.address')), { target: { value: 'Updated address' } });
    fireEvent.click(screen.getByRole('button', { name: label('save') })); await screen.findByText(label('saved'));
    expect(JSON.parse(String(saveCalls(fetchMock)[0][1].body)).proposal).not.toHaveProperty('amenities');
    fireEvent.click(screen.getByRole('button', { name: label('refresh') })); await screen.findByText(label('rebased'));
    expect(screen.getByRole('button', { name: label('amenities.add') })).toBeEnabled();
    expect(JSON.parse(String(saveCalls(fetchMock)[1][1].body))).toEqual({ expectedRevision: 2, action: 'rebase' });
  });

  it('preserves resumed facility changes and keeps conflicts and dirty-navigation guards intact', async () => {
    const saved = { ...detail('returned', 'project'), baseline: { ...snapshot('project'), amenities: [amenitySnapshot, secondAmenity] }, proposal: { ...payload('project'), amenities: [{ ...amenityProposal, name: 'Saved name' }] } };
    const fetchMock = setupAmenities({ saved, rejectSave: true }); const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<ContentClient labels={{}} initialProposalId="proposal-1"/>); await screen.findByLabelText(label('amenities.name'));
    expect(screen.getByLabelText(label('amenities.name'))).toHaveValue('Saved name');
    fireEvent.change(screen.getByLabelText(label('amenities.name')), { target: { value: 'Unsaved facility edit' } });
    fireEvent.click(screen.getByRole('button', { name: label('save') })); await screen.findByText(label('conflict'));
    expect(screen.getByLabelText(label('amenities.name'))).toHaveValue('Unsaved facility edit');
    fireEvent.change(screen.getByLabelText(label('target')), { target: { value: `unit:${unitTarget.id}` } });
    fireEvent.click(screen.getByRole('button', { name: label('new') }));
    expect(confirm).toHaveBeenCalledWith(label('discard_confirm'));
    expect(screen.getByLabelText(label('amenities.name'))).toHaveValue('Unsaved facility edit');
    expect(saveCalls(fetchMock)).toHaveLength(1);
  });

  it('keeps existing access instructions up to the canonical 4000-character limit editable', async () => {
    const accessInstructions = 'a'.repeat(3500);
    const fetchMock = setupAmenities({ baseline: [{ ...amenitySnapshot, accessInstructions }] });
    render(<ContentClient labels={{}}/>); await openTarget('project');
    fireEvent.click(screen.getByRole('button', { name: `${label('amenities.edit')}: Main pool` }));
    expect(screen.getByLabelText(label('amenities.accessInstructions'))).toHaveValue(accessInstructions);
    expect(screen.getByLabelText(label('amenities.accessInstructions'))).toHaveAttribute('maxlength', '4000');
    fireEvent.click(screen.getByRole('button', { name: label('save') })); await screen.findByText(label('saved'));
    expect(JSON.parse(String(saveCalls(fetchMock)[0][1].body)).proposal.amenities[0].accessInstructions).toBe(accessInstructions);
  });

  it.each(['07:00–20:00', [['07:00', '20:00']]])('keeps unsupported legacy hours and disables an unsafe daily edit: %j', async openingHours => {
    const fetchMock = setupAmenities({ baseline: [{ ...amenitySnapshot, openingHours }] });
    render(<ContentClient labels={{}}/>); await openTarget('project');
    fireEvent.click(screen.getByRole('button', { name: `${label('amenities.edit')}: Main pool` }));
    expect(screen.getByRole('option', { name: label('amenities.replace_hours') })).toBeDisabled();
    expect(screen.getByText(label('amenities.unsupported_hours'))).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(label('amenities.hours')), { target: { value: 'daily' } });
    expect(screen.getByLabelText(label('amenities.hours'))).toHaveValue('keep');
    fireEvent.click(screen.getByRole('button', { name: label('save') })); await screen.findByText(label('saved'));
    expect(JSON.parse(String(saveCalls(fetchMock)[0][1].body)).proposal.amenities[0].openingHours).toEqual({ mode: 'keep' });
  });


  it('retains end-of-day 24:00 for daily and staff controls on an unchanged round trip', async () => {
    const openingHours = { daily: [['18:00', '24:00']], staffContact: [['09:00', '24:00']], timezone: 'Asia/Bangkok' };
    const fetchMock = setupAmenities({ baseline: [{ ...amenitySnapshot, openingHours }] });
    render(<ContentClient labels={{}}/>); await openTarget('project');
    fireEvent.click(screen.getByRole('button', { name: `${label('amenities.edit')}: Main pool` }));
    fireEvent.change(screen.getByLabelText(label('amenities.hours')), { target: { value: 'daily' } });
    fireEvent.change(screen.getByLabelText(label('amenities.staff_hours')), { target: { value: 'range' } });
    expect(screen.getByLabelText(label('amenities.close'))).toHaveValue('00:00');
    expect(screen.getByLabelText(label('amenities.staff_close'))).toHaveValue('00:00');
    expect(screen.getByLabelText(label('amenities.all_day'))).not.toBeChecked();
    expect(screen.getByLabelText(label('amenities.staff_all_day'))).not.toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: label('save') })); await screen.findByText(label('saved'));
    expect(JSON.parse(String(saveCalls(fetchMock)[0][1].body)).proposal.amenities[0]).toMatchObject({ openingHours: { mode: 'daily', open: '18:00', close: '24:00', timezone: 'Asia/Bangkok' }, staffHours: { mode: 'range', open: '09:00', close: '24:00' } });
    expect(openingHours).toEqual({ daily: [['18:00', '24:00']], staffContact: [['09:00', '24:00']], timezone: 'Asia/Bangkok' });
  });

  it('edits staff hours independently while preserving weekly/split access schedules', async () => {
    const openingHours = { weekly: { monday: [['07:00', '12:00'], ['15:00', '20:00']] }, staffContact: [['09:00', '17:00']], timezone: 'Asia/Bangkok' };
    const fetchMock = setupAmenities({ baseline: [{ ...amenitySnapshot, openingHours }] });
    render(<ContentClient labels={{}}/>); await openTarget('project');
    fireEvent.click(screen.getByRole('button', { name: `${label('amenities.edit')}: Main pool` }));
    expect(screen.getByLabelText(label('amenities.staff_hours'))).toHaveValue('keep');
    fireEvent.change(screen.getByLabelText(label('amenities.staff_hours')), { target: { value: 'range' } });
    fireEvent.change(screen.getByLabelText(label('amenities.staff_open')), { target: { value: '10:00' } });
    fireEvent.change(screen.getByLabelText(label('amenities.staff_close')), { target: { value: '18:00' } });
    fireEvent.click(screen.getByText(label('amenities.compare')));
    const proposed = screen.getByRole('region', { name: label('amenities.after') });
    expect(within(proposed).getByText('weekly: monday: 07:00–12:00')).toBeInTheDocument();
    expect(within(proposed).getByText('weekly: monday: 15:00–20:00')).toBeInTheDocument();
    expect(within(proposed).getByText(`${label('amenities.staff_hours')}: 10:00–18:00`)).toBeInTheDocument();
    expect(within(proposed).getByText(`${label('amenities.timezone')}: Asia/Bangkok`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: label('save') })); await screen.findByText(label('saved'));
    expect(JSON.parse(String(saveCalls(fetchMock)[0][1].body)).proposal.amenities[0]).toMatchObject({ openingHours: { mode: 'keep' }, staffHours: { mode: 'range', open: '10:00', close: '18:00' } });
  });

  it('clears access and staff hours independently and previews their exact shared result', async () => {
    const openingHours = { daily: [['07:00', '20:00']], staffContact: [['09:00', '17:00']], timezone: 'Asia/Bangkok' };
    const fetchMock = setupAmenities({ baseline: [{ ...amenitySnapshot, openingHours }] });
    render(<ContentClient labels={{}}/>); await openTarget('project');
    fireEvent.click(screen.getByRole('button', { name: `${label('amenities.edit')}: Main pool` }));
    fireEvent.change(screen.getByLabelText(label('amenities.hours')), { target: { value: 'clear' } });
    fireEvent.click(screen.getByText(label('amenities.compare')));
    let proposed = screen.getByRole('region', { name: label('amenities.after') });
    expect(within(proposed).queryByText(`${label('amenities.daily')}: 07:00–20:00`)).not.toBeInTheDocument();
    expect(within(proposed).getByText(`${label('amenities.staff_hours')}: 09:00–17:00`)).toBeInTheDocument();
    expect(within(proposed).getByText(`${label('amenities.timezone')}: Asia/Bangkok`)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(label('amenities.staff_hours')), { target: { value: 'clear' } });
    proposed = screen.getByRole('region', { name: label('amenities.after') });
    expect(within(proposed).queryByText(`${label('amenities.staff_hours')}: 09:00–17:00`)).not.toBeInTheDocument();
    expect(within(proposed).queryByText(`${label('amenities.timezone')}: Asia/Bangkok`)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: label('save') })); await screen.findByText(label('saved'));
    expect(JSON.parse(String(saveCalls(fetchMock)[0][1].body)).proposal.amenities[0]).toMatchObject({ openingHours: { mode: 'clear' }, staffHours: { mode: 'clear' } });
  });

  it('requires clearing incompatible legacy access data before editing or clearing staff hours', async () => {
    const fetchMock = setupAmenities({ baseline: [{ ...amenitySnapshot, openingHours: '07:00–20:00' }] });
    render(<ContentClient labels={{}}/>); await openTarget('project');
    fireEvent.click(screen.getByRole('button', { name: `${label('amenities.edit')}: Main pool` }));
    expect(screen.getByRole('option', { name: label('amenities.set_staff_hours') })).toBeDisabled();
    expect(screen.getByRole('option', { name: label('amenities.clear_staff_hours') })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(label('amenities.staff_hours')), { target: { value: 'range' } });
    expect(screen.getByLabelText(label('amenities.staff_hours'))).toHaveValue('keep');
    fireEvent.change(screen.getByLabelText(label('amenities.hours')), { target: { value: 'clear' } });
    expect(screen.getByRole('option', { name: label('amenities.set_staff_hours') })).toBeEnabled();
    fireEvent.change(screen.getByLabelText(label('amenities.staff_hours')), { target: { value: 'range' } });
    fireEvent.click(screen.getByLabelText(label('amenities.staff_all_day')));
    expect(screen.getByRole('option', { name: label('amenities.keep_hours') })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(label('amenities.hours')), { target: { value: 'keep' } });
    expect(screen.getByLabelText(label('amenities.hours'))).toHaveValue('clear');
    fireEvent.click(screen.getByRole('button', { name: label('save') })); await screen.findByText(label('saved'));
    expect(JSON.parse(String(saveCalls(fetchMock)[0][1].body)).proposal.amenities[0]).toMatchObject({ openingHours: { mode: 'clear' }, staffHours: { mode: 'range', open: '00:00', close: '24:00' } });
  });

  it('rejects equal staff-contact times and accepts an explicit 24-hour choice without a timezone guess', async () => {
    const fetchMock = setupAmenities(); render(<ContentClient labels={{}}/>); await openTarget('project');
    fireEvent.click(screen.getByRole('button', { name: `${label('amenities.edit')}: Gym` }));
    fireEvent.change(screen.getByLabelText(label('amenities.staff_hours')), { target: { value: 'range' } });
    fireEvent.change(screen.getByLabelText(label('amenities.staff_open')), { target: { value: '09:00' } });
    fireEvent.change(screen.getByLabelText(label('amenities.staff_close')), { target: { value: '09:00' } });
    fireEvent.click(screen.getByRole('button', { name: label('save') }));
    expect(screen.getByRole('alert')).toHaveTextContent(label('validation')); expect(saveCalls(fetchMock)).toHaveLength(0);
    fireEvent.click(screen.getByLabelText(label('amenities.staff_all_day')));
    expect(screen.getByLabelText(label('amenities.staff_open'))).toBeDisabled();
    expect(screen.getByLabelText(label('amenities.timezone'))).toHaveValue('');
    fireEvent.click(screen.getByRole('button', { name: label('save') })); await screen.findByText(label('saved'));
    expect(JSON.parse(String(saveCalls(fetchMock)[0][1].body)).proposal.amenities[0]).toMatchObject({ openingHours: { mode: 'keep' }, staffHours: { mode: 'range', open: '00:00', close: '24:00' } });
  });


  it('shows the known shared timezone for staff-only editing without silently rewriting it', async () => {
    const openingHours = { weekly: { monday: [['07:00', '12:00']] }, staffContact: [['09:00', '17:00']], timezone: 'Asia/Bangkok' };
    const fetchMock = setupAmenities({ baseline: [{ ...amenitySnapshot, openingHours }] });
    render(<ContentClient labels={{}}/>); await openTarget('project');
    fireEvent.click(screen.getByRole('button', { name: `${label('amenities.edit')}: Main pool` }));
    fireEvent.change(screen.getByLabelText(label('amenities.staff_hours')), { target: { value: 'range' } });
    expect(screen.getByLabelText(label('amenities.timezone'))).toHaveValue('Asia/Bangkok');
    fireEvent.click(screen.getByRole('button', { name: label('save') })); await screen.findByText(label('saved'));
    const entry = JSON.parse(String(saveCalls(fetchMock)[0][1].body)).proposal.amenities[0];
    expect(entry.openingHours).toEqual({ mode: 'keep' });
    expect(entry.staffHours).toEqual({ mode: 'range', open: '09:00', close: '17:00' });
  });

  it('allows an explicit timezone for new staff-only hours and retains it when choosing 24 hours', async () => {
    const fetchMock = setupAmenities({ baseline: [] }); render(<ContentClient labels={{}}/>); await openTarget('project');
    fireEvent.click(screen.getByRole('button', { name: label('amenities.add') }));
    fireEvent.change(screen.getByLabelText(label('amenities.name')), { target: { value: 'Reception desk' } });
    fireEvent.change(screen.getByLabelText(label('amenities.staff_hours')), { target: { value: 'range' } });
    expect(screen.getByLabelText(label('amenities.timezone'))).toHaveValue('');
    fireEvent.change(screen.getByLabelText(label('amenities.timezone')), { target: { value: 'Asia/Bangkok' } });
    fireEvent.click(screen.getByLabelText(label('amenities.staff_all_day')));
    expect(screen.getByLabelText(label('amenities.timezone'))).toHaveValue('Asia/Bangkok');
    fireEvent.click(screen.getByRole('button', { name: label('save') })); await screen.findByText(label('saved'));
    expect(JSON.parse(String(saveCalls(fetchMock)[0][1].body)).proposal.amenities[0]).toMatchObject({ openingHours: { mode: 'keep' }, staffHours: { mode: 'range', open: '00:00', close: '24:00', timezone: 'Asia/Bangkok' } });
  });

  it('uses the access timezone when daily and staff hours are both proposed, omitting hidden staff timezone', async () => {
    const openingHours = { daily: [['07:00', '20:00']], staffContact: [['09:00', '17:00']], timezone: 'Asia/Bangkok' };
    const fetchMock = setupAmenities({ baseline: [{ ...amenitySnapshot, openingHours }] });
    render(<ContentClient labels={{}}/>); await openTarget('project');
    fireEvent.click(screen.getByRole('button', { name: `${label('amenities.edit')}: Main pool` }));
    fireEvent.change(screen.getByLabelText(label('amenities.staff_hours')), { target: { value: 'range' } });
    fireEvent.change(screen.getByLabelText(label('amenities.timezone')), { target: { value: 'Asia/Singapore' } });
    fireEvent.change(screen.getByLabelText(label('amenities.hours')), { target: { value: 'daily' } });
    expect(screen.getAllByLabelText(label('amenities.timezone'))).toHaveLength(1);
    fireEvent.change(screen.getByLabelText(label('amenities.timezone')), { target: { value: 'Asia/Tokyo' } });
    fireEvent.click(screen.getByRole('button', { name: label('save') })); await screen.findByText(label('saved'));
    const entry = JSON.parse(String(saveCalls(fetchMock)[0][1].body)).proposal.amenities[0];
    expect(entry.openingHours).toEqual({ mode: 'daily', open: '07:00', close: '20:00', timezone: 'Asia/Tokyo' });
    expect(entry.staffHours).toEqual({ mode: 'range', open: '09:00', close: '17:00' });
  });

  it('can explicitly clear the shared timezone from staff-only hours while preserving access data', async () => {
    const openingHours = { weekly: { monday: [['07:00', '12:00']] }, staffContact: [['09:00', '17:00']], timezone: 'Asia/Bangkok' };
    const fetchMock = setupAmenities({ baseline: [{ ...amenitySnapshot, openingHours }] });
    render(<ContentClient labels={{}}/>); await openTarget('project');
    fireEvent.click(screen.getByRole('button', { name: `${label('amenities.edit')}: Main pool` }));
    fireEvent.change(screen.getByLabelText(label('amenities.staff_hours')), { target: { value: 'range' } });
    fireEvent.change(screen.getByLabelText(label('amenities.timezone')), { target: { value: '' } });
    fireEvent.click(screen.getByText(label('amenities.compare')));
    const proposed = screen.getByRole('region', { name: label('amenities.after') });
    expect(within(proposed).getByText('weekly: monday: 07:00–12:00')).toBeInTheDocument();
    expect(within(proposed).queryByText(/Asia\/Bangkok/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: label('save') })); await screen.findByText(label('saved'));
    expect(JSON.parse(String(saveCalls(fetchMock)[0][1].body)).proposal.amenities[0]).toMatchObject({ openingHours: { mode: 'keep' }, staffHours: { mode: 'range', open: '09:00', close: '17:00', timezone: null } });
  });

  it('rejects an invalid staff-only timezone without sending or discarding entered text', async () => {
    const fetchMock = setupAmenities(); render(<ContentClient labels={{}}/>); await openTarget('project');
    fireEvent.click(screen.getByRole('button', { name: `${label('amenities.edit')}: Gym` }));
    fireEvent.change(screen.getByLabelText(label('amenities.staff_hours')), { target: { value: 'range' } });
    fireEvent.click(screen.getByLabelText(label('amenities.staff_all_day')));
    fireEvent.change(screen.getByLabelText(label('amenities.timezone')), { target: { value: 'Unknown/Zone' } });
    fireEvent.click(screen.getByRole('button', { name: label('save') }));
    expect(screen.getByRole('alert')).toHaveTextContent(label('validation'));
    expect(screen.getByLabelText(label('amenities.timezone'))).toHaveValue('Unknown/Zone');
    expect(saveCalls(fetchMock)).toHaveLength(0);
  });

});

it('opens an exact converted-output link only after resolving the server-authorized target', async () => {
  const fetchMock = setup();
  render(<ContentClient labels={{}} initialTarget={{ scope: 'unit', id: unitTarget.id }} />);
  await screen.findByLabelText(label('field.unitName'));
  expect(screen.getByLabelText(label('target'))).toHaveValue(`unit:${unitTarget.id}`);
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([API, `${API}/target?scope=unit&id=${unitTarget.id}`]);
  expect(screen.getByLabelText(label('field.unitName'))).toHaveValue('D201');
});

it('does not request a guessed deep-link target missing from the server-authorized list', async () => {
  const fetchMock = setup();
  render(<ContentClient labels={{}} initialTarget={{ scope: 'project', id: 'foreign-project' }} />);
  await screen.findByText(label('forbidden'));
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([API]);
  expect(screen.queryByLabelText(label('field.name'))).not.toBeInTheDocument();
});

describe('direct-upload recovery in the content editor', () => {
  it('preserves a dirty deep-linked editor when retrying assignments after initiation fails', async () => {
    const fetchMock = setup({ override: url => url === '/api/media/upload' ? ok({}, 500) : undefined });
    render(<ContentClient labels={{}} initialTarget={{ scope: 'unit', id: unitTarget.id }}/>);
    await screen.findByLabelText(label('field.unitName'));
    await waitFor(() => expect(screen.getByRole('button', { name: label('save') })).toBeEnabled());
    fireEvent.change(screen.getByLabelText(label('field.unitName')), { target: { value: 'Keep deep-linked edits' } });
    fireEvent.click(screen.getByRole('button', { name: `${label('move_up')} 2` }));
    fireEvent.change(screen.getByLabelText(label('upload')), { target: { files: [new File(['photo'], 'photo.jpg', { type: 'image/jpeg' })] } });
    await screen.findByText(label('request_error'));
    fireEvent.click(screen.getByRole('button', { name: label('retry') }));
    await waitFor(() => expect(screen.getByRole('button', { name: label('save') })).toBeEnabled());
    expect(screen.getByLabelText(label('field.unitName'))).toHaveValue('Keep deep-linked edits');
    expect(screen.getByAltText(`${label('photo')} 1`)).toHaveAttribute('src', '/media/b.jpg');
    expect(fetchMock.mock.calls.filter(([url]) => url.startsWith(`${API}/target?`))).toHaveLength(1);
    expect(fetchMock.mock.calls.filter(([url]) => url === API)).toHaveLength(2);
  });

  it('warns before closing the page during preparation even if the editor was clean', async () => {
    const pending = new Promise<Response>(() => {});
    setup({ override: url => url === '/api/media/upload' ? pending : undefined });
    render(<ContentClient labels={{}}/>); await openTarget();
    fireEvent.change(screen.getByLabelText(label('upload')), { target: { files: [new File(['photo'], 'photo.jpg', { type: 'image/jpeg' })] } });
    await screen.findByText(`${label('upload_preparing')} 1/1`);
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event); expect(event.defaultPrevented).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: label('upload_stop_waiting') }));
    expect(screen.getByText(label('upload_stopped'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: label('save') })).toBeEnabled();
  });

  it('requires an explicit warning before leaving an unconfirmed photo for another property', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const fetchMock = setup({ override: url => url === PUT_URL ? Promise.reject(new Error('lost')) : undefined });
    render(<ContentClient labels={{}}/>); await openTarget();
    fireEvent.change(screen.getByLabelText(label('upload')), { target: { files: [new File(['photo'], 'photo.jpg', { type: 'image/jpeg' })] } });
    await screen.findByText(label('upload_transfer_uncertain'));
    fireEvent.change(screen.getByLabelText(label('target')), { target: { value: `project:${projectTarget.id}` } });
    fireEvent.click(screen.getByRole('button', { name: label('new') }));
    expect(confirm).toHaveBeenCalledWith(label('upload_leave_confirm'));
    expect(screen.getByRole('button', { name: label('upload_retry_finalize') })).toBeInTheDocument();
    expect(screen.getByLabelText(label('field.unitName'))).toHaveValue('D201');
    confirm.mockReturnValue(true); fireEvent.click(screen.getByRole('button', { name: label('new') }));
    await screen.findByLabelText(label('field.address'));
    expect(screen.queryByRole('button', { name: label('upload_retry_finalize') })).not.toBeInTheDocument();
    expect(screen.getAllByRole('img')).toHaveLength(2);
    expect(fetchMock.mock.calls.filter(([url]) => url === '/api/media/upload')).toHaveLength(1);
  });

  it('binds a project photo to the exact loaded project, even when another selector choice is present', async () => {
    const fetchMock = setup(); render(<ContentClient labels={{}}/>); await openTarget('project');
    fireEvent.change(screen.getByLabelText(label('target')), { target: { value: `unit:${unitTarget.id}` } });
    fireEvent.change(screen.getByLabelText(label('upload')), { target: { files: [new File(['photo'], 'pool.webp', { type: 'image/webp' })] } });
    await screen.findByText(label('upload_complete'));
    const [, init] = fetchMock.mock.calls.find(([url]) => url === '/api/media/upload')!;
    expect(JSON.parse(String(init.body))).toEqual({ action: 'initiate', scope: 'project', targetId: projectTarget.id, mimeType: 'image/webp', sizeBytes: 5 });
    expect(saveCalls(fetchMock)).toHaveLength(0);
  });

  it.each(['initiate', 'put', 'finalize'])('locks every editor action until %s is confirmed and shows the current stage', async stage => {
    let resolve!: (response: Response) => void;
    const pending = new Promise<Response>(done => { resolve = done; });
    const fetchMock = setup({ override: (url, init) => {
      if (stage === 'put' ? url === PUT_URL : url === '/api/media/upload' && JSON.parse(String(init.body)).action === stage) return pending;
      return undefined;
    } });
    render(<ContentClient labels={{}}/>); await openTarget();
    const file = new File(['photo'], 'photo.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByLabelText(label('upload')), { target: { files: [file] } });
    await screen.findByText(`${label(stage === 'initiate' ? 'upload_preparing' : stage === 'put' ? 'upload_transferring' : 'upload_finalizing')} 1/1`);
    for (const name of ['save', 'submit', 'refresh', 'new', 'clear_cover']) expect(screen.getByRole('button', { name: label(name) })).toBeDisabled();
    for (const name of ['field.unitName', 'description_enabled', 'upload', 'target']) expect(screen.getByLabelText(label(name))).toBeDisabled();
    for (const name of ['make_cover', 'remove', 'move_down']) expect(screen.getByRole('button', { name: `${label(name)} 1` })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: label('save') }));
    fireEvent.change(screen.getByLabelText(label('field.unitName')), { target: { value: 'Should not change' } });
    expect(saveCalls(fetchMock)).toHaveLength(0);
    expect(screen.getByLabelText(label('field.unitName'))).toHaveValue('D201');
    expect(screen.queryByAltText(`${label('photo')} 3`)).not.toBeInTheDocument();
    resolve(ok(stage === 'initiate' ? { intent: 'synthetic-intent', uploadUrl: PUT_URL, headers: { 'Content-Type': file.type }, expiresAt: new Date(Date.now() + 60_000).toISOString() } : { mediaAssetId: C, url: PHOTO_URL }));
    await screen.findByText(label('upload_complete'));
    expect(screen.getByRole('button', { name: label('save') })).toBeEnabled();
    expect(screen.getByAltText(`${label('photo')} 3`)).toBeInTheDocument();
  });

  it('keeps names, description, image order and cover on a lost PUT response and recovers using only registration', async () => {
    const fetchMock = setup({ override: url => url === PUT_URL ? Promise.reject(new TypeError(PUT_URL)) : undefined });
    render(<ContentClient labels={{}}/>); await openTarget();
    fireEvent.change(screen.getByLabelText(label('field.unitName')), { target: { value: 'Keep this name' } });
    fireEvent.click(screen.getByLabelText(label('description_enabled')));
    fireEvent.change(screen.getByLabelText(label('description_value')), { target: { value: 'Keep this description' } });
    fireEvent.click(screen.getByRole('button', { name: `${label('move_up')} 2` }));
    fireEvent.click(screen.getByRole('button', { name: `${label('make_cover')} 1` }));
    fireEvent.change(screen.getByLabelText(label('upload')), { target: { files: [new File(['photo'], 'photo.jpg', { type: 'image/jpeg' })] } });
    await screen.findByText(label('upload_transfer_uncertain'));
    expect(screen.getByLabelText(label('field.unitName'))).toHaveValue('Keep this name');
    expect(screen.getByLabelText(label('description_value'))).toHaveValue('Keep this description');
    expect(screen.getByRole('button', { name: `${label('make_cover')} 1` })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByAltText(`${label('photo')} 1`)).toHaveAttribute('src', '/media/b.jpg');
    expect(screen.queryByAltText(`${label('photo')} 3`)).not.toBeInTheDocument();
    expect(screen.getByLabelText(label('upload'))).toBeDisabled();
    expect(screen.getByRole('button', { name: label('save') })).toBeDisabled();
    expect(screen.getByRole('alert').textContent).not.toContain('signature');
    fireEvent.click(screen.getByRole('button', { name: label('upload_retry_finalize') }));
    await screen.findByText(label('upload_complete'));
    expect(fetchMock.mock.calls.filter(([url]) => url === PUT_URL)).toHaveLength(1);
    expect(fetchMock.mock.calls.filter(([url]) => url === '/api/media/upload')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: label('save') })); await screen.findByText(label('saved'));
    expect(JSON.parse(String(saveCalls(fetchMock)[0][1].body)).proposal).toMatchObject({ facts: { name: 'Keep this name' }, description: { value: 'Keep this description' }, gallery: { mediaIds: [B, A, C], coverMediaId: B } });
  });

  it.each(['network', 'malformed', 'unsafe-url'])('keeps an uncertain %s registration retry bound to the existing intent without reupload', async failure => {
    let attempts = 0;
    const fetchMock = setup({ override: (url, init) => {
      if (url !== '/api/media/upload' || JSON.parse(String(init.body)).action !== 'finalize' || ++attempts !== 1) return undefined;
      return failure === 'network' ? Promise.reject(new TypeError('lost response')) : ok(failure === 'malformed' ? {} : { mediaAssetId: C, url: 'https://untrusted.test/unsafe.jpg' });
    } });
    render(<ContentClient labels={{}}/>); await openTarget();
    fireEvent.change(screen.getByLabelText(label('upload')), { target: { files: [new File(['photo'], 'photo.jpg', { type: 'image/jpeg' })] } });
    await screen.findByRole('button', { name: label('upload_retry_finalize') });
    expect(screen.queryByAltText(`${label('photo')} 3`)).not.toBeInTheDocument();
    expect(screen.queryByText(label('upload_complete'))).not.toBeInTheDocument();
    const retry = screen.getByRole('button', { name: label('upload_retry_finalize') });
    fireEvent.click(retry); fireEvent.click(retry);
    await screen.findByText(label('upload_complete'));
    expect(screen.getAllByRole('img')).toHaveLength(3);
    expect(fetchMock.mock.calls.filter(([url]) => url === PUT_URL)).toHaveLength(1);
    const bodies = fetchMock.mock.calls.filter(([url]) => url === '/api/media/upload').map(([, init]) => JSON.parse(String(init.body)));
    expect(bodies).toHaveLength(3); expect(bodies.slice(1)).toEqual(Array(2).fill({ action: 'finalize', intent: 'synthetic-intent' }));
  });

  it.each(['put', 'finalize'])('can stop waiting during %s, ignore a late response and recover without duplicate upload', async stage => {
    let resolve!: (response: Response) => void; let intercepted = false;
    const pending = new Promise<Response>(done => { resolve = done; });
    const fetchMock = setup({ override: (url, init) => {
      if (!intercepted && (stage === 'put' ? url === PUT_URL : url === '/api/media/upload' && JSON.parse(String(init.body)).action === 'finalize')) { intercepted = true; return pending; }
      return undefined;
    } });
    render(<ContentClient labels={{}}/>); await openTarget();
    fireEvent.change(screen.getByLabelText(label('upload')), { target: { files: [new File(['photo'], 'photo.jpg', { type: 'image/jpeg' })] } });
    await screen.findByText(`${label(stage === 'put' ? 'upload_transferring' : 'upload_finalizing')} 1/1`);
    const current = fetchMock.mock.calls.at(-1)![1];
    fireEvent.click(screen.getByRole('button', { name: label('upload_stop_waiting') }));
    expect(current.signal?.aborted).toBe(true);
    expect(screen.getByRole('button', { name: label('upload_retry_finalize') })).toBeEnabled();
    resolve(ok({ mediaAssetId: C, url: PHOTO_URL }));
    await Promise.resolve();
    expect(screen.queryByAltText(`${label('photo')} 3`)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: label('upload_retry_finalize') }));
    await screen.findByText(label('upload_complete'));
    expect(screen.getAllByRole('img')).toHaveLength(3);
    expect(fetchMock.mock.calls.filter(([url]) => url === PUT_URL)).toHaveLength(1);
  });

  it('requires explicit discard of an unconfirmed photo and preserves earlier edits and gallery', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const fetchMock = setup({ override: url => url === PUT_URL ? ok({}, 500) : undefined });
    render(<ContentClient labels={{}}/>); await openTarget();
    fireEvent.change(screen.getByLabelText(label('field.unitName')), { target: { value: 'Unsaved name' } });
    fireEvent.change(screen.getByLabelText(label('upload')), { target: { files: [new File(['photo'], 'photo.jpg', { type: 'image/jpeg' })] } });
    await screen.findByText(label('upload_transfer_failed'));
    fireEvent.click(screen.getByRole('button', { name: label('upload_discard') }));
    expect(confirm).toHaveBeenCalledWith(label('upload_discard_confirm'));
    expect(screen.getByRole('button', { name: label('save') })).toBeDisabled();
    confirm.mockReturnValue(true); fireEvent.click(screen.getByRole('button', { name: label('upload_discard') }));
    expect(screen.getByRole('button', { name: label('save') })).toBeEnabled();
    expect(screen.getByLabelText(label('field.unitName'))).toHaveValue('Unsaved name');
    expect(screen.getAllByRole('img')).toHaveLength(2);
    expect(fetchMock.mock.calls.filter(([url]) => url === '/api/media/upload')).toHaveLength(1);
    expect(fetchMock.mock.calls.some(([, init]) => init.method === 'DELETE')).toBe(false);
  });

  it('keeps a confirmed partial batch and reports remaining unprocessed files after pending recovery', async () => {
    let attempts = 0;
    const D = 'd1234567-1234-4123-8123-123456789abc';
    const fetchMock = setup({ override: (url, init) => {
      if (url !== '/api/media/upload' || JSON.parse(String(init.body)).action !== 'finalize') return undefined;
      attempts += 1;
      if (attempts === 2) return Promise.reject(new Error('lost'));
      if (attempts === 3) return ok({ mediaAssetId: D, url: PHOTO_URL });
      return undefined;
    } });
    render(<ContentClient labels={{}}/>); await openTarget();
    fireEvent.change(screen.getByLabelText(label('upload')), { target: { files: ['one', 'two', 'three'].map(name => new File(['photo'], name + '.jpg', { type: 'image/jpeg' })) } });
    await screen.findByText(label('upload_partial'));
    expect(screen.getAllByRole('img')).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: label('upload_retry_finalize') }));
    await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(4));
    expect(screen.getByText(label('upload_partial'))).toBeInTheDocument();
    expect(screen.queryByText(label('upload_complete'))).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([url]) => url === PUT_URL)).toHaveLength(2);
    expect(fetchMock.mock.calls.filter(([url, init]) => url === '/api/media/upload' && JSON.parse(String(init.body)).action === 'initiate')).toHaveLength(2);
  });

  it('aborts an unmounted upload before registration even if the PUT later resolves', async () => {
    let resolve!: (response: Response) => void;
    const pending = new Promise<Response>(done => { resolve = done; });
    const fetchMock = setup({ override: url => url === PUT_URL ? pending : undefined });
    const view = render(<ContentClient labels={{}}/>); await openTarget();
    fireEvent.change(screen.getByLabelText(label('upload')), { target: { files: [new File(['photo'], 'photo.jpg', { type: 'image/jpeg' })] } });
    await screen.findByText(`${label('upload_transferring')} 1/1`);
    const put = fetchMock.mock.calls.find(([url]) => url === PUT_URL)![1];
    view.unmount(); expect(put.signal?.aborted).toBe(true); resolve(ok({}));
    await new Promise(done => setTimeout(done, 0));
    expect(fetchMock.mock.calls.filter(([url]) => url === '/api/media/upload')).toHaveLength(1);
  });

  it('ignores an old finalize result after navigation opens a different target', async () => {
    let resolve!: (response: Response) => void;
    const pending = new Promise<Response>(done => { resolve = done; });
    const fetchMock = setup({ override: (url, init) => url === '/api/media/upload' && JSON.parse(String(init.body)).action === 'finalize' ? pending : undefined });
    const view = render(<ContentClient labels={{}}/>); await openTarget();
    fireEvent.change(screen.getByLabelText(label('upload')), { target: { files: [new File(['photo'], 'photo.jpg', { type: 'image/jpeg' })] } });
    await screen.findByText(`${label('upload_finalizing')} 1/1`);
    const finalize = fetchMock.mock.calls.at(-1)![1];
    view.rerender(<ContentClient labels={{}} initialTarget={{ scope: 'project', id: projectTarget.id }}/>);
    await screen.findByLabelText(label('field.address'));
    expect(finalize.signal?.aborted).toBe(true);
    resolve(ok({ mediaAssetId: C, url: PHOTO_URL })); await new Promise(done => setTimeout(done, 0));
    expect(screen.getByLabelText(label('field.name'))).toHaveValue('Legendary');
    expect(screen.getAllByRole('img')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: label('upload_retry_finalize') })).not.toBeInTheDocument();
  });
});
