'use client';
/* eslint-disable local-rules/no-literal-ui-text */

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/Button';
import type { PropertyReadinessReport } from '@/modules/projects';

type Category = { id: string; name: string; categoryKey: string };
type Unit = { id: string; name: string; ownerIdentityId: string | null; commercialOfferings: Array<{ id:string;offeringType:string;status:string;pricingTerms:unknown;channelMappings: Array<{ channel:string;syncState:string }> }>; inventoryCategory?: Category | null; media: unknown[]; sleepingSpaces: Array<{ beds: unknown[] }>; commercialOfferings: Array<{ channelMappings: Array<{ channel: string; syncState: string }> }> };
type Project = { id: string; name: string; status: string; coverMediaId: string | null; galleryMedia: unknown[]; inventoryCategories: Category[]; ratePlans: Array<{ id: string; name: string; code: string }>; units: Unit[] };

const steps = ['Project', 'Categories & homes', 'Owner & contract', 'Compliance', 'Stay offering', 'Pricing', 'Content & photos', 'Availability & channels', 'Team', 'Review & publish'];
const input = 'h-40 rounded-sm border border-border-line bg-surface-paper px-12';
function unitPropertyDetailsPath(unitId: string) { return `/api/admin/units/${unitId}/property-details`; }

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
    <div className="flex flex-wrap items-start justify-between gap-16 mb-24"><div><p className="text-kicker text-brand-andaman">Canonical Stay onboarding</p><h1 className="font-display text-display-xl font-semibold">{initialProject.name}</h1></div><span className={`rounded-full px-12 py-8 text-small ${initialReadiness.readyForActivation ? 'bg-state-success-soft text-state-success' : 'bg-state-warning-soft text-state-warning'}`}>{initialReadiness.score}% ready</span></div>
    <nav aria-label="Onboarding progress" className="flex gap-8 overflow-x-auto mb-24">{steps.map((step, index) => <a key={step} href={`#step-${index + 1}`} className="shrink-0 rounded-full border border-border-line px-12 py-8 text-small">{index + 1}. {step}</a>)}</nav>
    {message ? <p role="status" className="mb-16 rounded-md bg-surface-muted p-12">{message}</p> : null}

    <Section id="step-1" title="1. Project and area"><p>Canonical area and location are set on the project record. Use Project 360 for detailed physical facts.</p><div className="mt-12 flex gap-12"><Link className="text-brand-andaman underline" href={`/app/admin/projects/${initialProject.id}`}>Open Project 360</Link><Link className="text-brand-andaman underline" href="/app/admin/areas">Manage areas</Link></div></Section>

    <Section id="step-2" title="2. Categories and homes">
      <form className="grid md:grid-cols-6 gap-8" onSubmit={form(async d => { await submit(`/api/admin/projects/${initialProject.id}/catalog`, { action: 'category', categoryKey: d.get('key'), name: d.get('name'), bedrooms: d.get('bedrooms'), bathrooms: d.get('bathrooms'), maxGuests: d.get('guests'), baseNightlyThb: d.get('rate'), minNights: 1, status: 'draft' }); })}><input className={input} name="key" placeholder="Category key" required/><input className={input} name="name" placeholder="Display name" required/><input className={input} name="bedrooms" type="number" placeholder="Beds" required/><input className={input} name="bathrooms" type="number" placeholder="Baths" required/><input className={input} name="guests" type="number" placeholder="Guests" required/><input className={input} name="rate" type="number" min="0" step="0.01" placeholder="Base THB/night" required/><Button disabled={busy}>Save category</Button></form>
      <p className="mt-12 text-small text-text-secondary">{initialProject.inventoryCategories.map(c => `${c.name} (${c.categoryKey})`).join(' · ') || 'No categories yet.'}</p>
      <form className="grid md:grid-cols-6 gap-8 mt-20" onSubmit={form(async d => { await submit('/api/admin/units', { projectId: initialProject.id, inventoryCategoryId: d.get('category'), name: d.get('name'), unitType: d.get('unitType'), bedrooms: Number(d.get('bedrooms')), bathrooms: Number(d.get('bathrooms')), maxGuests: Number(d.get('maxGuests')), addressSupplement: String(d.get('name')), descriptionKey: `unit.${String(d.get('name')).toLowerCase().replace(/ /g, '_')}.description`, baseNightlyThb: 0, status: 'draft' }); })}><input className={input} name="name" placeholder="Home name / number" required/><select className={input} name="category" required><option value="">Select category</option>{initialProject.inventoryCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><select className={input} name="unitType" defaultValue="villa"><option value="villa">Villa</option><option value="condo">Condominium / apartment</option><option value="townhouse">Townhouse / house</option></select><input className={input} name="bedrooms" type="number" min="0" placeholder="Bedrooms" required/><input className={input} name="bathrooms" type="number" min="0" step="1" placeholder="Bathrooms" required/><input className={input} name="maxGuests" type="number" min="1" placeholder="Max guests" required/><Button disabled={busy}>Add home</Button></form>
    </Section>

    <Section id="step-3" title="3. Owner, invitation and contract"><OwnerInvite units={initialProject.units} submit={submit}/><UnitLinks units={initialProject.units} label="Open owner and contract workspace"/></Section>
    <Section id="step-4" title="4. Full physical facts, sleeping arrangements and compliance"><p>Record floor, all measured areas, furnishing, views, amenities and a bed-level layout. Access codes are private and handled separately from public listing data.</p><PhysicalFactsForm units={initialProject.units} submit={submit}/><SleepingForm units={initialProject.units} submit={submit}/><UnitLinks units={initialProject.units} label="Complete compliance checklist"/></Section>
    <Section id="step-5" title="5. One home · three commercial offers">
      <p className="mb-12">The physical home is entered once. Add a separate nightly, monthly or sale offer using the same unit and project. New offers are saved as drafts until readiness checks pass.</p>
      <OfferingForm units={initialProject.units} submit={submit}/>
      <UnitLinks units={initialProject.units} label="Inspect unit and all offers"/>
    </Section>
    <Section id="step-6" title="6. Pricing and rate plans"><p className="rounded-md bg-surface-muted p-12 mb-16">RatePlan is the canonical pricing contract. Category BAR is the master rate; unit-level rules are explicit exceptions. Legacy price fields remain compatibility reads only.</p><form className="flex flex-wrap gap-8" onSubmit={form(async d => { await submit(`/api/admin/projects/${initialProject.id}/catalog`, { action: 'rate_plan', categoryId: d.get('category'), code: d.get('code'), name: d.get('name'), isMaster: true }); })}><select className={input} name="category" required><option value="">Category</option>{initialProject.inventoryCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><input className={input} name="code" placeholder="Plan code" required/><input className={input} name="name" placeholder="Plan name" required/><Button disabled={busy}>Save plan</Button></form></Section>
    <Section id="step-7" title="7. Content and galleries"><p>Project and unit media support ordered galleries and an explicit cover. Activation requires a project cover and at least three unit photos.</p><GalleryUpload projectId={initialProject.id} units={initialProject.units}/><UnitLinks units={initialProject.units} label="Open unit gallery"/></Section>
    <Section id="step-8" title="8. Availability and channels"><p className="mb-12">Availability is derived from Booking, active holds, BlockedDate and approved external blocks. This screen configures inputs to that engine; it never maintains a second availability truth.</p><div className="rounded-md bg-state-warning-soft p-12 mb-16"><strong>Manual-risk warning:</strong> iCal and manual mappings do not push ARI. After every direct booking, close inventory in the OTA extranets until an ARI-capable connection reports <code>ari_push</code>.</div><ChannelForm units={initialProject.units} submit={submit}/></Section>
    <Section id="step-9" title="9. Team"><p>Invite people from the owner form above, then grant project or unit roles in People & access.</p><Link className="text-brand-andaman underline" href="/app/admin/people">Open People & access</Link></Section>
    <Section id="step-10" title="10. Review and publish"><Readiness report={initialReadiness}/><Button disabled={busy || !initialReadiness.readyForActivation || initialProject.status === 'live'} onClick={() => submit(`/api/admin/projects/${initialProject.id}`, { status: 'live' }, 'PUT')}>{initialProject.status === 'live' ? 'Property is live' : 'Publish property'}</Button></Section>
  </main>;
}


function OfferingForm({units,submit}:{units:Unit[];submit:(url:string,body:object,method?:string)=>Promise<any>}) {
  return <form className="grid gap-8 md:grid-cols-3" onSubmit={async e=>{
    e.preventDefault();const d=new FormData(e.currentTarget);const unit=String(d.get('unit')||'');
    if(!unit)return;
    await submit(unitPropertyDetailsPath(unit),{action:'commercial_offering',offeringType:d.get('type'),
      priceBaht:Number(d.get('priceBaht')),minimumStay:Number(d.get('minimumStay')||1),
      depositBaht:d.get('depositBaht'),utilitiesIncluded:d.get('utilitiesIncluded')==='yes',
      tenure:d.get('tenure'),notes:d.get('notes'),status:'draft'});
  }}>
    <label className="text-small">Home<select className={'block w-full '+input} name="unit" required><option value="">Select home</option>{units.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
    <label className="text-small">Offer<select className={'block w-full '+input} name="type" required><option value="short_stay">Short stay · nightly</option><option value="long_stay">Long stay · monthly</option><option value="sale">Sale · total price</option></select></label>
    <label className="text-small">Price (THB)<input className={'block w-full '+input} name="priceBaht" type="number" min="0.01" step="0.01" required/></label>
    <label className="text-small">Minimum nights / months<input className={'block w-full '+input} name="minimumStay" type="number" min="1" defaultValue="1"/></label>
    <label className="text-small">Refundable deposit (THB)<input className={'block w-full '+input} name="depositBaht" type="number" min="0" step="0.01"/></label>
    <label className="text-small">Utilities included<select className={'block w-full '+input} name="utilitiesIncluded"><option value="no">No / separate</option><option value="yes">Yes</option></select></label>
    <label className="text-small">Sale tenure<select className={'block w-full '+input} name="tenure"><option value="">Not specified</option><option value="freehold">Freehold</option><option value="leasehold">Leasehold</option></select></label>
    <label className="text-small md:col-span-2">Commercial terms<textarea className="mt-4 w-full rounded-sm border border-border-line p-8" name="notes" rows={2}/></label>
    <div className="md:col-span-3"><Button disabled={false}>Save offer as draft</Button></div>
  </form>;
}
function PhysicalFactsForm({units,submit}:{units:Unit[];submit:(url:string,body:object,method?:string)=>Promise<any>}) {
  return <form className="my-16 grid gap-8 md:grid-cols-4" onSubmit={async e=>{
    e.preventDefault();const d=new FormData(e.currentTarget);const unit=String(d.get('unit')||'');if(!unit)return;
    const facts=Object.fromEntries(['floor','usableAreaSqm','grossAreaSqm','outdoorAreaSqm','plotAreaSqm','balconyAreaSqm','furnishingStatus','privacyType','accommodationType'].map(key=>[key,d.get(key)]));
    await submit(unitPropertyDetailsPath(unit),{action:'physical_facts',...facts,
      unitFeatures:String(d.get('features')||'').split(',').map(x=>x.trim()).filter(Boolean),
      views:String(d.get('views')||'').split(',').map(x=>x.trim()).filter(Boolean)});
  }}>
    <label className="text-small">Home<select className={'block w-full '+input} name="unit" required><option value="">Select home</option>{units.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
    <label className="text-small">Floor<input className={'block w-full '+input} name="floor" placeholder="e.g. 7 / ground"/></label>
    {(['usableAreaSqm','grossAreaSqm','outdoorAreaSqm','plotAreaSqm','balconyAreaSqm'] as const).map(key=><label key={key} className="text-small">{key.replace('Sqm',' (m²)')}<input className={'block w-full '+input} name={key} type="number" min="0" step="0.01"/></label>)}
    <label className="text-small">Furnishing<select className={'block w-full '+input} name="furnishingStatus"><option value="">Not recorded</option><option value="fully_furnished">Fully furnished</option><option value="part_furnished">Partly furnished</option><option value="unfurnished">Unfurnished</option></select></label>
    <label className="text-small">Privacy<select className={'block w-full '+input} name="privacyType"><option value="entire_place">Entire home</option><option value="private_room">Private room</option></select></label>
    <label className="text-small">Type<input className={'block w-full '+input} name="accommodationType" placeholder="e.g. pool villa"/></label>
    <label className="text-small md:col-span-2">Features, comma-separated<input className={'block w-full '+input} name="features" placeholder="private pool, parking, Wi-Fi"/></label>
    <label className="text-small md:col-span-2">Views, comma-separated<input className={'block w-full '+input} name="views" placeholder="garden, pool, sea"/></label>
    <div className="md:col-span-4"><Button>Save physical details</Button></div>
  </form>;
}
function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) { return <section id={id} className="scroll-mt-24 mb-20 rounded-lg border border-border-line bg-surface-paper p-20"><h2 className="font-display text-heading-lg font-semibold mb-12">{title}</h2>{children}</section>; }
function UnitLinks({ units, label }: { units: Unit[]; label: string }) { return <ul className="mt-12 space-y-8">{units.map(u => <li key={u.id}><Link className="text-brand-andaman underline" href={`/app/admin/units/${u.id}`}>{label}: {u.name}</Link></li>)}</ul>; }
function OwnerInvite({ units, submit }: { units: Unit[]; submit: (url: string, body: object, method?: string) => Promise<any> }) { return <form className="flex flex-wrap gap-8" onSubmit={async e => { e.preventDefault(); const d = new FormData(e.currentTarget); const invite = await submit('/api/admin/people/invite', { email: d.get('email'), firstName: d.get('firstName'), lastName: d.get('lastName'), preferredLocale: 'en' }); if (invite) await submit(`/api/admin/units/${d.get('unit')}/owner`, { ownerIdentityId: invite.identity.id }, 'PUT'); }}><select className={input} name="unit" required><option value="">Unit</option>{units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select><input className={input} name="firstName" placeholder="First name" required/><input className={input} name="lastName" placeholder="Last name" required/><input className={input} name="email" type="email" placeholder="Owner email" required/><Button>Invite and assign owner</Button></form>; }
function ChannelForm({ units, submit }: { units: Unit[]; submit: (url: string, body: object, method?: string) => Promise<any> }) { return <form className="flex flex-wrap gap-8" onSubmit={async e => { e.preventDefault(); const d = new FormData(e.currentTarget); await submit(unitPropertyDetailsPath(String(d.get('unit') || '')), { action: 'channel_mapping', channel: d.get('channel'), externalListingId: d.get('listing'), syncState: d.get('sync') }); }}><select className={input} name="unit" required><option value="">Unit</option>{units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select><input className={input} name="channel" placeholder="Channel" required/><input className={input} name="listing" placeholder="Listing ID"/><select className={input} name="sync"><option value="ical_only">iCal only</option><option value="manual">Manual</option></select><Button>Save mapping</Button></form>; }
function SleepingForm({ units, submit }: { units: Unit[]; submit: (url: string, body: object, method?: string) => Promise<any> }) { return <form className="flex flex-wrap gap-8 my-12" onSubmit={async e => { e.preventDefault(); const d = new FormData(e.currentTarget); await submit(unitPropertyDetailsPath(String(d.get('unit') || '')), { action: 'sleeping_space', spaceType: d.get('spaceType'), name: d.get('name'), beds: [{ bedType: d.get('bedType'), count: Number(d.get('count')) }] }); }}><select className={input} name="unit" required><option value="">Unit</option>{units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select><select className={input} name="spaceType"><option value="bedroom">Bedroom</option><option value="living_room">Living room</option></select><input className={input} name="name" placeholder="Room name"/><select className={input} name="bedType"><option value="king">King bed</option><option value="queen">Queen bed</option><option value="single">Single bed</option><option value="sofa_bed">Sofa bed</option></select><input className={input} name="count" type="number" min="1" defaultValue="1"/><Button>Save sleeping space</Button></form>; }
function GalleryUpload({ projectId, units }: { projectId: string; units: Unit[] }) { const router = useRouter(); const [target, setTarget] = useState('project'); const [uploading, setUploading] = useState(false); return <form className="flex flex-wrap gap-8 my-12" onSubmit={async e => { e.preventDefault(); const data = new FormData(e.currentTarget); setUploading(true); const uploaded = await fetch('/api/media/upload', { method: 'POST', body: data }); const asset = await uploaded.json(); if (uploaded.ok) await fetch(target === 'project' ? `/api/admin/projects/${projectId}/media` : `/api/admin/units/${target}/media`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mediaAssetId: asset.mediaAssetId, cover: true }) }); setUploading(false); router.refresh(); }}><select className={input} value={target} onChange={e => setTarget(e.target.value)}><option value="project">Project gallery</option>{units.map(u => <option key={u.id} value={u.id}>{u.name} gallery</option>)}</select><input className={input} name="file" type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml" required/><Button disabled={uploading}>{uploading ? 'Uploading…' : 'Upload and set cover'}</Button></form>; }
function Readiness({ report }: { report: PropertyReadinessReport }) { return <div className="mb-16"><p className="mb-8"><strong>{report.blockers.length}</strong> blockers · <strong>{report.warnings.length}</strong> warnings</p><ul className="space-y-6">{[...report.blockers, ...report.warnings].map(item => <li key={`${item.key}-${item.unitId || ''}`} className={item.severity === 'blocker' ? 'text-state-error' : 'text-state-warning'}>{item.severity === 'blocker' ? 'Blocker' : 'Warning'}: {item.unitName ? `${item.unitName} — ` : ''}{item.message}</li>)}</ul></div>; }
