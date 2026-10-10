'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { StitchMain, PublicHero } from '@/components/premium/StitchPage';
import { ProcessStepper } from '@/components/premium/PremiumPrimitives';

type Draft = { kind: string; existingUnitId: string | null; operatingModel: string | null; requestedManagementCompanyName: string; projectId: string | null; proposedProject: string; projectAddress: string; projectType: string; areaId: string | null; latitude: number | null; longitude: number | null; projectPhotos: string[]; unitName: string; unitType: string; bedrooms: number | null; bathrooms: number | null; sizeSqm: number | null; maxGuests: number | null; proposedNightlyBaht: number | null; proposedMinNights: number | null; floor: string; description: string; offers: string[]; contact: string; photos: string[]; status: 'draft' | 'submitted' | 'converted'; canonicalProjectId?: string; canonicalUnitId?: string | null; onboardingState?: string; onboardingBlockers?: string[] };
type Saved = { id: string; requirements: Draft };
const empty: Draft = { kind: 'home', existingUnitId: null, operatingModel: null, requestedManagementCompanyName: '', projectId: null, proposedProject: '', projectAddress: '', projectType: 'condominium', areaId: null, latitude: null, longitude: null, projectPhotos: [], unitName: '', unitType: 'condo', bedrooms: null, bathrooms: null, sizeSqm: null, maxGuests: null, proposedNightlyBaht: null, proposedMinNights: null, floor: '', description: '', offers: [], contact: '', photos: [], status: 'draft' };
const stepKeys = ['steps.kind', 'steps.residence', 'steps.details', 'steps.photos', 'steps.offers', 'steps.review'];
const field = 'stitch-control mt-8 block w-full';
const PHOTO_ACCEPT_TYPES = 'image/jpeg,image/png,image/webp';
export default function PropertySubmissionWizard({
  projects,
  labels,
  areas,
  initialSubmissionId,
  initialProjectId,
  initialOffers = [],
  initialKind,
  initialOperatingModel,
}: {
  labels: Record<string, string>;
  projects: { id: string; name: string; address: string }[];
  areas: { id: string; slug: string }[];
  initialSubmissionId?: string;
  initialProjectId?: string;
  initialOffers?: string[];
  initialKind?: string;
  initialOperatingModel?: string;
}) {
  const L = (key: string) => labels[`property.onboard.${key}`] || key;
  const format = (key: string, values: Record<string, string | number>) => Object.entries(values).reduce((text, [name, value]) => text.split(`{${name}}`).join(String(value)), L(key));
  const steps = stepKeys.map(L);
  const [draft, setDraft] = useState<Draft>({
    ...empty,
    projectId: initialProjectId || null,
    offers: initialOffers,
    kind: initialKind || empty.kind,
    operatingModel: initialOperatingModel || null,
  });
  const [saved, setSaved] = useState<Saved | null>(null);
  const [items, setItems] = useState<Saved[]>([]);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState(() => projects.find(project => project.id === initialProjectId)?.name || '');
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  const [projectUnits, setProjectUnits] = useState<Array<{ id: string; name: string; floor: string | null; bedrooms: number; bathrooms: number; sizeSqm: number | null }>>([]);
  const [unitSearch, setUnitSearch] = useState('');
  useEffect(() => {
    fetch('/api/property-submissions').then(r => r.ok ? r.json() : { items: [] })
      .then(v => { setItems(v.items || []); setMediaUrls(v.media || {});
        const item = (v.items || []).find((row: Saved) => row.id === initialSubmissionId);
        if (item) { setSaved(item); setDraft({ ...empty, ...item.requirements }); setStep(item.requirements.status === 'draft' ? 0 : stepKeys.length - 1); } }).catch(() => setItems([]));
  }, [initialSubmissionId]);
  const set = (patch: Partial<Draft>) => setDraft(old => ({ ...old, ...patch }));
  useEffect(() => {
    if (!draft.projectId) { setProjectUnits([]); return; }
    fetch('/api/property-submissions?projectId=' + encodeURIComponent(draft.projectId))
      .then(r => r.ok ? r.json() : { units: [] })
      .then(v => setProjectUnits(v.units || []))
      .catch(() => setProjectUnits([]));
  }, [draft.projectId]);
  const save = async (submit = false) => {
    setBusy(true); setError(''); setNotice('');
    try {
      const body = { ...draft, status: submit ? 'submitted' : 'draft' };
      const response = await fetch('/api/property-submissions', {
        method: saved ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(saved ? { ...body, id: saved.id } : body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || L('error.save'));
      setSaved(data); setDraft(data.requirements);
      setNotice(submit ? L('notice.submitted') : L('notice.saved'));
      if (submit) setStep(stepKeys.length - 1);
      return true;
    } catch (e) { setError(e instanceof Error ? e.message : L('error.save')); return false; }
    finally { setBusy(false); }
  };
  const next = async () => { if (await save()) setStep(old => Math.min(old + 1, stepKeys.length - 1)); };
  const selectedProject = projects.find(p => p.id === draft.projectId);
  const options = [['short_stay', L('offers.short_stay')], ['monthly', L('offers.monthly')], ['yearly', L('offers.yearly')], ['sale', L('offers.sale')]];
  return <StitchMain>
    <Link href="/property/listings" className="text-small text-brand-andaman">{L('back_listings')}</Link>
    <PublicHero kicker={L('kicker')} title={L('title')} body={L('intro')} />
    <div className="stitch-panel p-20 md:p-24">
      <ProcessStepper ariaLabel={L('steps.label')} steps={steps.map((label, index) => ({ label, state: index < step ? 'done' : index === step ? 'active' : 'waiting' }))} />
    </div>
    {items.length > 0 && !saved && <div className="mt-24 rounded-md border border-border-line p-16"><p className="font-semibold">{L('resume')}</p>{items.map(item => <button key={item.id} className="mt-8 block text-left text-brand-andaman underline" onClick={() => { setSaved(item); setDraft({ ...empty, ...item.requirements, photos: item.requirements.photos || [], projectPhotos: item.requirements.projectPhotos || [] }); setStep(item.requirements.status !== 'draft' ? stepKeys.length - 1 : 0); }}>{item.requirements.unitName || L('untitled')} · {labels[`property.onboard.status.${item.requirements.status}`] || L('status.unknown')}</button>)}</div>}
    {error && <p role="alert" className="mt-20 rounded-lg bg-state-error-soft p-16 text-state-error">{error}</p>}
    {notice && <p role="status" className="mt-20 rounded-lg bg-state-success-soft p-16 text-state-success">{notice}</p>}
    <section className="stitch-panel mt-32 min-h-[280px] p-24 md:p-32">
      <h2 className="mb-24 font-display text-heading-2 font-semibold">{steps[step]}</h2>
      {draft.status === 'converted' ? <div className="space-y-12"><p>{L('converted')}</p><p><strong>{L('state.label')}</strong> {labels[`property.onboard.state.${draft.onboardingState || 'readiness_pending'}`] || L('status.unknown')}</p>{draft.onboardingBlockers?.length ? <div role="status" className="rounded-lg border border-border-line bg-surface-ivory p-12"><p className="font-semibold">{L('blockers.title')}</p><ul className="mt-8 list-disc space-y-4 pl-20 text-small text-text-secondary">{draft.onboardingBlockers.map(blocker => <li key={blocker}>{labels[`property.onboard.blocker.${blocker.toLowerCase()}`] || L('blocker.unknown')}</li>)}</ul></div> : <p className="text-small text-state-success">{L('blockers.none')}</p>}{draft.canonicalProjectId && <Link className="block text-brand-andaman underline" href="/property/listings">{L('settings')}</Link>}</div> : draft.status === 'submitted' ? <p>{L('submitted')}</p> :
      step === 0 ? <div className="space-y-12">{[['home', L('kind.home'), L('kind.home_hint')], ['resort', L('kind.resort'), L('kind.resort_hint')], ['management', L('kind.management'), L('kind.management_hint')]].map(([value, title, subtitle]) => <button key={value} type="button" onClick={() => set({ kind: value })} aria-pressed={draft.kind === value} className={`w-full rounded-md border p-20 text-left ${draft.kind === value ? 'border-brand-andaman bg-surface-ivory' : 'border-border-line'}`}><strong>{title}</strong><p className="text-small text-text-secondary">{subtitle}</p></button>)}</div> :
      step === 1 ? <div><label className="block text-small">{L('residence.search')}<input className={field} value={search} onChange={e => setSearch(e.target.value)} placeholder={L('residence.search_placeholder')} /></label><div className="mt-12 max-h-[256px] space-y-8 overflow-auto">{projects.filter(p => (p.name + ' ' + p.address).toLowerCase().includes(search.toLowerCase())).slice(0, 25).map(p => <button key={p.id} type="button" onClick={() => set({ projectId: p.id, proposedProject: '', existingUnitId: null })} className={`block w-full rounded-lg border p-12 text-left ${draft.projectId === p.id ? 'border-brand-andaman' : 'border-border-line'}`}><strong>{p.name}</strong><p className="text-small text-text-secondary">{p.address}</p></button>)}</div><label className="mt-24 block text-small">{L('residence.not_listed')}<input className={field} value={draft.proposedProject} onChange={e => set({ proposedProject: e.target.value, projectId: null })} placeholder={L('residence.name_placeholder')} /></label><p className="mt-12 text-small text-text-secondary">{L('residence.duplicate_hint')}</p>{!draft.projectId && <div className="mt-24 space-y-12 border-t border-border-line pt-20"><h3 className="font-semibold">{L('residence.details')}</h3><label className="block text-small">{L('residence.type')}<select className={field} value={draft.projectType} onChange={e => set({ projectType: e.target.value })}><option value="condominium">{L('type.condominium')}</option><option value="resort">{L('type.resort')}</option><option value="villa_estate">{L('type.villa_estate')}</option><option value="standalone">{L('type.standalone')}</option></select></label><label className="block text-small">{L('residence.address')}<input className={field} value={draft.projectAddress} onChange={e => set({ projectAddress: e.target.value })} placeholder={L('residence.address_placeholder')} /></label><label className="block text-small">{L('residence.area')}<select className={field} value={draft.areaId || ''} onChange={e => set({ areaId: e.target.value || null })}><option value="">{L('residence.area_placeholder')}</option>{areas.map(a => <option key={a.id} value={a.id}>{a.slug}</option>)}</select></label><div className="grid grid-cols-2 gap-12">{(['latitude', 'longitude'] as const).map(key => <label key={key} className="text-small">{key === 'latitude' ? L('residence.latitude') : L('residence.longitude')}<input className={field} type="number" step="any" value={draft[key] ?? ''} onChange={e => set({ [key]: e.target.value === '' ? null : Number(e.target.value) })} /></label>)}</div><p className="text-small text-text-secondary">{L('residence.location_hint')}</p><label className="block text-small">{L('residence.photos')}<input type="file" accept={PHOTO_ACCEPT_TYPES} multiple disabled={busy} className={field} onChange={async e => { const files = Array.from(e.target.files || []); if (!files.length) return; setBusy(true); try { const ids: string[] = []; for (const file of files) { const data = new FormData(); data.set('file', file); const response = await fetch('/api/media/upload', { method: 'POST', body: data }); const payload = await response.json(); if (!response.ok || !payload.mediaAssetId) throw new Error(payload.error || L('error.upload')); ids.push(payload.mediaAssetId); setMediaUrls(old => ({ ...old, [payload.mediaAssetId]: payload.url })); } set({ projectPhotos: [...draft.projectPhotos, ...ids].slice(0, 50) }); } catch(e) { setError(e instanceof Error ? e.message : L('error.upload')); } finally { setBusy(false); } }}/></label><p className="text-small">{format('residence.photo_count', { count: draft.projectPhotos.length })}</p><div className="grid grid-cols-2 gap-12 md:grid-cols-3">{draft.projectPhotos.map((id, index) => <div key={id} className="overflow-hidden rounded-lg border border-border-line">{mediaUrls[id] && <Image src={mediaUrls[id]} alt={format('residence.photo_alt', { number: index + 1 })} width={360} height={240} className="aspect-[3/2] w-full object-cover" />}<div className="flex flex-wrap gap-8 p-8 text-small"><button type="button" disabled={index === 0} onClick={() => set({ projectPhotos: [id, ...draft.projectPhotos.filter(x => x !== id)] })} className="text-brand-andaman">{L('photos.cover')}</button><button type="button" onClick={() => set({ projectPhotos: draft.projectPhotos.filter(x => x !== id) })} className="text-state-error">{L('photos.remove')}</button></div></div>)}</div></div>}</div> :
      step === 2 ? <div className="grid gap-16 md:grid-cols-2"><p className="md:col-span-2 text-small text-text-secondary">{L('details.reuse_hint')}</p>{draft.projectId ? <div className="md:col-span-2 rounded-md border border-border-line p-16"><label className="block text-small">{L('details.search')}<input className={field} value={unitSearch} onChange={e => setUnitSearch(e.target.value)} placeholder={L('details.search_placeholder')} /></label><div className="mt-12 max-h-[224px] space-y-8 overflow-auto">{projectUnits.filter(unit => (unit.name + ' ' + (unit.floor || '')).toLowerCase().includes(unitSearch.toLowerCase())).slice(0, 30).map(unit => <button key={unit.id} type="button" onClick={() => set({ existingUnitId: unit.id, unitName: unit.name, bedrooms: unit.bedrooms, bathrooms: unit.bathrooms, sizeSqm: unit.sizeSqm, floor: unit.floor || '' })} className={`block w-full rounded-lg border p-12 text-left ${draft.existingUnitId === unit.id ? 'border-brand-andaman bg-surface-ivory' : 'border-border-line'}`}><strong>{unit.name}</strong><p className="text-small text-text-secondary">{format('details.summary', { bedrooms: unit.bedrooms, bathrooms: unit.bathrooms })}{unit.floor ? ' · ' + format('details.floor_summary', { floor: unit.floor }) : ''}{unit.sizeSqm ? ' · ' + format('details.area_summary', { area: unit.sizeSqm }) : ''}</p></button>)}</div><button type="button" onClick={() => set({ existingUnitId: null })} className="mt-12 text-small font-semibold text-brand-andaman underline">{L('details.not_listed')}</button></div> : null}<label className="md:col-span-2 text-small">{L('details.name')}<input required disabled={Boolean(draft.existingUnitId)} className={field} value={draft.unitName} onChange={e => set({ unitName: e.target.value, existingUnitId: null })} placeholder={L('details.name_placeholder')} /></label><label className="text-small">{L('details.type')}<select className={field} value={draft.unitType} onChange={e => set({ unitType: e.target.value })}><option value="condo">{L('type.condominium')}</option><option value="apartment">{L('type.apartment')}</option><option value="villa">{L('type.villa')}</option><option value="house">{L('type.house')}</option></select></label><label className="text-small">{L('details.max_guests')}<input className={field} type="number" min="1" value={draft.maxGuests ?? ''} onChange={e => set({ maxGuests: e.target.value === '' ? null : Number(e.target.value) })}/></label>{([['bedrooms', L('details.bedrooms')], ['bathrooms', L('details.bathrooms')], ['sizeSqm', L('details.size')]] as const).map(([key, label]) => <label key={key} className="text-small">{label}<input className={field} type="number" min="0" value={draft[key] ?? ''} onChange={e => set({ [key]: e.target.value === '' ? null : Number(e.target.value) })} /></label>)}<label className="text-small">{L('details.floor')}<input className={field} value={draft.floor} onChange={e => set({ floor: e.target.value })}/></label><label className="md:col-span-2 text-small">{L('details.description')}<textarea className="mt-8 block min-h-32 w-full rounded-lg border border-border-line p-4" value={draft.description} onChange={e => set({ description: e.target.value })} placeholder={L('details.description_placeholder')} /></label></div> :
      step === 3 ? <div className="space-y-16"><p>{L('photos.hint')}</p><input type="file" accept={PHOTO_ACCEPT_TYPES} multiple disabled={busy} onChange={async e => { const files = Array.from(e.target.files || []); if (!files.length) return; setBusy(true); setError(''); try { const ids: string[] = []; for (const file of files) { const data = new FormData(); data.set('file', file); const response = await fetch('/api/media/upload', { method: 'POST', body: data }); const payload = await response.json(); if (!response.ok || !payload.mediaAssetId) throw new Error(payload.error || L('error.upload')); ids.push(payload.mediaAssetId); setMediaUrls(old => ({ ...old, [payload.mediaAssetId]: payload.url })); } set({ photos: [...draft.photos, ...ids].slice(0, 50) }); setNotice(L('notice.uploaded')); } catch (e) { setError(e instanceof Error ? e.message : L('error.upload')); } finally { setBusy(false); } }} /><p className="text-small text-text-secondary">{format('photos.count', { count: draft.photos.length })}</p><div className="grid grid-cols-2 gap-12 md:grid-cols-3">{draft.photos.map((id, index) => <div key={id} className="overflow-hidden rounded-lg border border-border-line">{mediaUrls[id] && <Image src={mediaUrls[id]} alt={format('photos.alt', { number: index + 1 })} width={360} height={240} className="aspect-[3/2] w-full object-cover" />}<div className="flex flex-wrap gap-8 p-8 text-small"><button type="button" disabled={index === 0} onClick={() => set({ photos: [id, ...draft.photos.filter(x => x !== id)] })} className="text-brand-andaman">{L('photos.cover')}</button><button type="button" disabled={index === 0} onClick={() => { const ids = [...draft.photos]; [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]]; set({ photos: ids }); }} className="text-brand-andaman">{L('photos.left')}</button><button type="button" onClick={() => set({ photos: draft.photos.filter(x => x !== id) })} className="text-state-error">{L('photos.remove')}</button></div></div>)}</div></div> :
      step === 4 ? <div className="space-y-16"><p>{L('offers.hint')}</p>{options.map(([value, label]) => <label key={value} className="flex items-center gap-12 rounded-lg border border-border-line p-16"><input type="checkbox" checked={draft.offers.includes(value)} onChange={e => set({ offers: e.target.checked ? [...draft.offers, value] : draft.offers.filter(x => x !== value) })}/>{label}</label>)}<div className="border-t border-border-line pt-16"><p className="mb-12 font-semibold">{L('operating.title')}</p>{[['owner_direct',L('operating.owner_direct')],['via_management_company',L('operating.via_management_company')],['direct_managed',L('operating.direct_managed')]].map(([value,label]) => <label key={value} className="mb-8 flex items-center gap-12 rounded-lg border border-border-line p-12"><input type="radio" name="operatingModel" checked={draft.operatingModel===value} onChange={() => set({ operatingModel: value })}/>{label}</label>)}{draft.operatingModel === 'via_management_company' ? <label className="block text-small">{L('operating.company')}<input className={field} value={draft.requestedManagementCompanyName} onChange={e => set({ requestedManagementCompanyName: e.target.value })} placeholder={L('operating.company_placeholder')} /></label> : null}<p className="text-small text-text-secondary">{L('operating.hint')}</p></div><label className="block text-small">{L('offers.price')}<input type="number" min="1" step="1" className={field} value={draft.proposedNightlyBaht ?? ''} onChange={e => set({ proposedNightlyBaht: e.target.value ? Number(e.target.value) : null })} /></label><label className="block text-small">{L('offers.minimum')}<input type="number" min="1" step="1" className={field} value={draft.proposedMinNights ?? ''} onChange={e => set({ proposedMinNights: e.target.value ? Number(e.target.value) : null })} /></label><p className="text-small text-text-secondary">{L('offers.terms_hint')}</p><label className="block text-small">{L('offers.contact')}<input className={field} value={draft.contact} onChange={e => set({ contact: e.target.value })} placeholder={L('offers.contact_placeholder')} /></label></div> :
      <div className="space-y-12"><p><strong>{L('review.property')}</strong> {draft.unitName || L('review.not_supplied')}{draft.existingUnitId ? ' · ' + L('review.existing') : ''}</p><p><strong>{L('review.residence')}</strong> {selectedProject?.name || draft.proposedProject || L('review.not_supplied')}</p><p><strong>{L('review.offers')}</strong> {draft.offers.map(offer => labels[`property.onboard.offers.${offer}`] || L('review.not_selected')).join(', ') || L('review.not_selected')}</p><p><strong>{L('review.operating')}</strong> {draft.operatingModel ? labels[`property.onboard.operating.${draft.operatingModel}`] || L('review.not_selected') : L('review.not_selected')}</p><p className="text-small text-text-secondary">{L('review.hint')}</p></div>}
    </section>
    <div className="stitch-panel sticky bottom-0 z-20 mt-24 flex flex-wrap items-center justify-between gap-12 p-16">
      <button type="button" disabled={busy || step === 0} onClick={() => { setError(''); setStep(s => s - 1); }} className="rounded-lg border border-border-line px-24 py-12 disabled:opacity-40">{L('action.back')}</button>
      <div className="flex gap-8"><button type="button" disabled={busy || draft.status !== 'draft'} onClick={() => save()} className="rounded-lg border border-border-line px-20 py-12 disabled:opacity-40">{L('action.save')}</button>{step < stepKeys.length - 1 ? <button disabled={busy || draft.status !== 'draft'} onClick={next} className="rounded-md bg-brand-andaman px-24 py-12 font-semibold text-white shadow-card transition hover:bg-brand-deep disabled:opacity-40">{L('action.next')}</button> : <button disabled={busy || draft.status !== 'draft'} onClick={() => save(true)} className="rounded-lg bg-brand-andaman px-24 py-12 font-semibold text-white disabled:opacity-40">{L('action.submit')}</button>}</div>
    </div>
  </StitchMain>;
}
