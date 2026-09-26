'use client';
/* eslint-disable local-rules/no-literal-ui-text */

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/Button';
import type { PropertyReadinessReport } from '@/modules/projects';

type Category = { id: string; name: string; categoryKey: string };
type Unit = { id: string; name: string; ownerIdentityId: string | null; inventoryCategory?: Category | null; media: unknown[]; sleepingSpaces: Array<{ beds: unknown[] }>; commercialOfferings: Array<{ channelMappings: Array<{ channel: string; syncState: string }> }>; privacyType?: string | null; accommodationType?: string | null; furnishingStatus?: string | null; floor?: string | null; usableAreaSqm?: string | number | null; outdoorAreaSqm?: string | number | null; plotAreaSqm?: string | number | null; views?: string[]; unitFeatures?: string[]; accessibilityFacts?: string[]; safetyFacts?: string[]; petsAllowed?: boolean | null; maxPets?: number | null; petFeeThb?: number | null; petRules?: string | null };
type Project = { id: string; name: string; status: string; coverMediaId: string | null; galleryMedia: unknown[]; inventoryCategories: Category[]; ratePlans: Array<{ id: string; name: string; code: string }>; units: Unit[] };

const steps = ['Project', 'Units & categories', 'Owner & contract', 'Compliance', 'Pricing', 'Content & photos', 'Channels', 'Team', 'Final review'];
const input = 'h-40 rounded-sm border border-border-line bg-surface-paper px-12';

