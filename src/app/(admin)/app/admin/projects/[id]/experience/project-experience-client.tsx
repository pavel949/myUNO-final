/* eslint-disable local-rules/no-literal-ui-text */
'use client';
import { OperationalText, OperationalInput } from '@/components/ops/OperationalText';

import Image from 'next/image';
import Link from 'next/link';
import AmenityTranslationsEditor from '@/components/projects/AmenityTranslationsEditor';
import { ChangeEvent, FormEvent, useMemo, useRef, useState } from 'react';
import AmenityHoursEditor from '@/components/projects/AmenityHoursEditor';
import { amenityHoursFromForm, amenityLeadTime, amenityLeadTimeFromForm, amenityLinesInput, parseAmenityLines } from '@/modules/projects/amenity-usage';
import { useRouter } from 'next/navigation';

type Media = { mediaId: string; sort: number; media: { id: string; storageKey: string } };
export type AmenityRow = {
  id: string;
  updatedAt: Date | string;
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
  reservationConfig: unknown;
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

const commonFacilities = ['Swimming pool', 'Sauna', 'Onsen', 'Gym', 'Boxing room', 'Yoga room', 'Reception', 'Co-working space', 'Meeting room', 'Kids room', 'Games room', 'Cinema', 'Music room', 'Golf simulator', 'Parking', 'Garden'];

const input = 'mt-4 h-40 w-full rounded-md border border-border-line bg-surface-paper px-12 text-text-ink';
const area = 'mt-4 min-h-96 w-full rounded-md border border-border-line bg-surface-paper p-12 text-text-ink';

function money(satang: number | null) {
  return satang === null ? '' : String(satang / 100);
}
function reservationConfig(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function configValue(value: unknown, key: string): string {
  const raw = reservationConfig(value)[key];
  return raw === undefined || raw === null ? '' : String(raw);
}
function configBool(value: unknown, key: string, fallback: boolean): boolean {
  const raw = reservationConfig(value)[key];
  return typeof raw === 'boolean' ? raw : fallback;
}

export default function ProjectExperienceClient({
  projectId,
  timezone,
  initialAmenities,
  canOperateReservations,
}: {
  projectId: string;
  timezone: string;
  initialAmenities: AmenityRow[];
  canOperateReservations: boolean;
}) {
  const router = useRouter();
  const savePending = useRef(false);
  const [amenities, setAmenities] = useState(initialAmenities);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(initialAmenities[0]?.id ?? null);
  // Keep the version tied to the uncontrolled form snapshot, not background/media refreshes.
  const [editorVersion, setEditorVersion] = useState(initialAmenities[0] ? new Date(initialAmenities[0].updatedAt).toISOString() : '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const selected = amenities.find(row => row.id === selectedId) ?? null;
  const leadTime = amenityLeadTime(selected?.reservationConfig);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? amenities.filter(row => [row.name, row.categoryKey, row.locationLabel].filter(Boolean).some(value => String(value).toLowerCase().includes(q))) : amenities;
  }, [amenities, query]);

  async function refresh(select?: string | null, resetEditor = false) {
    try {
      const res = await fetch(`/api/admin/projects/${projectId}/amenities`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error('Could not reload amenities');
      setAmenities(data.amenities);
      if (select !== undefined) setSelectedId(select);
      if (resetEditor) {
        const next = (data.amenities as AmenityRow[]).find(row => row.id === select);
        setEditorVersion(next ? new Date(next.updatedAt).toISOString() : '');
      }
      router.refresh();
      return true;
    } catch {
      setMessage('Saved, but the list could not reload. Reload this page to see the latest record.');
      return false;
    }
  }

  async function createAmenity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savePending.current) return;
    savePending.current = true;
    const form = event.currentTarget;
    setBusy(true); setMessage(null);
    try {
      const fd = new FormData(form);
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
        form.reset();
        if (await refresh(data.amenity.id, true)) setMessage('Amenity created as draft.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not create amenity. Please retry.');
    } finally { savePending.current = false; setBusy(false); }
  }

  async function saveAmenity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || savePending.current) return;
    savePending.current = true;
    setBusy(true); setMessage(null);
    try {
      const fd = new FormData(event.currentTarget);
      const body = {
        expectedUpdatedAt: editorVersion,
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
        reservationConfig: {
          ...reservationConfig(selected.reservationConfig),
          slotMinutes: fd.get('slotMinutes') ? Number(fd.get('slotMinutes')) : undefined,
          minLeadMinutes: amenityLeadTimeFromForm(fd),
          maxAdvanceDays: fd.get('maxAdvanceDays') ? Number(fd.get('maxAdvanceDays')) : undefined,
          maxPartySize: fd.get('maxPartySize') ? Number(fd.get('maxPartySize')) : undefined,
          maxConcurrentGuests: fd.get('maxConcurrentGuests') ? Number(fd.get('maxConcurrentGuests')) : undefined,
          exclusive: fd.get('exclusive') === 'on',
          autoConfirm: fd.get('autoConfirm') === 'on',
        },
        pricingType: fd.get('pricingType'),
        priceBaht: fd.get('priceBaht'),
        capacity: fd.get('capacity'),
        minAge: fd.get('minAge'),
        openingHours: amenityHoursFromForm(fd, selected.openingHours),
        rules: parseAmenityLines(String(fd.get('rules') || '')),
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
      if (res.ok) await refresh(selected.id, true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save amenity. Please retry.');
    } finally { savePending.current = false; setBusy(false); }
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
      await refresh(next, true);
      setMessage('Amenity deleted.');
    } else setMessage('Could not delete amenity.');
    setBusy(false);
  }

  return <div className="grid gap-20 lg:grid-cols-[300px_1fr]">
    <aside className="space-y-12">
      <form onSubmit={createAmenity} className="rounded-md border border-border-line bg-surface-paper p-16">
        <h2 className="font-semibold text-text-ink"><OperationalText text={"Add amenity or facility"} /></h2>
        <label className="mt-12 block text-small"><OperationalText text={"Choose a common facility (optional)"} /><select defaultValue="" className={input} onChange={event => {
          const name = event.currentTarget.form?.elements.namedItem('name');
          if (name instanceof HTMLInputElement && event.target.value) name.value = event.target.value;
        }}><option value=""><OperationalText text={"Choose or enter your own below"} /></option>{commonFacilities.map(name => <option key={name} value={name}>{name}</option>)}</select></label>
        <p className="mt-8 text-small text-text-secondary"><OperationalText text={"Select only facilities this complex actually has. Add as a draft, complete known details, then publish."} /></p>
        <label className="mt-12 block text-small"><OperationalText text={"Name"} /><OperationalInput name="name" required className={input} placeholder="Cinema room, sauna, beach shuttle…" /></label>
        <label className="mt-8 block text-small"><OperationalText text={"Group / category"} /><OperationalInput name="categoryKey" className={input} placeholder="wellness, entertainment, transport…" /></label>
        <label className="mt-8 block text-small"><OperationalText text={"Short guest description"} /><input name="shortDescription" className={input} /></label>
        <button disabled={busy} className="mt-12 min-h-40 rounded-md bg-brand-andaman px-16 font-semibold text-white disabled:opacity-50"><OperationalText text={"Add draft"} /></button>
      </form>

      <OperationalInput value={query} onChange={e => setQuery(e.target.value)} className={input} placeholder="Search amenities…" />
      <div className="max-h-[640px] space-y-8 overflow-y-auto pr-4">
        {filtered.map(row => <button key={row.id} disabled={busy} onClick={() => { setSelectedId(row.id); setEditorVersion(new Date(row.updatedAt).toISOString()); setMessage(null); }} className={`w-full rounded-lg border p-12 text-left ${selectedId === row.id ? 'border-brand-andaman bg-surface-paper' : 'border-border-line bg-surface-ivory'}`}>
          <div className="flex justify-between gap-8"><span className="font-medium text-text-ink">{row.name}</span><span className="text-small text-text-secondary"><OperationalText text={row.published ? 'Live' : 'Draft'} /></span></div>
          <p className="mt-8 text-small text-text-secondary">{row.categoryKey || 'Uncategorized'}<OperationalText text={row.bookingRequired ? ' · booking' : ''} /></p>
        </button>)}
      </div>
    </aside>

    <section>
      {message ? <p role="status" className="mb-12 rounded-lg bg-surface-subtle p-12 text-small">{message}</p> : null}
      {!selected ? <div className="rounded-md border border-border-line bg-surface-paper p-24 text-text-secondary"><OperationalText text={"Select an amenity or add a new one."} /></div> : (
        <form key={`${selected.id}:${editorVersion}`} onSubmit={saveAmenity}>
          <fieldset disabled={busy} className="space-y-20">
          <div className="rounded-md border border-border-line bg-surface-paper p-20">
            <div className="flex flex-wrap items-center justify-between gap-12">
              <div><h2 className="font-display text-heading-2 font-semibold">{selected.name}</h2><p className="text-small text-text-secondary"><OperationalText text={"Shared complex facility · ID "} />{selected.id}</p>{selected.bookingRequired && canOperateReservations ? <Link href={`/app/admin/projects/${projectId}/amenities/${selected.id}/reservations`} className="mt-4 inline-block text-small font-semibold text-brand-andaman underline"><OperationalText text={"Manage reservations →"} /></Link> : null}</div>
              <div className="flex gap-8">
                <label className="flex items-center gap-8 text-small"><input type="checkbox" name="isFeatured" defaultChecked={selected.isFeatured}/> <OperationalText text={" Featured"} /></label>
                <label className="flex items-center gap-8 text-small"><input type="checkbox" name="published" defaultChecked={selected.published}/> <OperationalText text={" Published"} /></label>
              </div>
            </div>

            <div className="mt-16 grid gap-12 md:grid-cols-2">
              <label className="text-small"><OperationalText text={"Name"} /><input name="name" defaultValue={selected.name} required className={input}/></label>
              <label className="text-small"><OperationalText text={"Slug"} /><input name="slug" defaultValue={selected.slug} required className={input}/></label>
              <label className="text-small"><OperationalText text={"Group / category"} /><input name="categoryKey" defaultValue={selected.categoryKey || ''} className={input}/></label>
              <label className="text-small"><OperationalText text={"Icon key (optional)"} /><input name="iconKey" defaultValue={selected.iconKey || ''} className={input}/></label>
              <label className="text-small md:col-span-2"><OperationalText text={"Short description"} /><input name="shortDescription" defaultValue={selected.shortDescription || ''} className={input}/></label>
              <label className="text-small md:col-span-2"><OperationalText text={"Full guest description"} /><textarea name="description" defaultValue={selected.description || ''} className={area}/></label>
              <label className="text-small"><OperationalText text={"Location / floor inside complex"} /><OperationalInput name="locationLabel" defaultValue={selected.locationLabel || ''} className={input} placeholder="Building C, level 2"/></label>
              <label className="text-small"><OperationalText text={"Display order"} /><input type="number" min="0" name="sort" defaultValue={selected.sort} className={input}/></label>
            </div>
          </div>

          <AmenityTranslationsEditor projectId={projectId} amenityId={selected.id} />

          <div className="rounded-md border border-border-line bg-surface-paper p-20">
            <h3 className="font-semibold"><OperationalText text={"Access, use and booking"} /></h3>
            <p className="mt-4 text-small text-text-secondary"><OperationalText text={"Values are open, not tied to a fixed amenity list. Use project-specific wording where needed. Booking method “other” records a local requirement without enabling online reservations. Leave price unknown as “not_specified”."} /></p>
            <div className="mt-12 grid gap-12 md:grid-cols-2">
              <label className="text-small"><OperationalText text={"Access type"} /><input list="amenity-access-types" name="accessType" defaultValue={selected.accessType} className={input}/></label>
              <datalist id="amenity-access-types"><option value="not_specified"/><option value="open"/><option value="room_key"/><option value="key_card"/><option value="wristband"/><option value="staff_assisted"/><option value="reservation"/><option value="membership"/></datalist>
              <label className="text-small"><OperationalText text={"Access instructions"} /><textarea name="accessInstructions" defaultValue={selected.accessInstructions || ''} className={area}/></label>
              <label className="flex items-center gap-8 text-small"><input type="checkbox" name="bookingRequired" defaultChecked={selected.bookingRequired}/> <OperationalText text={" Advance booking / reservation required"} /></label>
              <label className="text-small"><OperationalText text={"Booking method"} /><input list="amenity-booking-modes" name="bookingMode" defaultValue={selected.bookingMode} className={input}/></label>
              <datalist id="amenity-booking-modes"><option value="none"/><option value="other"/><option value="reception"/><option value="request"/><option value="time_slot"/><option value="external_link"/></datalist>
              <label className="text-small"><OperationalText text={"Booking URL / action (optional)"} /><input name="bookingUrl" defaultValue={selected.bookingUrl || ''} className={input}/></label>
              <label className="text-small"><OperationalText text={"Slot size (minutes)"} /><input name="slotMinutes" type="number" min="1" defaultValue={configValue(selected.reservationConfig, 'slotMinutes')} className={input} placeholder="60"/></label>
              <div className="grid grid-cols-2 gap-8">
                <label className="text-small"><OperationalText text={"Minimum booking notice"} /><input name="leadTimeAmount" type="number" min="0" step="1" defaultValue={leadTime?.amount ?? ''} className={input}/></label>
                <label className="text-small"><OperationalText text={"Notice unit"} /><select name="leadTimeUnit" defaultValue={leadTime?.unit === 'days' ? '1440' : leadTime?.unit === 'hours' ? '60' : '1'} className={input}><option value="1"><OperationalText text={"Minutes"} /></option><option value="60"><OperationalText text={"Hours"} /></option><option value="1440"><OperationalText text={"Days"} /></option></select></label>
              </div>
              <label className="text-small"><OperationalText text={"Maximum advance window (days)"} /><input name="maxAdvanceDays" type="number" min="1" defaultValue={configValue(selected.reservationConfig, 'maxAdvanceDays')} className={input} placeholder="90"/></label>
              <label className="text-small"><OperationalText text={"Maximum party size"} /><input name="maxPartySize" type="number" min="1" defaultValue={configValue(selected.reservationConfig, 'maxPartySize')} className={input}/></label>
              <label className="text-small"><OperationalText text={"Shared capacity per slot"} /><input name="maxConcurrentGuests" type="number" min="1" defaultValue={configValue(selected.reservationConfig, 'maxConcurrentGuests')} className={input}/></label>
              <div className="flex flex-wrap gap-16 md:col-span-2">
                <label className="flex items-center gap-8 text-small"><input type="checkbox" name="exclusive" defaultChecked={configBool(selected.reservationConfig, 'exclusive', true)}/> <OperationalText text={" Exclusive slot"} /></label>
                <label className="flex items-center gap-8 text-small"><input type="checkbox" name="autoConfirm" defaultChecked={configBool(selected.reservationConfig, 'autoConfirm', true)}/> <OperationalText text={" Auto-confirm available slots"} /></label>
              </div>
              <label className="text-small"><OperationalText text={"Pricing / entitlement"} /><input list="amenity-pricing-types" name="pricingType" defaultValue={selected.pricingType} className={input}/></label>
              <datalist id="amenity-pricing-types"><option value="not_specified"/><option value="included"/><option value="free"/><option value="paid"/><option value="deposit"/><option value="mixed"/></datalist>
              <label className="text-small"><OperationalText text={"Price THB (optional)"} /><input name="priceBaht" type="number" min="0" step="0.01" defaultValue={money(selected.priceThb)} className={input}/></label>
              <label className="text-small"><OperationalText text={"Capacity (optional)"} /><input name="capacity" type="number" min="1" defaultValue={selected.capacity ?? ''} className={input}/></label>
              <label className="text-small"><OperationalText text={"Minimum age (optional)"} /><input name="minAge" type="number" min="0" defaultValue={selected.minAge ?? ''} className={input}/></label>
            </div>
          </div>

          <div className="rounded-md border border-border-line bg-surface-paper p-20">
            <h3 className="font-semibold"><OperationalText text={"Hours, rules and terms"} /></h3>
            <div className="mt-12 grid gap-12 md:grid-cols-2">
              <AmenityHoursEditor value={selected.openingHours} timezone={timezone} disabled={busy} />
              <label className="text-small md:col-span-2"><OperationalText text={"Visitor and usage rules"} /><textarea name="rules" defaultValue={amenityLinesInput(selected.rules)} className={area} placeholder={'One rule per line; leave unknown rules empty'}/></label>
              <label className="text-small md:col-span-2"><OperationalText text={"Terms of use"} /><textarea name="terms" defaultValue={selected.terms || ''} className={area}/></label>
            </div>
          </div>

          <div className="rounded-md border border-border-line bg-surface-paper p-20">
            <div className="flex flex-wrap items-center justify-between gap-12"><div><h3 className="font-semibold"><OperationalText text={"Amenity gallery"} /></h3><p className="text-small text-text-secondary"><OperationalText text={"Photos belong to this amenity, not to the whole project or a unit."} /></p></div><label className="cursor-pointer rounded-md border border-border-line px-12 py-8 text-small font-semibold"><OperationalText text={"Upload photo"} /><input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadPhoto} className="hidden"/></label></div>
            <div className="mt-12 grid gap-12 sm:grid-cols-2 lg:grid-cols-4">
              {selected.media.map(row => <div key={row.mediaId} className="relative overflow-hidden rounded-lg border border-border-line">
                <Image src={row.media.storageKey} alt={selected.name} width={420} height={260} className="aspect-video w-full object-cover"/>
                <div className="flex flex-wrap gap-8 p-8"><button type="button" onClick={() => setCover(row.mediaId)} className="text-small font-semibold text-brand-andaman"><OperationalText text={selected.coverMediaId === row.mediaId ? 'Cover' : 'Set cover'} /></button><button type="button" onClick={() => removePhoto(row.mediaId)} className="text-small text-state-error"><OperationalText text={"Remove"} /></button></div>
              </div>)}
            </div>
          </div>

          <div className="flex flex-wrap justify-between gap-12">
            <button type="button" onClick={deleteAmenity} disabled={busy} className="min-h-40 rounded-md border border-state-error px-16 font-semibold text-state-error"><OperationalText text={"Delete amenity"} /></button>
            <button disabled={busy} className="min-h-44 rounded-md bg-brand-andaman px-20 font-semibold text-white disabled:opacity-50"><OperationalText text={busy ? 'Saving…' : 'Save amenity'} /></button>
          </div>
          </fieldset>
        </form>
      )}
    </section>
  </div>;
}
