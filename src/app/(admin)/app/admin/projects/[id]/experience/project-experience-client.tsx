/* eslint-disable local-rules/no-literal-ui-text */
'use client';

import Image from 'next/image';
import { ChangeEvent, FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type Media = { mediaId: string; sort: number; media: { id: string; storageKey: string } };
export type AmenityRow = {
  id: string;
  slug: string;
  name: string;
  categoryKey: string | null;
  shortDescription: string | null;
  description: string | null;
  iconKey: string | null;
  locationLabel: string | null;
  coverMediaId: string | null;
  accessType: string;
  accessInstructions: string | null;
  bookingRequired: boolean;
  bookingMode: string;
  bookingUrl: string | null;
  pricingType: string;
  priceThb: number | null;
  capacity: number | null;
  minAge: number | null;
  openingHours: unknown;
  rules: unknown;
  terms: string | null;
  isFeatured: boolean;
  published: boolean;
  sort: number;
  coverMedia: { storageKey: string } | null;
  media: Media[];
};

const input = 'mt-4 h-40 w-full rounded-md border border-border-line bg-surface-paper px-10 text-text-ink';
const area = 'mt-4 min-h-96 w-full rounded-md border border-border-line bg-surface-paper p-10 text-text-ink';

function stringify(value: unknown) {
  if (!value) return '';
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}
function parseJsonOrLines(value: string): unknown {
  const text = value.trim();
  if (!text) return null;
  try { return JSON.parse(text); } catch {
    return text.split('\n').map(line => line.trim()).filter(Boolean);
  }
}
function money(satang: number | null) {
  return satang === null ? '' : String(satang / 100);
}

export default function ProjectExperienceClient({
  projectId,
  initialAmenities,
}: {
  projectId: string;
  initialAmenities: AmenityRow[];
}) {
  const router = useRouter();
  const [amenities, setAmenities] = useState(initialAmenities);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(initialAmenities[0]?.id ?? null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const selected = amenities.find(row => row.id === selectedId) ?? null;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? amenities.filter(row => [row.name, row.categoryKey, row.locationLabel].filter(Boolean).some(value => String(value).toLowerCase().includes(q))) : amenities;
  }, [amenities, query]);

  async function refresh(select?: string | null) {
    const res = await fetch(`/api/admin/projects/${projectId}/amenities`, { cache: 'no-store' });
    const data = await res.json();
    if (res.ok) {
      setAmenities(data.amenities);
      if (select !== undefined) setSelectedId(select);
    }
    router.refresh();
  }

  async function createAmenity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setMessage(null);
    const fd = new FormData(event.currentTarget);
    const res = await fetch(`/api/admin/projects/${projectId}/amenities`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: fd.get('name'),
        categoryKey: fd.get('categoryKey'),
        shortDescription: fd.get('shortDescription'),
        published: false,
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) setMessage(data?.error || 'Could not create amenity.');
    else {
      event.currentTarget.reset();
      await refresh(data.amenity.id);
      setMessage('Amenity created as draft.');
    }
    setBusy(false);
  }

  async function saveAmenity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setBusy(true); setMessage(null);
    const fd = new FormData(event.currentTarget);
    const body = {
      name: fd.get('name'),
      slug: fd.get('slug'),
      categoryKey: fd.get('categoryKey'),
      shortDescription: fd.get('shortDescription'),
      description: fd.get('description'),
      iconKey: fd.get('iconKey'),
      locationLabel: fd.get('locationLabel'),
      accessType: fd.get('accessType'),
      accessInstructions: fd.get('accessInstructions'),
      bookingRequired: fd.get('bookingRequired') === 'on',
      bookingMode: fd.get('bookingMode'),
      bookingUrl: fd.get('bookingUrl'),
      pricingType: fd.get('pricingType'),
      priceBaht: fd.get('priceBaht'),
      capacity: fd.get('capacity'),
      minAge: fd.get('minAge'),
      openingHours: parseJsonOrLines(String(fd.get('openingHours') || '')),
      rules: parseJsonOrLines(String(fd.get('rules') || '')),
      terms: fd.get('terms'),
      isFeatured: fd.get('isFeatured') === 'on',
      published: fd.get('published') === 'on',
      sort: fd.get('sort'),
    };
    const res = await fetch(`/api/admin/projects/${projectId}/amenities/${selected.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    setMessage(res.ok ? 'Amenity saved.' : data?.error || 'Could not save amenity.');
    if (res.ok) await refresh(selected.id);
    setBusy(false);
  }

  async function uploadPhoto(event: ChangeEvent<HTMLInputElement>) {
    if (!selected || !event.target.files?.[0]) return;
    setBusy(true); setMessage(null);
    const form = new FormData();
    form.append('file', event.target.files[0]);
    form.append('kind', 'photo');
    const upload = await fetch('/api/media/upload', { method: 'POST', body: form });
    const media = await upload.json().catch(() => null);
    if (!upload.ok) {
      setMessage(media?.error || 'Could not upload photo.'); setBusy(false); return;
    }
    const attach = await fetch(`/api/admin/projects/${projectId}/amenities/${selected.id}/media`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mediaAssetId: media.mediaAssetId, cover: selected.media.length === 0 }),
    });
    const data = await attach.json().catch(() => null);
    setMessage(attach.ok ? 'Photo added.' : data?.error || 'Could not attach photo.');
    if (attach.ok) await refresh(selected.id);
    event.target.value = '';
    setBusy(false);
  }

  async function removePhoto(mediaId: string) {
    if (!selected) return;
    setBusy(true);
    const res = await fetch(`/api/admin/projects/${projectId}/amenities/${selected.id}/media?mediaId=${encodeURIComponent(mediaId)}`, { method: 'DELETE' });
    setMessage(res.ok ? 'Photo removed.' : 'Could not remove photo.');
    if (res.ok) await refresh(selected.id);
    setBusy(false);
  }

  async function setCover(mediaId: string) {
    if (!selected) return;
    const orderedMediaIds = selected.media.map(row => row.mediaId);
    setBusy(true);
    const res = await fetch(`/api/admin/projects/${projectId}/amenities/${selected.id}/media`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderedMediaIds, coverMediaId: mediaId }),
    });
    setMessage(res.ok ? 'Cover updated.' : 'Could not update cover.');
    if (res.ok) await refresh(selected.id);
    setBusy(false);
  }

  async function deleteAmenity() {
    if (!selected || !window.confirm(`Delete ${selected.name} from this project?`)) return;
    setBusy(true);
    const res = await fetch(`/api/admin/projects/${projectId}/amenities/${selected.id}`, { method: 'DELETE' });
    if (res.ok) {
      const next = amenities.find(row => row.id !== selected.id)?.id ?? null;
      await refresh(next);
      setMessage('Amenity deleted.');
    } else setMessage('Could not delete amenity.');
    setBusy(false);
  }

  return <div className="grid gap-20 lg:grid-cols-[300px_1fr]">
    <aside className="space-y-12">
      <form onSubmit={createAmenity} className="rounded-xl border border-border-line bg-surface-paper p-16">
        <h2 className="font-semibold text-text-ink">Add amenity or facility</h2>
        <label className="mt-12 block text-small">Name<input name="name" required className={input} placeholder="Cinema room, sauna, beach shuttle…" /></label>
        <label className="mt-8 block text-small">Group / category<input name="categoryKey" className={input} placeholder="wellness, entertainment, transport…" /></label>
        <label className="mt-8 block text-small">Short guest description<input name="shortDescription" className={input} /></label>
        <button disabled={busy} className="mt-12 min-h-40 rounded-md bg-brand-andaman px-14 font-semibold text-white disabled:opacity-50">Add draft</button>
      </form>

      <input value={query} onChange={e => setQuery(e.target.value)} className={input} placeholder="Search amenities…" />
      <div className="max-h-[640px] space-y-6 overflow-y-auto pr-4">
        {filtered.map(row => <button key={row.id} onClick={() => setSelectedId(row.id)} className={`w-full rounded-lg border p-12 text-left ${selectedId === row.id ? 'border-brand-andaman bg-surface-paper' : 'border-border-line bg-surface-ivory'}`}>
          <div className="flex justify-between gap-8"><span className="font-medium text-text-ink">{row.name}</span><span className="text-micro text-text-secondary">{row.published ? 'Live' : 'Draft'}</span></div>
          <p className="mt-2 text-micro text-text-secondary">{row.categoryKey || 'Uncategorized'}{row.bookingRequired ? ' · booking' : ''}</p>
        </button>)}
      </div>
    </aside>

    <section>
      {message ? <p role="status" className="mb-12 rounded-lg bg-surface-muted p-12 text-small">{message}</p> : null}
      {!selected ? <div className="rounded-xl border border-border-line bg-surface-paper p-24 text-text-secondary">Select an amenity or add a new one.</div> : (
        <form key={selected.id} onSubmit={saveAmenity} className="space-y-20">
          <div className="rounded-xl border border-border-line bg-surface-paper p-20">
            <div className="flex flex-wrap items-center justify-between gap-12">
              <div><h2 className="font-display text-heading-2 font-semibold">{selected.name}</h2><p className="text-small text-text-secondary">Project-level amenity · ID {selected.id}</p></div>
              <div className="flex gap-8">
                <label className="flex items-center gap-6 text-small"><input type="checkbox" name="isFeatured" defaultChecked={selected.isFeatured}/> Featured</label>
                <label className="flex items-center gap-6 text-small"><input type="checkbox" name="published" defaultChecked={selected.published}/> Published</label>
              </div>
            </div>

            <div className="mt-16 grid gap-12 md:grid-cols-2">
              <label className="text-small">Name<input name="name" defaultValue={selected.name} required className={input}/></label>
              <label className="text-small">Slug<input name="slug" defaultValue={selected.slug} required className={input}/></label>
              <label className="text-small">Group / category<input name="categoryKey" defaultValue={selected.categoryKey || ''} className={input}/></label>
              <label className="text-small">Icon key (optional)<input name="iconKey" defaultValue={selected.iconKey || ''} className={input}/></label>
              <label className="text-small md:col-span-2">Short description<input name="shortDescription" defaultValue={selected.shortDescription || ''} className={input}/></label>
              <label className="text-small md:col-span-2">Full guest description<textarea name="description" defaultValue={selected.description || ''} className={area}/></label>
              <label className="text-small">Location inside project<input name="locationLabel" defaultValue={selected.locationLabel || ''} className={input} placeholder="Building C, level 2"/></label>
              <label className="text-small">Display order<input type="number" min="0" name="sort" defaultValue={selected.sort} className={input}/></label>
            </div>
          </div>

          <div className="rounded-xl border border-border-line bg-surface-paper p-20">
            <h3 className="font-semibold">Access, use and booking</h3>
            <p className="mt-4 text-small text-text-secondary">Values are open, not tied to a fixed amenity list. Use project-specific wording where needed.</p>
            <div className="mt-12 grid gap-12 md:grid-cols-2">
              <label className="text-small">Access type<input list="amenity-access-types" name="accessType" defaultValue={selected.accessType} className={input}/></label>
              <datalist id="amenity-access-types"><option value="open"/><option value="room_key"/><option value="key_card"/><option value="wristband"/><option value="staff_assisted"/><option value="reservation"/><option value="membership"/></datalist>
              <label className="text-small">Access instructions<textarea name="accessInstructions" defaultValue={selected.accessInstructions || ''} className={area}/></label>
              <label className="flex items-center gap-8 text-small"><input type="checkbox" name="bookingRequired" defaultChecked={selected.bookingRequired}/> Advance booking / reservation required</label>
              <label className="text-small">Booking method<input list="amenity-booking-modes" name="bookingMode" defaultValue={selected.bookingMode} className={input}/></label>
              <datalist id="amenity-booking-modes"><option value="none"/><option value="reception"/><option value="request"/><option value="time_slot"/><option value="external_link"/></datalist>
              <label className="text-small">Booking URL / action (optional)<input name="bookingUrl" defaultValue={selected.bookingUrl || ''} className={input}/></label>
              <label className="text-small">Pricing / entitlement<input list="amenity-pricing-types" name="pricingType" defaultValue={selected.pricingType} className={input}/></label>
              <datalist id="amenity-pricing-types"><option value="included"/><option value="free"/><option value="paid"/><option value="deposit"/><option value="mixed"/></datalist>
              <label className="text-small">Price THB (optional)<input name="priceBaht" type="number" min="0" step="0.01" defaultValue={money(selected.priceThb)} className={input}/></label>
              <label className="text-small">Capacity (optional)<input name="capacity" type="number" min="1" defaultValue={selected.capacity ?? ''} className={input}/></label>
              <label className="text-small">Minimum age (optional)<input name="minAge" type="number" min="0" defaultValue={selected.minAge ?? ''} className={input}/></label>
            </div>
          </div>

          <div className="rounded-xl border border-border-line bg-surface-paper p-20">
            <h3 className="font-semibold">Hours, rules and terms</h3>
            <div className="mt-12 grid gap-12 md:grid-cols-2">
              <label className="text-small">Opening hours<textarea name="openingHours" defaultValue={stringify(selected.openingHours)} className={area} placeholder={'Mon-Sun 07:00-22:00\nor JSON for complex schedules'}/></label>
              <label className="text-small">Rules<textarea name="rules" defaultValue={stringify(selected.rules)} className={area} placeholder={'No food\nChildren under 12 with an adult\nor JSON'}/></label>
              <label className="text-small md:col-span-2">Terms of use<textarea name="terms" defaultValue={selected.terms || ''} className={area}/></label>
            </div>
          </div>

          <div className="rounded-xl border border-border-line bg-surface-paper p-20">
            <div className="flex flex-wrap items-center justify-between gap-12"><div><h3 className="font-semibold">Amenity gallery</h3><p className="text-small text-text-secondary">Photos belong to this amenity, not to the whole project or a unit.</p></div><label className="cursor-pointer rounded-md border border-border-line px-12 py-8 text-small font-semibold">Upload photo<input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadPhoto} className="hidden"/></label></div>
            <div className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
              {selected.media.map(row => <div key={row.mediaId} className="relative overflow-hidden rounded-lg border border-border-line">
                <Image src={row.media.storageKey} alt={selected.name} width={420} height={260} className="aspect-video w-full object-cover"/>
                <div className="flex flex-wrap gap-6 p-8"><button type="button" onClick={() => setCover(row.mediaId)} className="text-micro font-semibold text-brand-andaman">{selected.coverMediaId === row.mediaId ? 'Cover' : 'Set cover'}</button><button type="button" onClick={() => removePhoto(row.mediaId)} className="text-micro text-state-error">Remove</button></div>
              </div>)}
            </div>
          </div>

          <div className="flex flex-wrap justify-between gap-12">
            <button type="button" onClick={deleteAmenity} disabled={busy} className="min-h-40 rounded-md border border-state-error px-14 font-semibold text-state-error">Delete amenity</button>
            <button disabled={busy} className="min-h-44 rounded-md bg-brand-andaman px-20 font-semibold text-white disabled:opacity-50">{busy ? 'Saving…' : 'Save amenity'}</button>
          </div>
        </form>
      )}
    </section>
  </div>;
}
