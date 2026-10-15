'use client';
/* eslint-disable local-rules/no-literal-ui-text */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  assessGalleryReadiness,
  MIN_PUBLIC_GALLERY_PHOTOS,
  RECOMMENDED_PUBLIC_GALLERY_PHOTOS,
} from '@/modules/media/public-readiness';

type Scope = 'project' | 'category' | 'unit';
type Asset = {
  id: string;
  storageKey: string;
  mimeType: string;
  kind: string;
  encrypted: boolean;
  sizeBytes: number;
};
type Link = { mediaId: string; sort: number; media: Asset };
type Gallery = { coverMediaId: string | null; galleryMedia?: Link[]; media?: Link[] };
type Target = { id: string; name: string; scope: Scope };
type Item = { mediaId: string; media: Asset };

function endpoint(target: Target) {
  if (target.scope === 'project') return `/api/admin/projects/${target.id}/media`;
  if (target.scope === 'category') return `/api/admin/categories/${target.id}/media`;
  return `/api/admin/units/${target.id}/media`;
}

type Props = {
  projectId: string;
  projectName: string;
  categories: Array<{ id: string; name: string }>;
  units: Array<{ id: string; name: string }>;
  initialSelection?: string;
  onSelectionChange?: (selection: string) => void;
  labels: Record<string,string>;
};

export default function ScopedGalleryEditor(props: Props) {
  const { projectId, categories, units, initialSelection } = props;
  // A deep link can only select an object supplied by this property's loader.
  const selection = initialSelection === `project:${projectId}` ||
    categories.some(category => initialSelection === `category:${category.id}`) ||
    units.some(unit => initialSelection === `unit:${unit.id}`)
    ? initialSelection!
    : `project:${projectId}`;
  // App Router reuses the page for query-only navigation. A new route target
  // needs a fresh editor session, including any pending operation's UI state.
  // Ordinary refreshes keep the key and preserve the user's dropdown choice.
  return <GalleryEditor key={`${projectId}:${selection}`} {...props} initialSelection={selection} />;
}

