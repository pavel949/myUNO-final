'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { EMPLOYEE_CREATION_LABELS } from '@/modules/content/employee-creation.seed';

const API = '/api/property-creation';
const INPUT = 'mt-4 min-h-[44px] w-full rounded-md border border-border-line bg-surface-paper px-12 py-8 disabled:opacity-60';
const BUTTON = 'min-h-[44px] rounded-md border border-border-line px-16 py-8 font-semibold disabled:cursor-not-allowed disabled:opacity-50';
type Kind = 'unit' | 'complex';
type Draft = Record<string, string | number | null | string[]>;
type Space = { id: string; name: string; organizationId: string; canCreateUnit: boolean; canCreateComplex: boolean; projects: { id: string; name: string }[] };
type Detail = { id: string; spaceId: string; organizationId: string; kind: Kind; projectId: string | null; status: string; revision: number; draft: Draft; createdProjectId: string | null; createdUnitId: string | null; lastRequestId: string | null; hasCreationAccess: boolean; mayEdit: boolean; matchedExisting: boolean };
type Editor = Omit<Detail, 'id' | 'revision'> & { id: string | null; revision: number; dirty: boolean };
type Pending = { requestId: string; method: 'POST' | 'PATCH'; body: string; spaceId: string; kind: Kind; projectId: string | null; id: string | null; revision: number };
type Hints = { projects: { id: string; name: string; address: string }[]; units: { id: string; name: string; projectId: string }[] };
class Failure extends Error { constructor(readonly key: string) { super(key); } }
function object(value: unknown): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Failure('request'); return value as Record<string, unknown>; }
function text(value: unknown): string { if (typeof value !== 'string' || !value) throw new Failure('request'); return value; }
function detail(value: unknown): Detail {
  const row = object(value);
  if (!['unit', 'complex'].includes(String(row.kind)) || !Number.isSafeInteger(row.revision) || Number(row.revision) < 1 || !['draft', 'submitted', 'converted'].includes(String(row.status))) throw new Failure('request');
  const draft = object(row.draft);
  return { id: text(row.id), spaceId: text(row.spaceId), organizationId: text(row.organizationId), kind: row.kind as Kind, projectId: typeof row.projectId === 'string' ? row.projectId : null, status: String(row.status), revision: Number(row.revision), draft: draft as Draft, createdProjectId: typeof row.createdProjectId === 'string' ? row.createdProjectId : null, createdUnitId: typeof row.createdUnitId === 'string' ? row.createdUnitId : null, lastRequestId: typeof row.lastRequestId === 'string' ? row.lastRequestId : null, hasCreationAccess: row.hasCreationAccess === true, mayEdit: row.mayEdit === true, matchedExisting: row.matchedExisting === true };
}
function index(value: unknown): { spaces: Space[]; items: Detail[] } {
  const row = object(value);
  if (!Array.isArray(row.spaces) || !Array.isArray(row.items)) throw new Failure('request');
  return { spaces: row.spaces.map(value => {
    const entry = object(value);
    if (!Array.isArray(entry.projects) || typeof entry.canCreateUnit !== 'boolean' || typeof entry.canCreateComplex !== 'boolean') throw new Failure('request');
    return { id: text(entry.id), name: text(entry.name), organizationId: text(entry.organizationId), canCreateUnit: entry.canCreateUnit, canCreateComplex: entry.canCreateComplex, projects: entry.projects.map(value => { const project = object(value); return { id: text(project.id), name: text(project.name) }; }) };
  }).filter(space => space.canCreateUnit || space.canCreateComplex), items: row.items.map(detail) };
}
async function request(url: string, init: RequestInit = {}): Promise<unknown> {
  const response = await fetch(url, { ...init, cache: 'no-store', credentials: 'same-origin' });
  if (!response.ok) throw new Failure(({ 400: 'validation', 401: 'unauthorized', 403: 'forbidden', 404: 'not_found', 409: 'conflict' } as Record<number, string>)[response.status] || 'request');
  return response.json();
}
const unitFields = ['unitName', 'unitType', 'bedrooms', 'bathrooms', 'maxGuests', 'sizeSqm', 'floor'];
const complexFields = ['proposedProject', 'projectAddress', 'projectType', 'areaId', 'latitude', 'longitude'];
const numericFields = ['bedrooms', 'bathrooms', 'maxGuests', 'sizeSqm', 'latitude', 'longitude'];
function payload(editor: Editor): Draft {
  const result: Draft = {};
  for (const key of [...(editor.kind === 'unit' ? unitFields : complexFields), 'description', 'descriptionLocale']) {
    const value = editor.draft[key];
    result[key] = numericFields.includes(key) ? value === '' || value == null ? null : Number(value) : ['descriptionLocale', 'areaId'].includes(key) ? value == null || value === '' ? null : String(value) : value == null ? '' : String(value);
    if (typeof result[key] === 'number' && !Number.isFinite(result[key])) throw new Failure('validation');
  }
  if (editor.kind === 'unit') result.existingUnitId = typeof editor.draft.existingUnitId === 'string' ? editor.draft.existingUnitId : null;
  const photoKey = editor.kind === 'unit' ? 'photos' : 'projectPhotos';
  result[photoKey] = Array.isArray(editor.draft[photoKey]) ? editor.draft[photoKey] as string[] : [];
  if (String(result.description || '').trim() && !['en', 'ru', 'th', 'zh'].includes(String(result.descriptionLocale))) throw new Failure('validation');
  return result;
}