export default function PropertyOnboardingClient({ initialProject, initialReadiness }: { initialProject: Project; initialReadiness: PropertyReadinessReport }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (url: string, body: object, method = 'POST') => {
    setBusy(true); setMessage(null);
    const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const payload = await response.json(); setBusy(false);
    if (!response.ok) { setMessage(payload.error || 'Action failed.'); return null; }
    setMessage('Saved. Readiness report refreshed.'); router.refresh(); return payload;
  };
  const form = (handler: (data: FormData) => Promise<void>) => async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); await handler(new FormData(event.currentTarget)); };

  return <main className="max-w-6xl pb-48">
    <div className="flex flex-wrap items-start justify-between gap-16 mb-24"><div><p className="text-kicker text-brand-andaman">Unified property onboarding</p><h1 className="font-display text-display-xl font-semibold">{initialProject.name}</h1></div><span className={`rounded-full px-12 py-8 text-small ${initialReadiness.readyForActivation ? 'bg-state-success-soft text-state-success' : 'bg-state-warning-soft text-state-warning'}`}>{initialReadiness.score}% ready</span></div>
    <nav aria-label="Onboarding progress" className="flex gap-8 overflow-x-auto mb-24">{steps.map((step, index) => <a key={step} href={`#step-${index + 1}`} className="shrink-0 rounded-full border border-border-line px-12 py-8 text-small">{index + 1}. {step}</a>)}</nav>
    {message ? <p role="status" className="mb-16 rounded-md bg-surface-muted p-12">{message}</p> : null}

    <Section id="step-1" title="1. Project and area"><p>Canonical area and location are set on the project record. Use Project 360 for detailed physical facts.</p><div className="mt-12 flex gap-12"><Link className="text-brand-andaman underline" href={`/app/admin/projects/${initialProject.id}`}>Open Project 360</Link><Link className="text-brand-andaman underline" href="/app/admin/areas">Manage areas</Link></div></Section>

    <Section id="step-2" title="2. Units and canonical categories">
      <form className="grid md:grid-cols-6 gap-8" onSubmit={form(async d => { await submit(`/api/admin/projects/${initialProject.id}/catalog`, { action: 'category', categoryKey: d.get('key'), name: d.get('name'), bedrooms: d.get('bedrooms'), bathrooms: d.get('bathrooms'), maxGuests: d.get('guests'), baseNightlyThb: d.get('rate'), minNights: 1 }); })}><input className={input} name="key" placeholder="Category key" required/><input className={input} name="name" placeholder="Display name" required/><input className={input} name="bedrooms" type="number" placeholder="Beds" required/><input className={input} name="bathrooms" type="number" placeholder="Baths" required/><input className={input} name="guests" type="number" placeholder="Guests" required/><Button disabled={busy}>Save category</Button></form>
      <p className="mt-12 text-small text-text-secondary">{initialProject.inventoryCategories.map(c => `${c.name} (${c.categoryKey})`).join(' · ') || 'No categories yet.'}</p>
      <form className="grid md:grid-cols-4 gap-8 mt-20" onSubmit={form(async d => { await submit('/api/admin/units', { projectId: initialProject.id, inventoryCategoryId: d.get('category'), name: d.get('name'), unitType: 'villa', bedrooms: Number(d.get('bedrooms')), bathrooms: 1, maxGuests: 2, addressSupplement: String(d.get('name')), descriptionKey: `unit.${String(d.get('name')).toLowerCase().replace(/ /g, '_')}.description`, baseNightlyThb: 100000, status: 'draft' }); })}><input className={input} name="name" placeholder="Unit name" required/><select className={input} name="category" required><option value="">Select category</option>{initialProject.inventoryCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><input className={input} name="bedrooms" type="number" min="0" placeholder="Bedrooms" required/><Button disabled={busy}>Add unit</Button></form>
    </Section>

    <Section id="step-3" title="3. Owner, invitation and contract"><OwnerInvite units={initialProject.units} submit={submit}/><UnitLinks units={initialProject.units} label="Open owner and contract workspace"/></Section>
    <Section id="step-4" title="4. Compliance, mobilization and sleeping arrangements"><p>Permitted-use evidence, all seven mobilization steps and a bed-level sleeping layout are activation blockers.</p><SleepingForm units={initialProject.units} submit={submit}/><UnitLinks units={initialProject.units} label="Complete compliance checklist"/></Section>
    <Section id="step-5" title="5. Pricing and rate plans"><div className="rounded-md bg-state-warning-soft p-12 mb-16"><strong>Migration decision:</strong> canonical rate plans are configuration-only for now. Guest search and booking continue using the proven unit/category pricing engine until seasonal selection and quote semantics are migrated and tested.</div><form className="flex flex-wrap gap-8" onSubmit={form(async d => { await submit(`/api/admin/projects/${initialProject.id}/catalog`, { action: 'rate_plan', categoryId: d.get('category'), code: d.get('code'), name: d.get('name'), isMaster: true }); })}><select className={input} name="category" required><option value="">Category</option>{initialProject.inventoryCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><input className={input} name="code" placeholder="Plan code" required/><input className={input} name="name" placeholder="Plan name" required/><Button disabled={busy}>Save plan</Button></form></Section>
    <Section id="step-6" title="6. Content and galleries"><p>Project and unit media support ordered galleries and an explicit cover. Activation requires a project cover and at least three unit photos.</p><GalleryUpload projectId={initialProject.id} units={initialProject.units}/><PropertyFactsForm units={initialProject.units} submit={submit}/><UnitLinks units={initialProject.units} label="Open unit gallery"/></Section>
    <Section id="step-7" title="7. Channels and OTA mappings"><div className="rounded-md bg-state-warning-soft p-12 mb-16"><strong>Manual-risk warning:</strong> iCal and manual mappings do not push ARI. After every direct booking, close inventory in the OTA extranets until an ARI-capable connection reports <code>ari_push</code>.</div><ChannelForm units={initialProject.units} submit={submit}/></Section>
    <Section id="step-8" title="8. Team"><p>Invite people from the owner form above, then grant project or unit roles in People & access.</p><Link className="text-brand-andaman underline" href="/app/admin/people">Open People & access</Link></Section>
    <Section id="step-9" title="9. Final review and go-live"><Readiness report={initialReadiness}/><Button disabled={busy || !initialReadiness.readyForActivation || initialProject.status === 'live'} onClick={() => submit(`/api/admin/projects/${initialProject.id}`, { status: 'live' }, 'PUT')}>{initialProject.status === 'live' ? 'Property is live' : 'Activate property'}</Button></Section>
  </main>;
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) { return <section id={id} className="scroll-mt-24 mb-20 rounded-lg border border-border-line bg-surface-paper p-20"><h2 className="font-display text-heading-lg font-semibold mb-12">{title}</h2>{children}</section>; }
function UnitLinks({ units, label }: { units: Unit[]; label: string }) { return <ul className="mt-12 space-y-8">{units.map(u => <li key={u.id}><Link className="text-brand-andaman underline" href={`/app/admin/units/${u.id}`}>{label}: {u.name}</Link></li>)}</ul>; }
function OwnerInvite({ units, submit }: { units: Unit[]; submit: (url: string, body: object, method?: string) => Promise<any> }) { return <form className="flex flex-wrap gap-8" onSubmit={async e => { e.preventDefault(); const d = new FormData(e.currentTarget); const invite = await submit('/api/admin/people/invite', { email: d.get('email'), firstName: d.get('firstName'), lastName: d.get('lastName'), preferredLocale: 'en' }); if (invite) await submit(`/api/admin/units/${d.get('unit')}/owner`, { ownerIdentityId: invite.identity.id }, 'PUT'); }}><select className={input} name="unit" required><option value="">Unit</option>{units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select><input className={input} name="firstName" placeholder="First name" required/><input className={input} name="lastName" placeholder="Last name" required/><input className={input} name="email" type="email" placeholder="Owner email" required/><Button>Invite and assign owner</Button></form>; }
function ChannelForm({ units, submit }: { units: Unit[]; submit: (url: string, body: object, method?: string) => Promise<any> }) { return <form className="flex flex-wrap gap-8" onSubmit={async e => { e.preventDefault(); const d = new FormData(e.currentTarget); await submit(`/api/admin/units/${d.get('unit')}/property-details`, { action: 'channel_mapping', channel: d.get('channel'), externalListingId: d.get('listing'), syncState: d.get('sync') }); }}><select className={input} name="unit" required><option value="">Unit</option>{units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select><input className={input} name="channel" placeholder="Channel" required/><input className={input} name="listing" placeholder="Listing ID"/><select className={input} name="sync"><option value="ical_only">iCal only</option><option value="manual">Manual</option></select><Button>Save mapping</Button></form>; }
function SleepingForm({ units, submit }: { units: Unit[]; submit: (url: string, body: object, method?: string) => Promise<any> }) { return <form className="flex flex-wrap gap-8 my-12" onSubmit={async e => { e.preventDefault(); const d = new FormData(e.currentTarget); await submit(`/api/admin/units/${d.get('unit')}/property-details`, { action: 'sleeping_space', spaceType: d.get('spaceType'), name: d.get('name'), beds: [{ bedType: d.get('bedType'), count: Number(d.get('count')) }] }); }}><select className={input} name="unit" required><option value="">Unit</option>{units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select><select className={input} name="spaceType"><option value="bedroom">Bedroom</option><option value="living_room">Living room</option></select><input className={input} name="name" placeholder="Room name"/><select className={input} name="bedType"><option value="king">King bed</option><option value="queen">Queen bed</option><option value="single">Single bed</option><option value="sofa_bed">Sofa bed</option></select><input className={input} name="count" type="number" min="1" defaultValue="1"/><Button>Save sleeping space</Button></form>; }
function GalleryUpload({ projectId, units }: { projectId: string; units: Unit[] }) { const router = useRouter(); const [target, setTarget] = useState('project'); const [uploading, setUploading] = useState(false); return <form className="flex flex-wrap gap-8 my-12" onSubmit={async e => { e.preventDefault(); const data = new FormData(e.currentTarget); setUploading(true); const uploaded = await fetch('/api/media/upload', { method: 'POST', body: data }); const asset = await uploaded.json(); if (uploaded.ok) await fetch(target === 'project' ? `/api/admin/projects/${projectId}/media` : `/api/admin/units/${target}/media`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mediaAssetId: asset.mediaAssetId, cover: true }) }); setUploading(false); router.refresh(); }}><select className={input} value={target} onChange={e => setTarget(e.target.value)}><option value="project">Project gallery</option>{units.map(u => <option key={u.id} value={u.id}>{u.name} gallery</option>)}</select><input className={input} name="file" type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml" required/><Button disabled={uploading}>{uploading ? 'Uploading…' : 'Upload and set cover'}</Button></form>; }
/**
 * The listing's physical facts (audit F-2/F-5).
 *
 * Sixteen `unit` columns have existed since the canonical property-data
 * migration with no screen behind them, so a listing could never say more
 * than its bedroom and bathroom counts. Lists are entered comma-separated
 * and normalised server-side; a blank field is left untouched rather than
 * cleared, so saving one section cannot silently wipe another.
 */
function PropertyFactsForm({ units, submit }: { units: Unit[]; submit: (url: string, body: object, method?: string) => Promise<any> }) {
  const [unitId, setUnitId] = useState('');
  const selected = units.find(u => u.id === unitId);
  const list = (value: FormDataEntryValue | null) => String(value || '').split(',').map(v => v.trim()).filter(Boolean);
  const num = (value: FormDataEntryValue | null) => { const raw = String(value || '').trim(); return raw === '' ? undefined : Number(raw); };
  const text = (value: FormDataEntryValue | null) => { const raw = String(value || '').trim(); return raw === '' ? undefined : raw; };

  return <form className="my-16 rounded-md border border-border-line p-16" onSubmit={async e => {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    if (!unitId) return;
    const petsRaw = String(d.get('petsAllowed') || '');
    await submit(`/api/admin/units/${unitId}/property-details`, {
      privacyType: text(d.get('privacyType')),
      accommodationType: text(d.get('accommodationType')),
      furnishingStatus: text(d.get('furnishingStatus')),
      floor: text(d.get('floor')),
      usableAreaSqm: num(d.get('usableAreaSqm')),
      outdoorAreaSqm: num(d.get('outdoorAreaSqm')),
      plotAreaSqm: num(d.get('plotAreaSqm')),
      views: d.get('views') !== null ? list(d.get('views')) : undefined,
      unitFeatures: d.get('unitFeatures') !== null ? list(d.get('unitFeatures')) : undefined,
      accessibilityFacts: d.get('accessibilityFacts') !== null ? list(d.get('accessibilityFacts')) : undefined,
      safetyFacts: d.get('safetyFacts') !== null ? list(d.get('safetyFacts')) : undefined,
      ...(petsRaw === '' ? {} : { petsAllowed: petsRaw === 'yes' }),
      ...(petsRaw === 'yes' ? { maxPets: num(d.get('maxPets')), petFeeBaht: num(d.get('petFeeBaht')), petRules: text(d.get('petRules')) } : {}),
    }, 'PUT');
  }}>
    <p className="mb-12 text-small text-text-secondary">Physical facts. A blank field is left as it is; pets left unanswered stays unanswered, which is not the same as &ldquo;no&rdquo;.</p>
    <div className="grid md:grid-cols-4 gap-8">
      <select className={input} value={unitId} onChange={e => setUnitId(e.target.value)} required aria-label="Unit"><option value="">Unit</option>{units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
      <select className={input} name="privacyType" defaultValue={selected?.privacyType || ''} key={`p-${unitId}`} aria-label="Privacy type"><option value="">Privacy type</option><option value="entire_place">Entire place</option><option value="private_room">Private room</option><option value="shared_room">Shared room</option></select>
      <input className={input} name="accommodationType" defaultValue={selected?.accommodationType || ''} key={`a-${unitId}`} placeholder="Accommodation type"/>
      <select className={input} name="furnishingStatus" defaultValue={selected?.furnishingStatus || ''} key={`f-${unitId}`} aria-label="Furnishing"><option value="">Furnishing</option><option value="fully_furnished">Fully furnished</option><option value="part_furnished">Part furnished</option><option value="unfurnished">Unfurnished</option></select>
      <input className={input} name="floor" defaultValue={selected?.floor || ''} key={`fl-${unitId}`} placeholder="Floor"/>
      <input className={input} name="usableAreaSqm" type="number" step="any" min="0" defaultValue={selected?.usableAreaSqm ? String(selected.usableAreaSqm) : ''} key={`u-${unitId}`} placeholder="Usable area m²"/>
      <input className={input} name="outdoorAreaSqm" type="number" step="any" min="0" defaultValue={selected?.outdoorAreaSqm ? String(selected.outdoorAreaSqm) : ''} key={`o-${unitId}`} placeholder="Outdoor area m²"/>
      <input className={input} name="plotAreaSqm" type="number" step="any" min="0" defaultValue={selected?.plotAreaSqm ? String(selected.plotAreaSqm) : ''} key={`pl-${unitId}`} placeholder="Plot area m²"/>
      <input className={input} name="views" defaultValue={(selected?.views || []).join(', ')} key={`v-${unitId}`} placeholder="Views (sea, garden)"/>
      <input className={input} name="unitFeatures" defaultValue={(selected?.unitFeatures || []).join(', ')} key={`uf-${unitId}`} placeholder="Features (private_pool)"/>
      <input className={input} name="accessibilityFacts" defaultValue={(selected?.accessibilityFacts || []).join(', ')} key={`ac-${unitId}`} placeholder="Accessibility"/>
      <input className={input} name="safetyFacts" defaultValue={(selected?.safetyFacts || []).join(', ')} key={`sf-${unitId}`} placeholder="Safety (smoke_alarm)"/>
      <select className={input} name="petsAllowed" defaultValue={selected?.petsAllowed === null || selected?.petsAllowed === undefined ? '' : selected.petsAllowed ? 'yes' : 'no'} key={`pa-${unitId}`} aria-label="Pets"><option value="">Pets — not answered</option><option value="yes">Pets allowed</option><option value="no">No pets</option></select>
      <input className={input} name="maxPets" type="number" min="0" defaultValue={selected?.maxPets ?? ''} key={`mp-${unitId}`} placeholder="Max pets"/>
      <input className={input} name="petFeeBaht" type="number" min="0" defaultValue={selected?.petFeeThb ? Math.round(selected.petFeeThb / 100) : ''} key={`pf-${unitId}`} placeholder="Pet fee ฿"/>
      <input className={input} name="petRules" defaultValue={selected?.petRules || ''} key={`pr-${unitId}`} placeholder="Pet rules"/>
    </div>
    <div className="mt-12"><Button disabled={!unitId}>Save physical facts</Button></div>
  </form>;
}

function Readiness({ report }: { report: PropertyReadinessReport }) { return <div className="mb-16"><p className="mb-8"><strong>{report.blockers.length}</strong> blockers · <strong>{report.warnings.length}</strong> warnings</p><ul className="space-y-6">{[...report.blockers, ...report.warnings].map(item => <li key={`${item.key}-${item.unitId || ''}`} className={item.severity === 'blocker' ? 'text-state-error' : 'text-state-warning'}>{item.severity === 'blocker' ? 'Blocker' : 'Warning'}: {item.unitName ? `${item.unitName} — ` : ''}{item.message}</li>)}</ul></div>; }