function GalleryEditor({
  projectId, projectName, categories, units, initialSelection, onSelectionChange, labels,
}: Props) {
  const targets: Target[] = [
    { scope: 'project', id: projectId, name: projectName },
    ...categories.map(c => ({ scope: 'category' as const, id: c.id, name: c.name })),
    ...units.map(u => ({ scope: 'unit' as const, id: u.id, name: u.name })),
  ];
  const [selection, setSelection] = useState(initialSelection ?? `project:${projectId}`);
  const [items, setItems] = useState<Item[]>([]);
  const [cover, setCover] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const operationInFlight = useRef(false);
  const [copiedMediaIds, setCopiedMediaIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadedGalleryUrl, setLoadedGalleryUrl] = useState<string | null>(null);
  const loadRequest = useRef(0);
  const active = useRef(true);
  const [message, setMessage] = useState<string | null>(null);
  const [failedMediaIds, setFailedMediaIds] = useState<Set<string>>(new Set());
  const target = targets.find(t => `${t.scope}:${t.id}` === selection) ?? targets[0];
  const galleryUrl = endpoint(target);
  const currentGalleryUrl = useRef(galleryUrl);
  currentGalleryUrl.current = galleryUrl;
  const readiness = useMemo(
    () =>
      assessGalleryReadiness({
        coverMediaId: cover,
        links: items.map((item, index) => ({
          mediaId: item.mediaId,
          sort: index,
          media: item.media,
        })),
      }),
    [cover, items]
  );
  const effectiveReady = !loading && loadedGalleryUrl === galleryUrl && readiness.ready && failedMediaIds.size === 0;
  const scopeExplanation =
    target.scope === 'project'
      ? 'Shared property spaces: facade, grounds, lobby and common facilities.'
      : target.scope === 'category'
        ? 'Representative room or villa type: layout, bedroom arrangement and type-level character.'
        : 'Exact physical home: its real view, fit-out, rooms and distinguishing details.';

  const load = useCallback(async () => {
    if (!active.current) return false;
    const request = ++loadRequest.current;
    const isCurrent = () => active.current && request === loadRequest.current && galleryUrl === currentGalleryUrl.current;
    setLoading(true);
    setLoadedGalleryUrl(null);
    try {
      const res = await fetch(galleryUrl, { cache: 'no-store' });
      if (!res.ok) throw new Error('Could not load gallery');
      const gallery = await res.json() as Gallery;
      if (!isCurrent()) return false;
      const links = gallery.galleryMedia ?? gallery.media ?? [];
      setFailedMediaIds(new Set());
      setItems(links.map(link => ({ mediaId: link.mediaId, media: link.media })));
      setCover(gallery.coverMediaId);
      setLoadedGalleryUrl(galleryUrl);
      return true;
    } catch (error) {
      if (!isCurrent()) return false;
      setMessage(error instanceof Error ? error.message : 'Could not load gallery');
      return false;
    } finally { if (isCurrent()) setLoading(false); }
  }, [galleryUrl]);

  useEffect(() => {
    active.current = true;
    setCopiedMediaIds(new Set());
    void load();
    return () => { active.current = false; loadRequest.current += 1; };
  }, [load]);

  async function write(method: 'POST' | 'PATCH' | 'DELETE', payload: object | null, mediaId?: string) {
    const url = galleryUrl + (mediaId ? `?mediaId=${encodeURIComponent(mediaId)}` : '');
    const res = await fetch(url, {
      method, headers: payload ? { 'Content-Type': 'application/json' } : undefined,
      body: payload ? JSON.stringify(payload) : undefined,
    });
    if (!res.ok) {
      const response = await res.json().catch(() => null);
      throw new Error(response?.error || 'Could not save gallery');
    }
  }

  async function perform(operation: () => Promise<void>, successMessage = labels['admin.gallery.saved']) {
    if (operationInFlight.current) return;
    operationInFlight.current = true;
    setBusy(true); setMessage(null);
    try { await operation(); if (await load()) setMessage(successMessage); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save gallery'); }
    finally { operationInFlight.current = false; setBusy(false); }
  }

  async function copyToProject(mediaId: string) {
    // Reuse the canonical attachment writer, restricted to this unit's parent
    // project. Never unlink the source or upload a duplicate physical file.
    const destination = endpoint({ scope: 'project', id: projectId, name: projectName });
    const response = await fetch(destination, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mediaAssetId: mediaId, cover: false }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.error || labels['admin.gallery.copy_failed']);
    }
    const confirmed = await fetch(destination, { cache: 'no-store' }).catch(() => null);
    const gallery = confirmed?.ok ? await confirmed.json().catch(() => null) as Gallery | null : null;
    if (!gallery?.galleryMedia?.some(link => link.mediaId === mediaId)) {
      throw new Error(labels['admin.gallery.copy_failed']);
    }
    setCopiedMediaIds(current => new Set(current).add(mediaId));
  }

  async function upload(file: File, makeCover: boolean) {
    const data = new FormData(); data.set('file', file); data.set('kind', 'photo');
    const res = await fetch('/api/media/upload', { method: 'POST', body: data });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.mediaAssetId) throw new Error(body?.error || 'Upload failed');
    await write('POST', { mediaAssetId: body.mediaAssetId, cover: makeCover });
  }

  async function persistOrder(ordered: Item[], nextCover = cover) {
    await write('PATCH', { orderedMediaIds: ordered.map(x => x.mediaId), coverMediaId: nextCover });
  }

  return <section className="space-y-16" aria-label="Property gallery editor">
    <div className="rounded-lg border border-border-line bg-surface-subtle p-16">
      <h3 className="font-semibold">{labels['admin.gallery.title']}</h3>
      <p className="text-small text-text-secondary mt-4">
        {labels['admin.gallery.scope_hint']}
      </p>
      <div className="mt-12 grid gap-8 md:grid-cols-3">
        <label className="text-small">{labels['admin.gallery.level']}
          <select disabled={busy} aria-label={labels['admin.gallery.level']} className="block w-full border rounded-md p-8"
            value={target.scope}
            onChange={e => {
              const first = targets.find(t => t.scope === e.target.value);
              if (first) { const next = `${first.scope}:${first.id}`; setSelection(next); onSelectionChange?.(next); setMessage(null); }
            }}>
            <option value="project">{labels['admin.gallery.project']}</option>
            <option value="category" disabled={!categories.length}>{labels['admin.gallery.category']}</option>
            <option value="unit" disabled={!units.length}>{labels['admin.gallery.unit']}</option>
          </select>
        </label>
        <label className="text-small md:col-span-2">{labels['admin.gallery.object']}
          <select disabled={busy} aria-label={labels['admin.gallery.object']} className="block w-full border rounded-md p-8"
            value={`${target.scope}:${target.id}`} onChange={e => { setSelection(e.target.value); onSelectionChange?.(e.target.value); setMessage(null); }}>
            {targets.filter(t => t.scope === target.scope).map(t =>
              <option key={`${t.scope}:${t.id}`} value={`${t.scope}:${t.id}`}>{t.name}</option>)}
          </select>
        </label>
      </div>
    </div>
    <div className="rounded-lg border border-border-line bg-surface-paper p-16">
      <div className="flex flex-wrap items-start justify-between gap-12">
        <div>
          <p className="text-small font-semibold text-text-ink">{scopeExplanation}</p>
          <p className="mt-4 text-small text-text-secondary">
            Public minimum: {MIN_PUBLIC_GALLERY_PHOTOS} valid photos + a cover from this gallery.
            Recommended: {RECOMMENDED_PUBLIC_GALLERY_PHOTOS}+ photos.
          </p>
        </div>
        <span
          className={
            effectiveReady
              ? 'rounded-full bg-state-success-soft px-12 py-8 text-small font-semibold text-state-success'
              : 'rounded-full bg-state-warning-soft px-12 py-8 text-small font-semibold text-state-warning'
          }
        >
          {effectiveReady ? 'Ready for public use' : 'Not media-ready'}
        </span>
      </div>
      {!effectiveReady ? (
        <p className="mt-8 text-small text-text-secondary">
          {readiness.photoCount < MIN_PUBLIC_GALLERY_PHOTOS
            ? `Add ${MIN_PUBLIC_GALLERY_PHOTOS - readiness.photoCount} more valid photo(s). `
            : ''}
          {!readiness.coverReady ? 'Choose a cover from this gallery. ' : ''}
          {readiness.invalidMediaIds.length > 0
            ? 'Replace unsupported or non-public media assets. '
            : ''}
          {failedMediaIds.size > 0
            ? `${failedMediaIds.size} image file(s) failed to load from storage.`
            : ''}
        </p>
      ) : readiness.photoCount < RECOMMENDED_PUBLIC_GALLERY_PHOTOS ? (
        <p className="mt-8 text-small text-text-secondary">
          Ready, but add {RECOMMENDED_PUBLIC_GALLERY_PHOTOS - readiness.photoCount} more photo(s) for a stronger listing.
        </p>
      ) : null}
    </div>
    <div className="flex flex-wrap items-center justify-between gap-12">
      <div><h3 className="font-semibold">{target.name} · {items.length} {labels['admin.gallery.photos']}</h3>
        <p className="text-small text-text-secondary">{labels['admin.gallery.hint']}</p></div>
      <label className="inline-flex cursor-pointer rounded-md bg-brand-deep px-16 py-12 text-white text-small font-semibold">
        {busy ? labels['admin.gallery.saving'] : labels['admin.gallery.add']}
        <input className="sr-only" aria-label={labels['admin.gallery.add']} type="file" accept="image/jpeg,image/png,image/webp"
          multiple disabled={busy || loading || loadedGalleryUrl !== galleryUrl} onChange={e => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = '';
            if (files.length) void perform(async () => {
              for (const [index, file] of files.entries()) await upload(file, items.length === 0 && index === 0);
            });
          }}/>
      </label>
    </div>
    {message && <p role="status" className="rounded-md bg-surface-subtle p-12 text-small">{message}</p>}
    {loading ? <p role="status">{labels['admin.gallery.loading']}</p> : loadedGalleryUrl !== galleryUrl ? null :
      items.length === 0 ? <p className="rounded-lg border border-dashed border-border-line p-24 text-center text-text-secondary">
        {labels['admin.gallery.empty']}
      </p> :
      <div className="grid gap-12 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item, index) => <article key={item.mediaId} className="overflow-hidden rounded-lg border border-border-line bg-surface-paper">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="h-[192px] w-full object-cover"
            src={item.media.storageKey}
            alt={`Photo ${index + 1} of ${target.name}`}
            onError={() =>
              setFailedMediaIds((current) => new Set(current).add(item.mediaId))
            }
            onLoad={() =>
              setFailedMediaIds((current) => {
                if (!current.has(item.mediaId)) return current;
                const next = new Set(current);
                next.delete(item.mediaId);
                return next;
              })
            }
          />
          <div className="p-12 space-y-8">
            <div className="flex items-center justify-between">
              <span className="text-small">{index + 1} / {items.length}</span>
              {cover === item.mediaId ? <span className="text-small font-semibold text-brand-andaman">{labels['admin.gallery.cover']}</span> : null}
            </div>
            <div className="flex flex-wrap gap-8">
              {target.scope === 'unit' && item.media.kind === 'photo' && <button type="button"
                className="rounded-sm border p-8 text-small"
                disabled={busy || copiedMediaIds.has(item.mediaId)}
                onClick={() => void perform(() => copyToProject(item.mediaId), labels['admin.gallery.copy_saved'])}>
                {labels[copiedMediaIds.has(item.mediaId) ? 'admin.gallery.copy_done' : 'admin.gallery.copy_to_project']}
              </button>}
              <button type="button" className="rounded-sm border p-8 text-small" disabled={busy || cover === item.mediaId}
                onClick={() => void perform(() => persistOrder(items, item.mediaId))}>{labels['admin.gallery.set_cover']}</button>
              <button type="button" className="rounded-sm border p-8 text-small" disabled={busy || index === 0}
                aria-label={`Move photo ${index + 1} left`} onClick={() => void perform(() => {
                  const next = [...items]; [next[index - 1], next[index]] = [next[index], next[index - 1]];
                  return persistOrder(next);
                })}>←</button>
              <button type="button" className="rounded-sm border p-8 text-small" disabled={busy || index === items.length - 1}
                aria-label={`Move photo ${index + 1} right`} onClick={() => void perform(() => {
                  const next = [...items]; [next[index + 1], next[index]] = [next[index], next[index + 1]];
                  return persistOrder(next);
                })}>→</button>
              <button type="button" className="rounded-sm border border-state-error text-state-error p-8 text-small"
                disabled={busy} onClick={() => void perform(() => write('DELETE', null, item.mediaId))}>
                {labels['admin.gallery.remove']}
              </button>
            </div>
          </div>
        </article>)}
      </div>}
    <p className="text-small text-text-secondary">{labels['admin.gallery.safe_remove']}</p>
  </section>;
}
