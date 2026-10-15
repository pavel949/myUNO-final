import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ContentClient from './content-client';
import { CONTENT_UI_LABELS } from './UI-labels';

const API = '/api/property-content-proposals';
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
    if (url === '/api/media/upload') return ok({ mediaAssetId: C, url: '/media/c.jpg' }, 201);
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

  it('uploads an owned photo using multipart and keeps attachment changes in the proposal', async () => {
    const fetchMock = setup(); render(<ContentClient labels={{}}/>); await openTarget();
    const file = new File(['photo'], 'photo.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByLabelText(label('upload')), { target: { files: [file] } });
    await screen.findByAltText(`${label('photo')} 3`);
    const [, init] = fetchMock.mock.calls.find(([url]) => url === '/api/media/upload')!;
    expect(init.method).toBe('POST'); expect(init.headers).toBeUndefined();
    expect((init.body as FormData).get('kind')).toBe('photo');
    expect(((init.body as FormData).get('file') as File).name).toBe('photo.jpg');
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
    const fetchMock = setup({ override: url => url === '/api/media/upload' && ++count === 2 ? ok({}, 500) : undefined });
    render(<ContentClient labels={{}}/>); await openTarget();
    const files = ['one.jpg', 'two.jpg'].map(name => new File(['photo'], name, { type: 'image/jpeg' }));
    fireEvent.change(screen.getByLabelText(label('upload')), { target: { files } });
    await screen.findByText(label('upload_partial'));
    expect(screen.getByAltText(`${label('photo')} 3`)).toBeInTheDocument();
    expect(screen.getByLabelText(label('upload'))).toBeEnabled();
    expect(fetchMock.mock.calls.filter(([url]) => url === '/api/media/upload')).toHaveLength(2);
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
