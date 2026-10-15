'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import {
  parseContentProposal, parseScope, parseTargetId,
  type ContentLocale, type ContentProposal, type ContentScope,
} from '@/modules/onboarding/content-proposal.schema';
import { CONTENT_UI_LABELS } from './UI-labels';

const API = '/api/property-content-proposals';
const LOCALES: ContentLocale[] = ['en', 'ru', 'th', 'zh'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const PHOTO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const INPUT_CLASS = 'mt-4 min-h-[44px] w-full rounded-md border border-border-line bg-surface-paper px-12 py-8 text-body text-text-ink disabled:opacity-60';
const BUTTON_CLASS = 'min-h-[44px] rounded-md border border-border-line px-16 py-8 text-small font-semibold disabled:cursor-not-allowed disabled:opacity-50';

type Target = { scope: ContentScope; id: string; projectId: string; name: string; projectName?: string };
type Summary = { id: string; scope: ContentScope; targetId: string; targetName: string; status: string; revision: number; reviewNote?: string | null };
type Media = { id: string; url: string };
type Snapshot = { facts: ContentProposal['facts']; descriptions: Partial<Record<ContentLocale, string>>; gallery: ContentProposal['gallery'] & { media: Media[] } };
type Detail = { id: string; scope: ContentScope; targetId: string; status: string; revision: number; baselineVersion: string; baseline: Snapshot; proposal: ContentProposal; reviewNote: string | null; proposalMedia: Media[] };
type Editor = {
  scope: ContentScope; targetId: string; targetName: string; id: string | null;
  revision: number | null; baselineVersion: string; status: string; reviewNote: string | null;
  fields: Record<string, string>; descriptionEnabled: boolean; descriptionLocale: ContentLocale;
  descriptionTexts: Record<ContentLocale, string>; mediaIds: string[]; coverMediaId: string | null;
  mediaUrls: Record<string, string>; dirty: boolean;
};
type Field = { key: string; max?: number; step?: number; number?: boolean; nullable?: boolean; required?: boolean; list?: boolean };
const UNIT_FIELDS: Field[] = [
  { key: 'name', max: 160, required: true }, { key: 'bedrooms', number: true, max: 1000, required: true },
  { key: 'bathrooms', number: true, max: 1000, required: true }, { key: 'maxGuests', number: true, max: 1000, required: true },
  { key: 'grossAreaSqm', number: true, nullable: true, max: 99_999_999.99, step: 0.01 },
  { key: 'sizeSqm', number: true, nullable: true, max: 1_000_000 }, { key: 'floor', max: 40, nullable: true },
  { key: 'addressSupplement', max: 500 }, { key: 'amenityKeys', list: true },
];
const PROJECT_FIELDS: Field[] = [
  { key: 'name', max: 160, required: true }, { key: 'brand', max: 160, nullable: true },
  { key: 'address', max: 500, required: true }, { key: 'city', max: 160, nullable: true },
  { key: 'district', max: 160, nullable: true }, { key: 'projectType', nullable: true },
  { key: 'totalUnits', number: true, nullable: true, max: 1_000_000 },
];

class RequestError extends Error {
  constructor(readonly key: string) { super(key); }
}

function errorKey(error: unknown): string {
  return error instanceof RequestError ? error.key : 'request_error';
}

async function request(url: string, signal: AbortSignal, init: RequestInit = {}): Promise<unknown> {
  const response = await fetch(url, { ...init, signal, cache: 'no-store', credentials: 'same-origin' });
  if (!response.ok) {
    throw new RequestError(({ 400: 'validation', 401: 'unauthorized', 403: 'forbidden', 404: 'not_found', 409: 'conflict' } as Record<number, string>)[response.status] || 'request_error');
  }
  try { return await response.json(); } catch { throw new RequestError('invalid_response'); }
}

async function requestTarget(url: string, signal: AbortSignal): Promise<unknown> {
  try { return await request(url, signal); }
  catch (reason) {
    if (reason instanceof RequestError && reason.key === 'conflict') throw new RequestError('target_unavailable');
    throw reason;
  }
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new RequestError('invalid_response');
  return value as Record<string, unknown>;
}

function text(value: unknown): string {
  if (typeof value !== 'string') throw new RequestError('invalid_response');
  return value;
}

function imageUrl(value: unknown): string {
  const url = text(value);
  return /^(https?:\/\/|\/(?!\/))/.test(url) ? url : '';
}

function readMedia(value: unknown): Media[] {
  if (!Array.isArray(value)) return [];
  return value.map(item => {
    const row = object(item);
    return { id: text(row.id), url: imageUrl(row.url) };
  });
}

function readTarget(value: unknown): Target {
  const row = object(value);
  return { scope: parseScope(row.scope), id: parseTargetId(row.id), projectId: text(row.projectId), name: text(row.name), ...(typeof row.projectName === 'string' ? { projectName: row.projectName } : {}) };
}

function readSnapshot(scope: ContentScope, value: unknown): Snapshot {
  const row = object(value);
  const gallery = object(row.gallery);
  const payload = parseContentProposal(scope, { facts: row.facts, description: null, gallery: { mediaIds: gallery.mediaIds, coverMediaId: gallery.coverMediaId } });
  const descriptions = object(row.descriptions);
  const strings: Partial<Record<ContentLocale, string>> = {};
  for (const locale of LOCALES) if (typeof descriptions[locale] === 'string') strings[locale] = descriptions[locale] as string;
  return { facts: payload.facts, descriptions: strings, gallery: { ...payload.gallery, media: readMedia(gallery.media) } };
}

function readDetail(value: unknown): Detail {
  const row = object(value);
  const scope = parseScope(row.scope);
  if (!Number.isInteger(row.revision) || Number(row.revision) < 1) throw new RequestError('invalid_response');
  const baselineVersion = text(row.baselineVersion);
  if (!baselineVersion) throw new RequestError('invalid_response');
  return {
    id: parseTargetId(row.id), scope, targetId: parseTargetId(row.targetId), status: text(row.status),
    revision: Number(row.revision), baselineVersion, baseline: readSnapshot(scope, row.baseline),
    proposal: parseContentProposal(scope, row.proposal), reviewNote: typeof row.reviewNote === 'string' ? row.reviewNote : null,
    proposalMedia: readMedia(row.media),
  };
}

function readIndex(value: unknown): { targets: Target[]; items: Summary[] } {
  const row = object(value);
  if (!Array.isArray(row.targets) || !Array.isArray(row.items)) throw new RequestError('invalid_response');
  return {
    targets: row.targets.map(readTarget),
    items: row.items.map(item => {
      const entry = object(item);
      return { id: parseTargetId(entry.id), scope: parseScope(entry.scope), targetId: parseTargetId(entry.targetId), targetName: text(entry.targetName), status: text(entry.status), revision: Number(entry.revision), reviewNote: typeof entry.reviewNote === 'string' ? entry.reviewNote : null };
    }),
  };
}

function editorFrom(
  scope: ContentScope, targetId: string, targetName: string, baselineVersion: string,
  snapshot: Snapshot, payload: ContentProposal, locale: ContentLocale, detail?: Detail,
): Editor {
  const descriptionTexts: Record<ContentLocale, string> = { en: '', ru: '', th: '', zh: '', ...snapshot.descriptions };
  if (payload.description) descriptionTexts[payload.description.locale] = payload.description.value;
  return {
    scope, targetId, targetName, id: detail?.id ?? null, revision: detail?.revision ?? null,
    baselineVersion, status: detail?.status ?? 'draft', reviewNote: detail?.reviewNote ?? null,
    fields: Object.fromEntries(Object.entries(payload.facts).map(([key, value]) => [key, Array.isArray(value) ? value.join('\n') : value === null ? '' : String(value)])),
    descriptionEnabled: payload.description !== null, descriptionLocale: payload.description?.locale ?? locale,
    descriptionTexts, mediaIds: [...payload.gallery.mediaIds], coverMediaId: payload.gallery.coverMediaId,
    mediaUrls: Object.fromEntries([...snapshot.gallery.media, ...(detail?.proposalMedia ?? [])].map(media => [media.id, media.url])), dirty: false,
  };
}

function payloadFrom(editor: Editor): ContentProposal {
  const facts: Record<string, unknown> = {};
  for (const field of editor.scope === 'unit' ? UNIT_FIELDS : PROJECT_FIELDS) {
    const value = editor.fields[field.key] ?? '';
    facts[field.key] = field.list ? value.split('\n').map(item => item.trim()).filter(Boolean)
      : field.number ? value.trim() === '' ? field.nullable ? null : NaN : Number(value)
      : field.nullable && value.trim() === '' ? null : value;
  }
  return parseContentProposal(editor.scope, {
    facts, description: editor.descriptionEnabled ? { locale: editor.descriptionLocale, value: editor.descriptionTexts[editor.descriptionLocale] } : null,
    gallery: { mediaIds: editor.mediaIds, coverMediaId: editor.coverMediaId },
  });
}

export default function ContentClient({ labels, initialLocale = 'en', initialProposalId }: {
  labels: Record<string, string>; initialLocale?: ContentLocale; initialProposalId?: string;
}) {
  const l = (key: string) => labels[`property.content.${key}`] || CONTENT_UI_LABELS[`property.content.${key}`] || CONTENT_UI_LABELS['property.content.status.unknown'];
  const [targets, setTargets] = useState<Target[]>([]);
  const [items, setItems] = useState<Summary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [choice, setChoice] = useState('');
  const [editor, setEditor] = useState<Editor | null>(null);
  const [busy, setBusy] = useState<string | null>('loading');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [accessBlocked, setAccessBlocked] = useState(false);
  const [writeUncertain, setWriteUncertain] = useState(false);
  const mounted = useRef(false);
  const lock = useRef(false);
  const sequence = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const readOnly = !!editor && !['draft', 'returned'].includes(editor.status);
  const disabled = !!busy || readOnly || accessBlocked || writeUncertain;

  const run = useCallback(async (kind: string, action: (signal: AbortSignal, active: () => boolean) => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    const token = ++sequence.current;
    const abort = new AbortController();
    controller.current = abort;
    const active = () => mounted.current && sequence.current === token;
    setBusy(kind); setError(null); setNotice(null);
    try { await action(abort.signal, active); }
    catch (reason) {
      if (active()) {
        const key = errorKey(reason);
        setError(key);
        if (key === 'forbidden') setAccessBlocked(true);
      }
    } finally {
      if (active()) { lock.current = false; setBusy(null); controller.current = null; }
    }
  }, []);

  const loadIndex = useCallback((openId?: string) => run('loading', async (signal, active) => {
    const index = readIndex(await request(API, signal));
    if (!active()) return;
    setTargets(index.targets); setItems(index.items); setLoaded(true);
    if (openId) {
      const detail = readDetail(await request(`${API}/${encodeURIComponent(parseTargetId(openId))}`, signal));
      if (!active()) return;
      const target = index.targets.find(item => item.scope === detail.scope && item.id === detail.targetId);
      setEditor(editorFrom(detail.scope, detail.targetId, target?.name ?? detail.proposal.facts.name, detail.baselineVersion, detail.baseline, detail.proposal, initialLocale, detail));
      setAccessBlocked(false); setWriteUncertain(false);
    }
  }), [run, initialLocale]);

  useEffect(() => {
    mounted.current = true;
    void loadIndex(initialProposalId);
    return () => { mounted.current = false; sequence.current += 1; lock.current = false; controller.current?.abort(); };
  }, [loadIndex, initialProposalId]);

  useEffect(() => {
    if (!editor?.dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [editor?.dirty]);

  const confirmDiscard = () => !editor?.dirty || window.confirm(l('discard_confirm'));
  const statusLabel = (status: string) => l(`status.${status}`);
  const update = (change: Partial<Editor>) => setEditor(current => current ? { ...current, ...change, dirty: true } : current);

  const openTarget = () => {
    const target = targets.find(item => `${item.scope}:${item.id}` === choice);
    if (!target || !confirmDiscard()) return;
    void run('loading', async (signal, active) => {
      const result = object(await requestTarget(`${API}/target?scope=${target.scope}&id=${encodeURIComponent(target.id)}`, signal));
      const actual = readTarget(result.target);
      if (actual.scope !== target.scope || actual.id !== target.id) throw new RequestError('invalid_response');
      const snapshot = readSnapshot(actual.scope, result.snapshot);
      const baselineVersion = text(result.baselineVersion);
      if (!baselineVersion) throw new RequestError('invalid_response');
      if (!active()) return;
      setEditor(editorFrom(actual.scope, actual.id, actual.name, baselineVersion, snapshot, { facts: snapshot.facts, description: null, gallery: { mediaIds: snapshot.gallery.mediaIds, coverMediaId: snapshot.gallery.coverMediaId } }, initialLocale));
      setAccessBlocked(false); setWriteUncertain(false);
    });
  };

  const openProposal = (id: string) => {
    if (!confirmDiscard()) return;
    void run('loading', async (signal, active) => {
      const detail = readDetail(await request(`${API}/${encodeURIComponent(id)}`, signal));
      if (detail.id !== id) throw new RequestError('invalid_response');
      if (!active()) return;
      const target = targets.find(item => item.scope === detail.scope && item.id === detail.targetId);
      setEditor(editorFrom(detail.scope, detail.targetId, target?.name ?? detail.proposal.facts.name, detail.baselineVersion, detail.baseline, detail.proposal, initialLocale, detail));
      setAccessBlocked(false); setWriteUncertain(false);
    });
  };

  const acceptDetail = (detail: Detail, previous: Editor) => {
    const next = editorFrom(detail.scope, detail.targetId, previous.targetName, detail.baselineVersion, detail.baseline, detail.proposal, previous.descriptionLocale, detail);
    next.mediaUrls = { ...previous.mediaUrls, ...next.mediaUrls };
    setEditor(next); setAccessBlocked(false); setWriteUncertain(false);
    const summary: Summary = { id: detail.id, scope: detail.scope, targetId: detail.targetId, targetName: previous.targetName, status: detail.status, revision: detail.revision, reviewNote: detail.reviewNote };
    setItems(current => [summary, ...current.filter(item => item.id !== detail.id)]);
  };

  const save = (status: 'draft' | 'submitted') => {
    if (!editor || disabled || !form.current?.reportValidity()) return;
    let proposal: ContentProposal;
    try { proposal = payloadFrom(editor); } catch { setError('validation'); return; }
    void run(status === 'draft' ? 'saving' : 'submitting', async (signal, active) => {
      const body = editor.id
        ? { expectedRevision: editor.revision, proposal, status }
        : { scope: editor.scope, targetId: editor.targetId, baselineVersion: editor.baselineVersion, proposal, status };
      try {
        const detail = readDetail(await request(editor.id ? `${API}/${encodeURIComponent(editor.id)}` : API, signal, { method: editor.id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));
        if (detail.scope !== editor.scope || detail.targetId !== editor.targetId || (editor.id && detail.id !== editor.id)) throw new RequestError('invalid_response');
        if (!active()) return;
        acceptDetail(detail, editor); setNotice(status === 'draft' ? 'saved' : 'submitted');
      } catch (reason) {
        if (!(reason instanceof RequestError) || ['request_error', 'invalid_response'].includes(reason.key)) {
          if (active()) setWriteUncertain(true);
          throw new RequestError('save_uncertain');
        }
        throw reason;
      }
    });
  };

  const refresh = () => {
    if (!editor || disabled || !window.confirm(l('refresh_confirm'))) return;
    void run('refreshing', async (signal, active) => {
      if (editor.id) {
        try {
          const detail = readDetail(await request(`${API}/${encodeURIComponent(editor.id)}`, signal, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expectedRevision: editor.revision, action: 'rebase' }) }));
          if (detail.id !== editor.id || detail.targetId !== editor.targetId || detail.scope !== editor.scope) throw new RequestError('invalid_response');
          if (active()) { acceptDetail(detail, editor); setNotice('rebased'); }
        } catch (reason) {
          if (!(reason instanceof RequestError) || ['request_error', 'invalid_response'].includes(reason.key)) {
            if (active()) setWriteUncertain(true);
            throw new RequestError('save_uncertain');
          }
          throw reason;
        }
      } else {
        const result = object(await requestTarget(`${API}/target?scope=${editor.scope}&id=${encodeURIComponent(editor.targetId)}`, signal));
        const target = readTarget(result.target);
        if (target.scope !== editor.scope || target.id !== editor.targetId) throw new RequestError('invalid_response');
        const snapshot = readSnapshot(target.scope, result.snapshot);
        const baselineVersion = text(result.baselineVersion);
        if (!baselineVersion) throw new RequestError('invalid_response');
        if (active()) {
          setEditor(editorFrom(target.scope, target.id, target.name, baselineVersion, snapshot, { facts: snapshot.facts, description: null, gallery: { mediaIds: snapshot.gallery.mediaIds, coverMediaId: snapshot.gallery.coverMediaId } }, editor.descriptionLocale));
          setNotice('rebased');
        }
      }
    });
  };

  const upload = (files: File[]) => {
    if (!editor || disabled || !files.length) return;
    if (files.length + editor.mediaIds.length > 200 || files.some(file => !PHOTO_MIME_TYPES.includes(file.type) || file.size > 8 * 1024 * 1024 || file.size === 0)) { setError('upload_invalid'); return; }
    void run('uploading', async (signal, active) => {
      let uploaded = 0;
      try {
        for (const file of files) {
          const body = new FormData(); body.set('file', file); body.set('kind', 'photo');
          const result = object(await request('/api/media/upload', signal, { method: 'POST', body }));
          const id = text(result.mediaAssetId); const url = imageUrl(result.url);
          if (!UUID.test(id) || !url) throw new RequestError('invalid_response');
          if (!active()) return;
          setEditor(current => current && current.scope === editor.scope && current.targetId === editor.targetId ? {
            ...current, mediaIds: current.mediaIds.includes(id) ? current.mediaIds : [...current.mediaIds, id],
            mediaUrls: { ...current.mediaUrls, [id]: url }, dirty: true,
          } : current);
          uploaded += 1;
        }
      } catch (reason) { if (uploaded && active()) setNotice('upload_partial'); throw reason; }
    });
  };

  const move = (index: number, offset: number) => {
    if (!editor || disabled) return;
    const next = [...editor.mediaIds]; const to = index + offset;
    if (to < 0 || to >= next.length) return;
    [next[index], next[to]] = [next[to], next[index]];
    update({ mediaIds: next });
  };

  return <main className="mx-auto max-w-6xl space-y-24 px-16 py-24 md:px-32" aria-busy={!!busy}>
    <header><h1 className="font-display text-display font-semibold text-text-ink">{l('title')}</h1><p className="mt-8 max-w-3xl text-body text-text-secondary">{l('intro')}</p></header>
    {busy ? <p role="status">{l(busy)}</p> : null}
    {error ? <div role="alert" className="rounded-md border border-state-error p-16 text-state-error"><p>{l(error)}</p><button type="button" disabled={!!busy} onClick={() => void loadIndex()} className={`${BUTTON_CLASS} mt-8`}>{l('retry')}</button>{editor?.id ? <button type="button" disabled={!!busy} onClick={() => openProposal(editor.id!)} className={`${BUTTON_CLASS} ml-8 mt-8`}>{l('open')}</button> : null}</div> : null}
    {notice ? <p role="status" className="rounded-md bg-surface-ivory p-16">{l(notice)}</p> : null}
    {writeUncertain && error !== 'save_uncertain' ? <p role="alert">{l('save_uncertain')}</p> : null}
    {accessBlocked && error !== 'forbidden' ? <p role="alert">{l('forbidden')}</p> : null}
    <section aria-labelledby="content-targets" className="stitch-panel rounded-lg border border-border-line bg-surface-paper p-20">
      <h2 id="content-targets" className="font-display text-heading-3">{l('targets')}</h2>
      {loaded && !targets.length ? <p className="mt-12">{l('no_targets')}</p> : <div className="mt-12 flex flex-col gap-12 sm:flex-row sm:items-end"><div className="min-w-0 flex-1"><label htmlFor="content-target">{l('target')}</label><select id="content-target" className={INPUT_CLASS} value={choice} disabled={!!busy} onChange={event => setChoice(event.target.value)}><option value="">{l('choose')}</option>{targets.map(target => <option key={`${target.scope}:${target.id}`} value={`${target.scope}:${target.id}`}>{l(target.scope)}: {target.name}{target.projectName ? ` · ${target.projectName}` : ''}</option>)}</select></div><button type="button" className={BUTTON_CLASS} disabled={!!busy || !choice} onClick={openTarget}>{l('new')}</button></div>}
    </section>
    <section aria-labelledby="content-proposals" className="stitch-panel rounded-lg border border-border-line bg-surface-paper p-20"><h2 id="content-proposals" className="font-display text-heading-3">{l('proposals')}</h2>{loaded && !items.length ? <p className="mt-12">{l('no_proposals')}</p> : <ul className="mt-12 space-y-8">{items.map(item => <li key={item.id} className="flex flex-wrap items-center justify-between gap-8 rounded-md border border-border-line p-12"><span className="min-w-0 break-words">{item.targetName} · {statusLabel(item.status)}</span><button className={BUTTON_CLASS} type="button" disabled={!!busy} onClick={() => openProposal(item.id)} aria-label={`${l('open')}: ${item.targetName}`}>{l('open')}</button></li>)}</ul>}</section>
    {editor ? <form ref={form} onSubmit={(event: FormEvent) => { event.preventDefault(); save('draft'); }} className="space-y-24">
      <section className="stitch-panel rounded-lg border border-border-line bg-surface-paper p-20">
        <h2 className="break-words font-display text-heading-2">{editor.targetName}</h2><p className="mt-8">{statusLabel(editor.status)} · {l(editor.dirty ? 'dirty' : 'clean')}</p>
        {readOnly ? <p className="mt-8">{l('read_only')}</p> : null}
        {editor.reviewNote ? <aside className="mt-16 rounded-md bg-surface-ivory p-16"><h3 className="font-semibold">{l('review_note')}</h3><p className="mt-8 whitespace-pre-wrap break-words">{editor.reviewNote}</p></aside> : null}
      </section>
      <fieldset disabled={disabled} className="stitch-panel rounded-lg border border-border-line bg-surface-paper p-20"><legend className="px-4 font-display text-heading-3">{l('facts')}</legend><p className="mb-16 text-small text-text-secondary">{l('facts_hint')}</p>{editor.scope === 'unit' ? <p className="mb-16 text-small text-text-secondary">{l('unit_name_hint')}</p> : null}<div className="grid gap-16 sm:grid-cols-2">{(editor.scope === 'unit' ? UNIT_FIELDS : PROJECT_FIELDS).map(field => <div key={field.key} className={field.list ? 'sm:col-span-2' : ''}><label htmlFor={`content-${field.key}`} className="font-semibold">{l(`field.${field.key === 'name' && editor.scope === 'unit' ? 'unitName' : field.key}`)}</label>{field.key === 'projectType' ? <select id={`content-${field.key}`} className={INPUT_CLASS} value={editor.fields[field.key]} onChange={event => update({ fields: { ...editor.fields, [field.key]: event.target.value } })}><option value="">{l('optional')}</option>{['resort', 'condominium', 'villa_estate', 'standalone'].map(type => <option key={type} value={type}>{l(`type.${type}`)}</option>)}</select> : field.list ? <><textarea id={`content-${field.key}`} rows={4} className={INPUT_CLASS} value={editor.fields[field.key]} aria-describedby={`content-${field.key}-hint`} onChange={event => update({ fields: { ...editor.fields, [field.key]: event.target.value } })}/><p id={`content-${field.key}-hint`} className="mt-4 text-small">{l('list_hint')}</p></> : <input id={`content-${field.key}`} className={INPUT_CLASS} type={field.number ? 'number' : 'text'} min={field.number ? 0 : undefined} max={field.number ? field.max : undefined} step={field.number ? field.step ?? 1 : undefined} maxLength={field.number ? undefined : field.max} required={field.required} value={editor.fields[field.key]} onChange={event => update({ fields: { ...editor.fields, [field.key]: event.target.value } })}/>}</div>)}</div></fieldset>
      <fieldset disabled={disabled} className="stitch-panel rounded-lg border border-border-line bg-surface-paper p-20"><legend className="px-4 font-display text-heading-3">{l('description')}</legend><div className="flex items-center gap-8"><input id="content-description-enabled" type="checkbox" checked={editor.descriptionEnabled} onChange={event => update({ descriptionEnabled: event.target.checked })}/><label htmlFor="content-description-enabled">{l('description_enabled')}</label></div><p className="mt-8 text-small text-text-secondary">{l('description_hint')}</p>{editor.descriptionEnabled ? <div className="mt-16 space-y-16"><div><label htmlFor="content-description-locale">{l('description_locale')}</label><select id="content-description-locale" className={INPUT_CLASS} value={editor.descriptionLocale} onChange={event => update({ descriptionLocale: event.target.value as ContentLocale })}>{LOCALES.map(locale => <option key={locale} value={locale}>{l(`locale.${locale}`)}</option>)}</select></div><div><label htmlFor="content-description-value">{l('description_value')}</label><textarea id="content-description-value" className={INPUT_CLASS} rows={7} required maxLength={3000} aria-describedby="content-description-hint" value={editor.descriptionTexts[editor.descriptionLocale]} onChange={event => update({ descriptionTexts: { ...editor.descriptionTexts, [editor.descriptionLocale]: event.target.value } })}/><p id="content-description-hint" className="mt-4 text-small">{l('description_limit')} {editor.descriptionTexts[editor.descriptionLocale].length}/3000</p></div></div> : null}</fieldset>
      <fieldset disabled={disabled} className="stitch-panel rounded-lg border border-border-line bg-surface-paper p-20"><legend className="px-4 font-display text-heading-3">{l('gallery')}</legend><p className="text-small text-text-secondary">{l('gallery_hint')}</p><div className="mt-16"><label htmlFor="content-upload" className="font-semibold">{l('upload')}</label><input id="content-upload" type="file" accept={PHOTO_MIME_TYPES.join(',')} multiple className={INPUT_CLASS} aria-describedby="content-upload-hint" onChange={event => { const files = Array.from(event.target.files ?? []); event.target.value = ''; upload(files); }}/><p id="content-upload-hint" className="mt-4 text-small">{l('upload_hint')}</p></div>{!editor.mediaIds.length ? <p className="mt-16">{l('gallery_empty')}</p> : <ol className="mt-16 grid gap-16 sm:grid-cols-2 lg:grid-cols-3">{editor.mediaIds.map((id, index) => <li key={id} className="overflow-hidden rounded-md border border-border-line">{editor.mediaUrls[id] ? (
        // Public photo URLs use the existing media storage service; do not proxy them through an image optimizer.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={editor.mediaUrls[id]} alt={`${l('photo')} ${index + 1}`} className="h-[180px] w-full object-cover"/>
      ) : <p className="p-16">{l('photo_unavailable')}</p>}<div className="flex flex-wrap gap-8 p-12"><button type="button" className={BUTTON_CLASS} aria-pressed={editor.coverMediaId === id} aria-label={`${l('make_cover')} ${index + 1}`} onClick={() => update({ coverMediaId: id })}>{l(editor.coverMediaId === id ? 'cover' : 'make_cover')}</button><button type="button" className={BUTTON_CLASS} disabled={disabled || index === 0} aria-label={`${l('move_up')} ${index + 1}`} onClick={() => move(index, -1)}>{l('move_up')}</button><button type="button" className={BUTTON_CLASS} disabled={disabled || index === editor.mediaIds.length - 1} aria-label={`${l('move_down')} ${index + 1}`} onClick={() => move(index, 1)}>{l('move_down')}</button><button type="button" className={BUTTON_CLASS} aria-label={`${l('remove')} ${index + 1}`} onClick={() => update({ mediaIds: editor.mediaIds.filter(mediaId => mediaId !== id), coverMediaId: editor.coverMediaId === id ? null : editor.coverMediaId })}>{l('remove')}</button></div></li>)}</ol>}{editor.coverMediaId ? <button type="button" className={`${BUTTON_CLASS} mt-12`} onClick={() => update({ coverMediaId: null })}>{l('clear_cover')}</button> : null}</fieldset>
      <div className="flex flex-col flex-wrap gap-12 border-t border-border-line pt-20 sm:flex-row"><button type="submit" className={`${BUTTON_CLASS} bg-surface-paper`} disabled={disabled}>{l('save')}</button><button type="button" className={`${BUTTON_CLASS} bg-brand-andaman text-white`} disabled={disabled} onClick={() => save('submitted')}>{l('submit')}</button><button type="button" className={BUTTON_CLASS} disabled={disabled} onClick={refresh}>{l('refresh')}</button></div>
    </form> : null}
  </main>;
}
