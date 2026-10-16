'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { AmenityComparison } from '@/app/property/content/amenity-ui';
import type { ContentProposal, ContentScope, ContentLocale, ContentAmenitySnapshot } from '@/modules/onboarding/content-proposal.schema';

type Status = 'draft' | 'submitted' | 'returned' | 'approved';
type Summary = { id: string; scope: ContentScope; targetId: string; projectId: string; targetName: string; status: Status; revision: number; updatedAt: string; reviewNote: string | null };
type Media = { id: string; url: string };
type Detail = {
  id: string; scope: ContentScope; targetId: string; projectId: string; status: Status; revision: number;
  baseline: { facts: ContentProposal['facts']; descriptions: Partial<Record<ContentLocale, string>>; gallery: ContentProposal['gallery'] & { media: Media[] }; amenities?: ContentAmenitySnapshot[] };
  proposal: ContentProposal; reviewNote: string | null; media?: Media[]; author?: { id: string; name: string };
};
const button = 'rounded-lg border border-border-line px-16 py-12 text-small disabled:opacity-40';

export default function ContentProposalReview({ labels }: { labels: Record<string, string> }) {
  const L = useCallback((key: string) => labels[`property.content.review.${key}`] || key, [labels]);
  const [items, setItems] = useState<Summary[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [note, setNote] = useState('');
  const [checked, setChecked] = useState(false);
  const [filter, setFilter] = useState('submitted');
  const generation = useRef(0);
  const locked = useRef(false);

  const request = useCallback(async (url: string, init?: RequestInit) => {
    const response = await fetch(url, { ...init, cache: 'no-store' }).catch(() => { throw new Error(L('error')); });
    const data = await response.json().catch(() => { throw new Error(L('error')); });
    if (!response.ok) throw new Error(response.status === 409 ? L('conflict') : response.status === 403 || response.status === 401 ? L('forbidden') : L('error'));
    return data;
  }, [L]);
  const reload = useCallback(async () => {
    if (locked.current) return;
    const current = ++generation.current;
    setLoading(true); setError(''); setDetail(null); setChecked(false);
    try {
      const data = await request('/api/property-content-proposals');
      if (current === generation.current) setItems(data.items || []);
    } catch (e) { if (current === generation.current) setError(e instanceof Error ? e.message : L('error')); }
    finally { if (current === generation.current) setLoading(false); }
  }, [L, request]);
  useEffect(() => { void reload(); return () => { generation.current += 1; }; }, [reload]);

  async function open(id: string) {
    if (locked.current) return;
    const current = ++generation.current;
    setBusy(true); setDetail(null); setError(''); setNotice(''); setChecked(false); setNote('');
    try {
      const data = await request(`/api/property-content-proposals/${encodeURIComponent(id)}`);
      if (current === generation.current) setDetail(data);
    } catch (e) { if (current === generation.current) setError(e instanceof Error ? e.message : L('error')); }
    finally { if (current === generation.current) setBusy(false); }
  }

  async function review(action: 'approve' | 'return') {
    if (!detail || detail.status !== 'submitted' || locked.current || (action === 'approve' && !checked) || (action === 'return' && !note.trim())) return;
    locked.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const data: Detail = await request(`/api/admin/property-content-proposals/${encodeURIComponent(detail.id)}/review`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, expectedRevision: detail.revision, ...(note.trim() ? { note: note.trim() } : {}) }),
      });
      setDetail(old => old ? { ...old, ...data } : data);
      setItems(old => old.map(item => item.id === data.id ? { ...item, status: data.status, revision: data.revision, reviewNote: data.reviewNote } : item));
      setChecked(false); setNotice(L(action === 'approve' ? 'approved' : 'returned'));
    } catch (e) { setChecked(false); setError(e instanceof Error ? e.message : L('error')); }
    finally { locked.current = false; setBusy(false); }
  }
  const printable = (value: unknown) => Array.isArray(value) ? value.join(', ') || L('empty') : value === null || value === '' ? L('empty') : String(value);
  function gallery(ids: string[], cover: string | null, media: Media[]) {
    const urls = new Map(media.map(asset => [asset.id, asset.url]));
    return ids.length ? <ol className="mt-12 grid grid-cols-2 gap-8">{ids.map((id, index) => <li key={id} className="rounded-lg border border-border-line p-8">
      {urls.get(id) ? <Image src={urls.get(id)!} alt={L('photo').replace('{number}', String(index + 1))} width={240} height={160} className="aspect-[3/2] w-full rounded-md object-cover" /> : <p>{L('image_unavailable')}</p>}
      <p className="mt-4 text-small">{index + 1}{id === cover ? ` · ${L('cover')}` : ''}</p>
    </li>)}</ol> : <p className="mt-8 text-small">{L('empty')}</p>;
  }
  return <div className="space-y-20">
    <div className="flex flex-wrap items-end gap-12"><div><label htmlFor="content-review-filter" className="block text-small">{L('filter')}</label><select id="content-review-filter" value={filter} disabled={busy} onChange={e => setFilter(e.target.value)} className="mt-4 rounded-lg border border-border-line p-12">{['submitted', 'returned', 'draft', 'approved', 'all'].map(status => <option key={status} value={status}>{L(`status.${status}`)}</option>)}</select></div><button type="button" className={button} disabled={busy || loading} onClick={() => void reload()}>{L('reload')}</button></div>
    {loading && <p role="status">{L('loading')}</p>}
    {error && <p role="alert" className="rounded-lg bg-state-error-soft p-16 text-state-error">{error}</p>}
    {notice && <p role="status" className="rounded-lg bg-state-success-soft p-16">{notice}</p>}
    {!loading && <div className="space-y-8">{items.filter(item => filter === 'all' || item.status === filter).map(item => <button type="button" key={item.id} disabled={busy} onClick={() => void open(item.id)} className={`${button} block w-full text-left ${detail?.id === item.id ? 'border-brand-andaman' : ''}`}><strong>{item.targetName}</strong><span className="ml-8">{L(`scope.${item.scope}`)} · {L(`status.${item.status}`)}</span></button>)}{!items.some(item => filter === 'all' || item.status === filter) && <p>{L('none')}</p>}</div>}
    {detail && <article className="stitch-panel space-y-20 p-20" aria-busy={busy}>
      <header><h2 className="font-display text-heading-2 font-semibold">{detail.proposal.facts.name}</h2><p className="mt-4 text-small">{L(`scope.${detail.scope}`)} · {detail.targetId} · {L(`status.${detail.status}`)}</p>{detail.author && <p className="mt-4 text-small">{L('author')}: {detail.author.name} · {detail.author.id}</p>}<p className="mt-8 text-small text-text-secondary">{L('baseline_hint')}</p></header>
      <section><h3 className="font-semibold">{L('facts')}</h3><dl className="mt-12 space-y-12">{Object.entries(detail.proposal.facts).map(([key, value]) => {
        const before = (detail.baseline.facts as unknown as Record<string, unknown>)[key];
        const changed = JSON.stringify(before) !== JSON.stringify(value);
        return <div key={key} className={`rounded-lg border p-12 ${changed ? 'border-brand-andaman' : 'border-border-line'}`}><dt className="font-semibold">{labels[`property.content.field.${detail.scope === 'unit' && key === 'name' ? 'unitName' : key}`] || key}{changed ? ` · ${L('changed')}` : ''}</dt><dd className="mt-8 grid gap-12 break-words md:grid-cols-2"><div><p className="text-small text-text-secondary">{L('before')}</p><p>{printable(before)}</p></div><div><p className="text-small text-text-secondary">{L('after')}</p><p>{printable(value)}</p></div></dd></div>;
      })}</dl></section>
      <section><h3 className="font-semibold">{L('description')}</h3>{detail.proposal.description ? <div className="mt-12"><p>{detail.proposal.description.locale.toUpperCase()}</p><div className="mt-8 grid gap-12 md:grid-cols-2"><div><p className="text-small text-text-secondary">{L('before')}</p><p className="whitespace-pre-wrap break-words">{detail.baseline.descriptions[detail.proposal.description.locale] || L('empty')}</p></div><div><p className="text-small text-text-secondary">{L('after')}</p><p className="whitespace-pre-wrap break-words">{detail.proposal.description.value}</p></div></div></div> : <p className="mt-8">{L('description_unchanged')}</p>}</section>
      <section><h3 className="font-semibold">{L('gallery')}</h3><div className="mt-12 grid gap-16 md:grid-cols-2"><div><p>{L('before')}</p>{gallery(detail.baseline.gallery.mediaIds, detail.baseline.gallery.coverMediaId, detail.baseline.gallery.media)}</div><div><p>{L('after')}</p>{gallery(detail.proposal.gallery.mediaIds, detail.proposal.gallery.coverMediaId, [...detail.baseline.gallery.media, ...(detail.media || [])])}</div></div></section>
      {detail.scope === 'project' && <section aria-labelledby="content-review-amenities"><h3 id="content-review-amenities" className="font-semibold">{L('amenities')}</h3><p className="mt-8 text-small text-text-secondary">{L('amenities_hint')}</p>{detail.proposal.amenities?.length ? <div className="mt-12 space-y-12">{detail.proposal.amenities.map((amenity, index) => <div key={amenity.id || `new-${index}`} className="rounded-lg border border-brand-andaman p-12"><AmenityComparison before={amenity.id ? detail.baseline.amenities?.find(value => value.id === amenity.id) : undefined} after={amenity} labels={labels} /></div>)}</div> : <p className="mt-8">{L('amenities_unchanged')}</p>}</section>}
      {detail.reviewNote && <p className="whitespace-pre-wrap rounded-lg border border-border-line p-12">{L('review_note')}: {detail.reviewNote}</p>}
      {detail.status === 'submitted' && <section className="space-y-12 border-t border-border-line pt-20"><p className="text-small text-text-secondary">{L('apply_hint')}</p><label className="flex items-start gap-12"><input type="checkbox" checked={checked} disabled={busy} onChange={e => setChecked(e.target.checked)} />{L('confirm')}</label><div><label htmlFor="content-review-note" className="block text-small">{L('note')}</label><textarea id="content-review-note" value={note} disabled={busy} maxLength={2000} rows={3} onChange={e => setNote(e.target.value)} className="mt-4 w-full rounded-lg border border-border-line p-12" /></div><div className="flex flex-wrap gap-12"><button type="button" disabled={busy || !checked} onClick={() => void review('approve')} className={`${button} bg-brand-andaman text-white`}>{L('approve')}</button><button type="button" disabled={busy || !note.trim()} onClick={() => void review('return')} className={button}>{L('return')}</button></div></section>}
    </article>}
  </div>;
}
