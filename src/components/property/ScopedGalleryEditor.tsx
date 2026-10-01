'use client';
/* eslint-disable local-rules/no-literal-ui-text */

import { useCallback, useEffect, useState } from 'react';

type Scope = 'project' | 'category' | 'unit';
type Asset = { id: string; storageKey: string; mimeType: string; kind: string };
type Link = { mediaId: string; sort: number; media: Asset };
type Gallery = { coverMediaId: string | null; galleryMedia?: Link[]; media?: Link[] };
type Target = { id: string; name: string; scope: Scope };
type Item = { mediaId: string; media: Asset };

function endpoint(target: Target) {
  if (target.scope === 'project') return `/api/admin/projects/${target.id}/media`;
  if (target.scope === 'category') return `/api/admin/categories/${target.id}/media`;
  return `/api/admin/units/${target.id}/media`;
}

export default function ScopedGalleryEditor({
  projectId, projectName, categories, units, initialSelection, labels,
}: {
  projectId: string;
  projectName: string;
  categories: Array<{ id: string; name: string }>;
  units: Array<{ id: string; name: string }>;
  initialSelection?: string;
  labels: Record<string,string>;
}) {
  const targets: Target[] = [
    { scope: 'project', id: projectId, name: projectName },
    ...categories.map(c => ({ scope: 'category' as const, id: c.id, name: c.name })),
    ...units.map(u => ({ scope: 'unit' as const, id: u.id, name: u.name })),
  ];
  const [selection, setSelection] = useState(initialSelection ?? `project:${projectId}`);
  const [items, setItems] = useState<Item[]>([]);
  const [cover, setCover] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const target = targets.find(t => `${t.scope}:${t.id}` === selection) ?? targets[0];
  const galleryUrl = endpoint(target);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(galleryUrl, { cache: 'no-store' });
      if (!res.ok) throw new Error('Could not load gallery');
      const gallery = await res.json() as Gallery;
      const links = gallery.galleryMedia ?? gallery.media ?? [];
      setItems(links.map(link => ({ mediaId: link.mediaId, media: link.media })));
      setCover(gallery.coverMediaId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load gallery');
    } finally { setLoading(false); }
  }, [galleryUrl]);

  useEffect(() => { void load(); }, [load]);

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

  async function perform(operation: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setMessage(null);
    try { await operation(); await load(); setMessage(labels['admin.gallery.saved']); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save gallery'); }
    finally { setBusy(false); }
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
    <div className="rounded-lg border border-border-line bg-surface-muted p-16">
      <h3 className="font-semibold">{labels['admin.gallery.title']}</h3>
      <p className="text-small text-text-secondary mt-4">
        {labels['admin.gallery.scope_hint']}
      </p>
      <div className="mt-12 grid gap-8 md:grid-cols-3">
        <label className="text-small">{labels['admin.gallery.level']}
          <select aria-label={labels['admin.gallery.level']} className="block w-full border rounded-md p-8"
            value={target.scope}
            onChange={e => {
              const first = targets.find(t => t.scope === e.target.value);
              if (first) { setSelection(`${first.scope}:${first.id}`); setMessage(null); }
            }}>
            <option value="project">{labels['admin.gallery.project']}</option>
            <option value="category" disabled={!categories.length}>{labels['admin.gallery.category']}</option>
            <option value="unit" disabled={!units.length}>{labels['admin.gallery.unit']}</option>
          </select>
        </label>
        <label className="text-small md:col-span-2">{labels['admin.gallery.object']}
          <select aria-label={labels['admin.gallery.object']} className="block w-full border rounded-md p-8"
            value={selection} onChange={e => { setSelection(e.target.value); setMessage(null); }}>
            {targets.filter(t => t.scope === target.scope).map(t =>
              <option key={`${t.scope}:${t.id}`} value={`${t.scope}:${t.id}`}>{t.name}</option>)}
          </select>
        </label>
      </div>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-12">
      <div><h3 className="font-semibold">{target.name} · {items.length} {labels['admin.gallery.photos']}</h3>
        <p className="text-small text-text-secondary">{labels['admin.gallery.hint']}</p></div>
      <label className="inline-flex cursor-pointer rounded-md bg-brand-deep px-16 py-12 text-white text-small font-semibold">
        {busy ? labels['admin.gallery.saving'] : labels['admin.gallery.add']}
        <input className="sr-only" aria-label={labels['admin.gallery.add']} type="file" accept="image/jpeg,image/png,image/webp"
          multiple disabled={busy} onChange={e => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = '';
            if (files.length) void perform(async () => {
              for (const [index, file] of files.entries()) await upload(file, items.length === 0 && index === 0);
            });
          }}/>
      </label>
    </div>
    {message && <p role="status" className="rounded-md bg-surface-muted p-12 text-small">{message}</p>}
    {loading ? <p role="status">{labels['admin.gallery.loading']}</p> :
      items.length === 0 ? <p className="rounded-lg border border-dashed border-border-line p-24 text-center text-text-secondary">
        {labels['admin.gallery.empty']}
      </p> :
      <div className="grid gap-12 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item, index) => <article key={item.mediaId} className="overflow-hidden rounded-lg border border-border-line bg-surface-paper">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="h-[192px] w-full object-cover" src={item.media.storageKey} alt={`Photo ${index + 1} of ${target.name}`}/>
          <div className="p-12 space-y-8">
            <div className="flex items-center justify-between">
              <span className="text-small">{index + 1} / {items.length}</span>
              {cover === item.mediaId ? <span className="text-small font-semibold text-brand-andaman">{labels['admin.gallery.cover']}</span> : null}
            </div>
            <div className="flex flex-wrap gap-8">
              <button type="button" className="rounded border p-8 text-small" disabled={busy || cover === item.mediaId}
                onClick={() => void perform(() => persistOrder(items, item.mediaId))}>{labels['admin.gallery.set_cover']}</button>
              <button type="button" className="rounded border p-8 text-small" disabled={busy || index === 0}
                aria-label={`Move photo ${index + 1} left`} onClick={() => void perform(() => {
                  const next = [...items]; [next[index - 1], next[index]] = [next[index], next[index - 1]];
                  return persistOrder(next);
                })}>←</button>
              <button type="button" className="rounded border p-8 text-small" disabled={busy || index === items.length - 1}
                aria-label={`Move photo ${index + 1} right`} onClick={() => void perform(() => {
                  const next = [...items]; [next[index + 1], next[index]] = [next[index], next[index + 1]];
                  return persistOrder(next);
                })}>→</button>
              <button type="button" className="rounded border border-state-error text-state-error p-8 text-small"
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