export default function CreationClient({ labels, areas = [], initialId, initialKind, fromOperations = false }: {
  labels: Record<string, string>; areas?: { id: string; name: string }[]; initialId?: string; initialKind?: Kind; fromOperations?: boolean;
}) {
  const l = (key: string) => labels[`property.creation.${key}`] || EMPLOYEE_CREATION_LABELS[`property.creation.${key}`] || EMPLOYEE_CREATION_LABELS['property.creation.status.unknown'];
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [items, setItems] = useState<Detail[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [spaceId, setSpaceId] = useState('');
  const [kind, setKind] = useState<Kind | ''>(initialKind || '');
  const [projectId, setProjectId] = useState('');
  const [editor, setEditor] = useState<Editor | null>(null);
  const [busy, setBusy] = useState<string | null>('loading');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [retryExact, setRetryExact] = useState(false);
  const [query, setQuery] = useState('');
  const [hints, setHints] = useState<Hints | null>(null);
  const pending = useRef<Pending | null>(null);
  const mounted = useRef(false);
  const lock = useRef(false);
  const sequence = useRef(0);
  const form = useRef<HTMLFormElement>(null);
  const selectedSpace = spaces.find(space => space.id === spaceId);
  const editorSpace = spaces.find(space => space.id === editor?.spaceId);
  const readOnly = editor?.status !== 'draft';
  const disabled = !!busy || !!readOnly || blocked || conflict || uncertain || editor?.mayEdit === false;
  const canStart = !!selectedSpace && ((kind === 'unit' && selectedSpace.canCreateUnit && selectedSpace.projects.some(project => project.id === projectId)) || (kind === 'complex' && selectedSpace.canCreateComplex));
  const editableGrant = !editor || editor.hasCreationAccess && !!editorSpace && (editor.kind === 'complex' ? editorSpace.canCreateComplex : editorSpace.canCreateUnit && editorSpace.projects.some(project => project.id === editor.projectId));

  const run = useCallback(async (activity: string, action: (active: () => boolean) => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    const token = ++sequence.current;
    const active = () => mounted.current && sequence.current === token;
    setBusy(activity); setError(null); setNotice(null);
    try { await action(active); }
    catch (reason) { if (active()) { const key = reason instanceof Failure ? reason.key : 'request'; setError(key); if (key === 'forbidden' || key === 'unauthorized') setBlocked(true); } }
    finally { if (active()) { lock.current = false; setBusy(null); } }
  }, []);
  const accept = (saved: Detail) => {
    setEditor({ ...saved, dirty: false });
    setItems(old => [saved, ...old.filter(item => item.id !== saved.id)]);
    pending.current = null; setUncertain(false); setRetryExact(false); setConflict(false); setBlocked(false);
    setSpaceId(saved.spaceId); setKind(saved.kind); setProjectId(saved.projectId || ''); setHints(null);
  };
  const canLeave = () => !lock.current && !uncertain && (!editor?.dirty || window.confirm(l('discard')));
  const load = useCallback((openId?: string) => run('loading', async active => {
    const result = index(await request(API));
    if (!active()) return;
    setSpaces(result.spaces); setItems(result.items); setLoaded(true); setBlocked(false);
    if (openId) {
      const saved = detail(await request(`${API}?id=${encodeURIComponent(openId)}`));
      if (!active()) return;
      if (saved.id !== openId) throw new Failure('request');
      accept(saved);
    }
  // Initial loading is intentionally independent of editor state.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [run]);
  useEffect(() => { mounted.current = true; void load(initialId); return () => { mounted.current = false; lock.current = false; }; }, [initialId, load]);
  useEffect(() => {
    if (!editor?.dirty && !busy && !uncertain) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    const navigate = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!target) return;
      if (lock.current || uncertain || editor?.dirty && !window.confirm(l('discard'))) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener('beforeunload', beforeUnload); document.addEventListener('click', navigate, true);
    return () => { window.removeEventListener('beforeunload', beforeUnload); document.removeEventListener('click', navigate, true); };
  });
  const setField = (key: string, value: string) => { if (disabled || !editableGrant) return; setEditor(old => old ? { ...old, dirty: true, draft: { ...old.draft, [key]: value } } : old); };
  const start = () => {
    if (!canStart || !selectedSpace || !kind || !canLeave()) return;
    setEditor({ id: null, revision: 0, spaceId, organizationId: selectedSpace.organizationId, kind, projectId: kind === 'unit' ? projectId : null, status: 'draft', createdProjectId: null, createdUnitId: null, lastRequestId: null, hasCreationAccess: true, mayEdit: true, matchedExisting: false, dirty: false, draft: kind === 'unit' ? { unitName: '', unitType: 'condo', description: '', descriptionLocale: null } : { proposedProject: '', projectType: 'condominium', projectAddress: '', description: '', descriptionLocale: null } });
    setHints(null); setError(null); setNotice(null); setConflict(false); setBlocked(false); setQuery('');
  };
  const perform = async (command: Pending, active: () => boolean) => {
    try {
      const saved = detail(await request(API, { method: command.method, headers: { 'Content-Type': 'application/json' }, body: command.body }));
      if (!active()) return;
      if (saved.spaceId !== command.spaceId || saved.kind !== command.kind || saved.projectId !== command.projectId || command.id && saved.id !== command.id || saved.lastRequestId !== command.requestId || saved.revision <= command.revision) throw new Failure('request');
      accept(saved); setNotice(saved.status === 'submitted' ? 'submitted' : 'saved');
    } catch (reason) {
      if (!active()) return;
      const key = reason instanceof Failure ? reason.key : 'request';
      if (['validation', 'unauthorized', 'forbidden', 'not_found', 'conflict'].includes(key)) {
        pending.current = null; setError(key);
        if (key === 'conflict') setConflict(true);
        if (key === 'unauthorized' || key === 'forbidden' || key === 'not_found') setBlocked(true);
      } else { setUncertain(true); setError('uncertain'); setRetryExact(false); }
    }
  };
  const save = (status: 'draft' | 'submitted') => {
    if (disabled || !editableGrant || !editor || lock.current || (status === 'submitted' && !form.current?.reportValidity())) return;
    let draft: Draft;
    try { draft = payload(editor); } catch { setError('validation'); return; }
    const requestId = crypto.randomUUID();
    const body = editor.id ? { id: editor.id, requestId, expectedRevision: editor.revision, draft, status } : { requestId, spaceId: editor.spaceId, kind: editor.kind, projectId: editor.projectId, status, draft };
    const command: Pending = { requestId, method: editor.id ? 'PATCH' : 'POST', body: JSON.stringify(body), spaceId: editor.spaceId, kind: editor.kind, projectId: editor.projectId, id: editor.id, revision: editor.revision };
    pending.current = command;
    void run('saving', active => perform(command, active));
  };
  const checkSaved = () => run('loading', async active => {
    const command = pending.current;
    if (!command) return;
    const result = object(await request(`${API}?requestId=${encodeURIComponent(command.requestId)}`));
    if (!active()) return;
    if (result.item === null && result.requestReceipt === null) { setRetryExact(true); setNotice('not_saved'); return; }
    const receipt = object(result.requestReceipt);
    const saved = detail(result.item);
    if (receipt.requestId !== command.requestId || saved.spaceId !== command.spaceId || saved.kind !== command.kind || saved.projectId !== command.projectId || command.id && saved.id !== command.id || !Number.isInteger(receipt.revision) || Number(receipt.revision) <= command.revision) throw new Failure('request');
    accept(saved); setNotice(saved.status === 'submitted' ? 'submitted' : 'saved');
  });
  const searchDuplicates = () => run('loading', async active => {
    if (!editor || query.trim().length < 2) return;
    const params = new URLSearchParams({ spaceId: editor.spaceId, kind: editor.kind, q: query.trim() });
    if (editor.projectId) params.set('projectId', editor.projectId);
    const row = object(await request(`${API}?${params}`));
    if (!Array.isArray(row.projects) || !Array.isArray(row.units)) throw new Failure('request');
    const result: Hints = { projects: row.projects.map(value => { const item = object(value); return { id: text(item.id), name: text(item.name), address: typeof item.address === 'string' ? item.address : '' }; }), units: row.units.map(value => { const item = object(value); return { id: text(item.id), name: text(item.name), projectId: text(item.projectId) }; }) };
    if (active()) setHints(result);
  });
  const field = (key: string, options: { number?: boolean; min?: number; max?: number; step?: string; maxLength?: number; required?: boolean } = {}) => <label className="block text-small" key={key}>{l(`field.${key}`)}<input className={INPUT} type={options.number ? 'number' : 'text'} value={String(editor?.draft[key] ?? '')} onChange={event => setField(key, event.target.value)} min={options.min} max={options.max} step={options.step} maxLength={options.maxLength} required={options.required} /></label>;

  return <main className="mx-auto max-w-5xl px-16 py-32 md:px-24">
    <h1 className="font-display text-display-xl font-semibold">{l('title')}</h1>
    <p className="mt-12 text-text-secondary">{l('intro')}</p><p className="mt-8 text-small text-text-secondary">{l('boundaries')}</p>
    {fromOperations && <p role="status" className="mt-16 rounded-md border border-border-line p-16">{l('operations_notice')}</p>}
    {error && <p role="alert" className="mt-16 text-state-error">{l(`error.${error}`)}</p>}
    {notice && <p role="status" className="mt-16 text-state-success">{l(notice)}</p>}
    {busy && <p role="status" className="mt-16">{l(busy)}</p>}
    {uncertain && <div className="mt-16 flex flex-wrap gap-12"><button className={BUTTON} disabled={!!busy || blocked} onClick={() => void checkSaved()}>{l('check_saved')}</button>{retryExact && <button className={BUTTON} disabled={!!busy || blocked} onClick={() => { const command = pending.current; if (command) void run('saving', active => perform(command, active)); }}>{l('retry_exact')}</button>}</div>}
    {conflict && editor?.id && <button className={`${BUTTON} mt-16`} disabled={!!busy} onClick={() => { if (canLeave()) void load(editor.id!); }}>{l('load_latest')}</button>}
    <button className={`${BUTTON} mt-16`} disabled={!!busy || uncertain} onClick={() => void load()}>{l('retry')}</button>
    {loaded && spaces.length === 0 && <p className="mt-20 rounded-md border border-border-line p-16">{l('no_scope')}</p>}
    {loaded && spaces.length > 0 && !editor && <section className="stitch-panel mt-24 space-y-16 p-20">
      <label className="block text-small" htmlFor="creation-space">{l('space')}</label><select id="creation-space" className={INPUT} value={spaceId} disabled={!!busy || uncertain} onChange={event => { setSpaceId(event.target.value); setProjectId(''); const space = spaces.find(item => item.id === event.target.value); if (kind === 'unit' && !space?.canCreateUnit || kind === 'complex' && !space?.canCreateComplex) setKind(''); }}><option value="">{l('choose_space')}</option>{spaces.map(space => <option key={space.id} value={space.id}>{space.name}</option>)}</select>
      <label className="block text-small" htmlFor="creation-kind">{l('kind')}</label><select id="creation-kind" className={INPUT} value={kind} disabled={!!busy || !selectedSpace} onChange={event => { setKind(event.target.value as Kind | ''); setProjectId(''); }}><option value="">{l('choose_kind')}</option>{selectedSpace?.canCreateUnit && <option value="unit">{l('unit')}</option>}{selectedSpace?.canCreateComplex && <option value="complex">{l('complex')}</option>}</select>
      {kind === 'unit' && selectedSpace?.canCreateUnit && <><label className="block text-small" htmlFor="creation-project">{l('project')}</label><select id="creation-project" className={INPUT} value={projectId} disabled={!!busy} onChange={event => setProjectId(event.target.value)}><option value="">{l('choose_project')}</option>{selectedSpace.projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select>{!selectedSpace.projects.length && <p>{l('no_projects')}</p>}</>}
      <button className={`${BUTTON} bg-brand-andaman text-white`} disabled={!!busy || !canStart} onClick={start}>{l('start')}</button>
    </section>}
    {editor && <section className="stitch-panel mt-24 p-20 md:p-24">
      <div className="flex flex-wrap items-center justify-between gap-12"><h2 className="font-display text-heading-2 font-semibold">{l(editor.kind)}</h2><span>{l(`status.${editor.matchedExisting ? 'matched' : editor.status}`)}</span></div>
      <p className="mt-8 text-small">{l('space')}: {editorSpace?.name || editor.spaceId}{editor.projectId && <> · {l('project')}: {editorSpace?.projects.find(project => project.id === editor.projectId)?.name || editor.projectId}</>}</p>
      {editor.id && <p className="mt-8 text-small text-text-secondary">{l('scope_fixed')}</p>}
      {!editableGrant && <p role="alert" className="mt-12 text-state-error">{l('error.forbidden')}</p>}
      {readOnly && <p className="mt-12">{l(editor.matchedExisting ? 'matched' : editor.status === 'converted' ? editor.createdUnitId || editor.createdProjectId ? 'converted' : 'status.converted' : 'readonly')}</p>}
      {editor.status === 'converted' && (editor.createdUnitId || editor.createdProjectId) && <Link className="mt-16 inline-block text-brand-andaman underline" href={`/property/content?scope=${editor.createdUnitId ? 'unit' : 'project'}&targetId=${encodeURIComponent(editor.createdUnitId || editor.createdProjectId!)}`}>{l('propose')}</Link>}
      <form ref={form} className="mt-20" onSubmit={event => { event.preventDefault(); save('submitted'); }}>
        <fieldset disabled={disabled || !editableGrant} className="grid gap-16 md:grid-cols-2">
          {editor.kind === 'unit' ? <>
            {field('unitName', { required: true, maxLength: 160 })}
            <div><label htmlFor="creation-unit-type">{l('field.unitType')}</label><select id="creation-unit-type" className={INPUT} value={String(editor.draft.unitType || 'condo')} onChange={event => setField('unitType', event.target.value)}>{['condo', 'villa', 'apartment', 'house'].map(type => <option key={type} value={type}>{l(`type.${type}`)}</option>)}</select></div>
            {['bedrooms', 'bathrooms', 'maxGuests'].map(key => field(key, { number: true, min: key === 'maxGuests' ? 1 : 0, max: key === 'maxGuests' ? 500 : 100, step: '1', required: true }))}{field('sizeSqm', { number: true, min: 0, max: 100000, step: '1' })}{field('floor', { maxLength: 40 })}
          </> : <>
            {field('proposedProject', { required: true, maxLength: 160 })}{field('projectAddress', { required: true, maxLength: 500 })}
            <div><label htmlFor="creation-complex-type">{l('field.projectType')}</label><select id="creation-complex-type" className={INPUT} value={String(editor.draft.projectType || 'condominium')} onChange={event => setField('projectType', event.target.value)}>{['condominium', 'resort', 'villa_estate', 'standalone'].map(type => <option key={type} value={type}>{l(`type.${type}`)}</option>)}</select></div>
            <div><label htmlFor="creation-area">{l('field.areaId')}</label><select id="creation-area" className={INPUT} value={String(editor.draft.areaId || '')} required onChange={event => setField('areaId', event.target.value)}><option value="">{l('choose_area')}</option>{areas.map(area => <option key={area.id} value={area.id}>{area.name}</option>)}</select></div>
            {field('latitude', { number: true, min: -90, max: 90, step: 'any', required: true })}{field('longitude', { number: true, min: -180, max: 180, step: 'any', required: true })}
          </>}
          <div><label htmlFor="creation-description-locale">{l('field.descriptionLocale')}</label><select id="creation-description-locale" className={INPUT} required={!!String(editor.draft.description || '').trim()} value={String(editor.draft.descriptionLocale || '')} onChange={event => setField('descriptionLocale', event.target.value)}><option value="">{l('choose_locale')}</option>{['en', 'ru', 'th', 'zh'].map(locale => <option key={locale} value={locale}>{locale.toUpperCase()}</option>)}</select></div>
          <div className="text-small md:col-span-2"><label htmlFor="creation-description" className="block">{l('field.description')}</label><textarea id="creation-description" aria-describedby="creation-public-content-hint" className={`${INPUT} min-h-[144px]`} maxLength={3000} value={String(editor.draft.description || '')} onChange={event => setField('description', event.target.value)} /></div>
          <p id="creation-public-content-hint" className="text-small text-text-secondary md:col-span-2">{l('public_content_hint')}</p>
        </fieldset>
        {!readOnly && <div className="sticky bottom-0 mt-24 flex flex-wrap gap-12 bg-surface-paper py-16"><button type="button" className={BUTTON} disabled={disabled || !editableGrant || !!editor.id && !editor.dirty} onClick={() => save('draft')}>{l('save')}</button><button type="submit" className={`${BUTTON} bg-brand-andaman text-white`} disabled={disabled || !editableGrant}>{l('submit')}</button></div>}
      </form>
      {!readOnly && <div className="mt-20 border-t border-border-line pt-16"><label className="block text-small">{l('duplicate_query')}<input className={INPUT} value={query} maxLength={160} disabled={disabled || !editableGrant} onChange={event => { setQuery(event.target.value); setHints(null); }} /></label><button type="button" className={`${BUTTON} mt-12`} disabled={disabled || !editableGrant || query.trim().length < 2} onClick={() => void searchDuplicates()}>{l('duplicates')}</button><p className="mt-8 text-small text-text-secondary">{l('duplicate_hint')}</p>{hints && <ul className="mt-12 space-y-8">{hints.projects.map(project => <li key={`project-${project.id}`}>{project.name}{project.address && <> · {project.address}</>}</li>)}{hints.units.map(unit => <li key={`unit-${unit.id}`}>{unit.name}</li>)}{!hints.projects.length && !hints.units.length && <li>{l('duplicates_empty')}</li>}</ul>}</div>}
      <button className={`${BUTTON} mt-20`} disabled={!!busy || uncertain} onClick={() => { if (canLeave()) { setEditor(null); setHints(null); setSpaceId(''); setProjectId(''); setKind(initialKind || ''); setConflict(false); setError(null); setNotice(null); } }}>{l('new')}</button>
    </section>}
    {loaded && <section className="mt-32"><h2 className="font-display text-heading-2 font-semibold">{l('applications')}</h2>{!items.length ? <p className="mt-12">{l('empty')}</p> : <ul className="mt-12 space-y-12">{items.map(item => <li key={item.id} className="stitch-panel flex flex-wrap items-center justify-between gap-12 p-16"><div><strong>{String(item.draft.unitName || item.draft.proposedProject || l('untitled'))}</strong><p className="mt-4 text-small">{l(item.kind)} · {l(`status.${item.matchedExisting ? 'matched' : item.status}`)}</p></div><button className={BUTTON} disabled={!!busy || uncertain} onClick={() => { if (canLeave()) void load(item.id); }}>{l('open')}</button></li>)}</ul>}</section>}
  </main>;
}
