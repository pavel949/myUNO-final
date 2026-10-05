'use client';
/* eslint-disable local-rules/no-literal-ui-text */

import { FormEvent, createContext, useContext, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/Button';
import ScopedGalleryEditor from '@/components/property/ScopedGalleryEditor';
import type { PropertyReadinessReport } from '@/modules/projects';

type Category = { id: string; name: string; categoryKey: string; baseNightlyThb: number; minNights: number; status: string; ratePlans: Array<{ id: string; code: string; name: string; minNights: number | null }> };
type Unit = { id: string; name: string; ownerIdentityId: string | null; inventoryCategory?: Category | null; media: unknown[]; sleepingSpaces: Array<{ beds: unknown[] }>; commercialOfferings: Array<{ offeringType: string; status: string; channelMappings: Array<{ channel: string; syncState: string }> }> };
type Project = { id: string; name: string; status: string; coverMediaId: string | null; galleryMedia: unknown[]; inventoryCategories: Category[]; ratePlans: Array<{ id: string; name: string; code: string }>; structureNodes: Array<{ id: string; name: string; kind: string }>; units: Unit[] };

const StepContext = createContext(1);
const steps = ['Project', 'Categories & homes', 'Owner & contract', 'Compliance', 'Stay offering', 'Pricing', 'Content & photos', 'Availability & channels', 'Team', 'Review & publish'];
const input = 'h-40 rounded-sm border border-border-line bg-surface-paper px-12';
function unitPropertyDetailsPath(unitId: string) { return `/api/admin/units/${unitId}/property-details`; }

export default function PropertyOnboardingClient({ initialProject, initialReadiness, initialGallery, galleryLabels }: { initialProject: Project; initialReadiness: PropertyReadinessReport; initialGallery?: string; galleryLabels: Record<string,string> }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [activeStep, setActiveStep] = useState(1);
  const submit = async (url: string, body: object, method = 'POST') => {
    if (busy) return null;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload) {
        throw new Error(payload?.error || 'Could not save. Please try again.');
      }
      setMessage('Saved. Readiness report refreshed.');
      router.refresh();
      return payload;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save. Please try again.');
      return null;
    } finally {
      setBusy(false);
    }
  };
  const form = (handler: (data: FormData) => Promise<void>) => async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); await handler(new FormData(event.currentTarget)); };

  return <StepContext.Provider value={activeStep}><main className="max-w-6xl pb-48">
    <div className="flex flex-wrap items-start justify-between gap-16 mb-24"><div><p className="text-kicker text-brand-andaman">Set up your property</p><h1 className="font-display text-display-xl font-semibold">{initialProject.name}</h1></div><span className={`rounded-full px-12 py-8 text-small ${initialReadiness.readyForActivation ? 'bg-state-success-soft text-state-success' : 'bg-state-warning-soft text-state-warning'}`}>{initialReadiness.score}% ready</span></div>
    <nav aria-label="Onboarding progress" className="flex gap-8 overflow-x-auto mb-24">{steps.map((step, index) => <button key={step} type="button" onClick={() => setActiveStep(index + 1)} aria-current={activeStep === index + 1 ? 'step' : undefined} className={`shrink-0 rounded-full border px-12 py-8 text-small ${activeStep === index + 1 ? 'border-brand-andaman bg-brand-andaman text-white' : 'border-border-line'}`}>{index + 1}. {step}</button>)}</nav>
    <div className="mb-24 h-8 overflow-hidden rounded-full bg-surface-muted"><div className="h-full bg-brand-andaman transition-all" style={{width: `${activeStep / steps.length * 100}%`}} /></div>
    <p className="mb-20 text-small text-text-secondary">Step {activeStep} of {steps.length}. Complete this step, then continue. Your changes are saved to the existing property record.</p>
    {message ? <p role="status" className="mb-16 rounded-md bg-surface-muted p-12">{message}</p> : null}

    <Section id="step-1" title="1. Project and area"><p>Canonical area and location are set on the project record. Use Project 360 for detailed physical facts.</p><div className="mt-12 flex gap-12"><Link className="text-brand-andaman underline" href={`/app/admin/projects/${initialProject.id}`}>Open Project 360</Link><Link className="text-brand-andaman underline" href="/app/admin/areas">Manage areas</Link><Link className="text-brand-andaman underline" href={'/app/admin/projects/'+initialProject.id+'/structure'}>Buildings, wings & floors</Link></div></Section>

    <Section id="step-2" title="2. Categories and homes">
      <form className="grid gap-8 md:grid-cols-4" onSubmit={form(async d => {
        await submit(`/api/admin/projects/${initialProject.id}/catalog`, {
          action: 'category',
          categoryKey: d.get('key'),
          name: d.get('name'),
          bedrooms: Number(d.get('bedrooms')),
          bathrooms: Number(d.get('bathrooms')),
          maxGuests: Number(d.get('guests')),
          // Category input is in BAHT. The API converts it to SATANG once.
          baseNightlyThb: String(d.get('rate') || ''),
          minNights: Number(d.get('minNights')),
        });
      })}>
        <label className="text-small">Category key<input className={input + ' block w-full'} name="key" placeholder="e.g. superior_2br" required pattern="[a-z0-9][a-z0-9_-]*" /></label>
        <label className="text-small">Category name<input className={input + ' block w-full'} name="name" placeholder="e.g. Superior 2BR" required /></label>
        <label className="text-small">Bedrooms<input className={input + ' block w-full'} name="bedrooms" type="number" min="0" defaultValue="2" required /></label>
        <label className="text-small">Bathrooms<input className={input + ' block w-full'} name="bathrooms" type="number" min="0" defaultValue="2" required /></label>
        <label className="text-small">Maximum guests<input className={input + ' block w-full'} name="guests" type="number" min="1" defaultValue="4" required /></label>
        <label className="text-small">Base nightly rate (THB)<input className={input + ' block w-full'} name="rate" type="number" min="0.01" step="0.01" placeholder="e.g. 3500" required /></label>
        <label className="text-small">Minimum nights<input className={input + ' block w-full'} name="minNights" type="number" min="1" defaultValue="1" required /></label>
        <div className="flex items-end"><Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save category'}</Button></div>
      </form>
      <div className="mt-12 text-small text-text-secondary">
        {initialProject.inventoryCategories.length
          ? initialProject.inventoryCategories.map(c => <p key={c.id}>{c.name} ({c.categoryKey}) · ฿{(c.baseNightlyThb / 100).toLocaleString('en-US')}/night · {c.minNights} night minimum · {c.status}</p>)
          : <p>No categories yet.</p>}
      </div>
      <form className="grid md:grid-cols-6 gap-8 mt-20" onSubmit={form(async d => { await submit('/api/admin/units', { projectId: initialProject.id, inventoryCategoryId: d.get('category'), structureNodeId: d.get('structureNode')||null, name: d.get('name'), unitType: d.get('unitType'), bedrooms: Number(d.get('bedrooms')), bathrooms: Number(d.get('bathrooms')), maxGuests: Number(d.get('maxGuests')), addressSupplement: String(d.get('name')), descriptionKey: `unit.${String(d.get('name')).toLowerCase().replace(/ /g, '_')}.description`, baseNightlyThb: 0, status: 'draft' }); })}><input className={input} name="name" placeholder="Home name / number" required/><select className={input} name="category" required><option value="">Select category</option>{initialProject.inventoryCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><select className={input} name="unitType" defaultValue="villa"><option value="villa">Villa</option><option value="condo">Condo</option><option value="townhouse">Townhouse</option></select><select className={input} name="structureNode"><option value="">Location not assigned</option>{(initialProject.structureNodes ?? []).map(node => <option key={node.id} value={node.id}>{node.kind} · {node.name}</option>)}</select><input className={input} name="bedrooms" type="number" min="0" placeholder="Bedrooms" required/><input className={input} name="bathrooms" type="number" min="0" step="1" placeholder="Bathrooms" required/><input className={input} name="maxGuests" type="number" min="1" placeholder="Max guests" required/><Button type="submit" disabled={busy}>Add home</Button></form>
    </Section>

    <Section id="step-3" title="3. Owner, invitation and contract"><OwnerInvite units={initialProject.units} submit={submit}/><UnitLinks units={initialProject.units} label="Open owner and contract workspace"/></Section>
    <Section id="step-4" title="4. Compliance, mobilization and sleeping arrangements"><p>Permitted-use evidence, all seven mobilization steps and a bed-level sleeping layout are activation blockers.</p><SleepingForm units={initialProject.units} submit={submit}/><UnitLinks units={initialProject.units} label="Complete compliance checklist"/></Section>
    <Section id="step-5" title="5. Stay offering"><p className="mb-12">Enable a short-stay commercial offering for each home. The physical home is not the commercial offering; keep its facts on Project / Category / Unit.</p><StayOfferingForm units={initialProject.units} submit={submit}/></Section>
    <Section id="step-6" title="6. Pricing and rate plans">
      <p className="rounded-md bg-surface-muted p-12 mb-16">The category base nightly rate is the master amount. BAR is the canonical rate plan; a unit-level dated rule is an explicit exception.</p>
      <form className="flex flex-wrap items-end gap-8" onSubmit={form(async d => {
        await submit(`/api/admin/projects/${initialProject.id}/catalog`, {
          action: 'rate_plan', categoryId: d.get('category'),
          code: 'BAR', name: d.get('name'), isMaster: true,
          minNights: d.get('minNights') || null,
        });
      })}>
        <label className="text-small">Inventory category<select className={input + ' block'} name="category" required><option value="">Select category</option>{initialProject.inventoryCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label className="text-small">Plan name<input className={input + ' block'} name="name" defaultValue="Best Available Rate" required /></label>
        <label className="text-small">Minimum nights override (optional)<input className={input + ' block'} name="minNights" type="number" min="1" placeholder="Inherit category" /></label>
        <span className="text-small font-semibold">BAR</span>
        <Button type="submit" disabled={busy}>Save BAR</Button>
      </form>
      <div className="mt-12 text-small text-text-secondary">
        {initialProject.inventoryCategories.map(c => <p key={c.id}>{c.name}: {c.ratePlans.filter(plan => plan.code === 'BAR').map(plan => `${plan.name} · ${plan.minNights ?? c.minNights} night minimum`).join(' · ') || 'BAR not configured'}</p>)}
      </div>
    </Section>
    <Section id="step-7" title="7. Content and galleries"><p>Project and unit media support ordered galleries and an explicit cover. Activation requires a project cover and at least three unit photos.</p><ScopedGalleryEditor projectId={initialProject.id} projectName={initialProject.name} categories={initialProject.inventoryCategories} units={initialProject.units} initialSelection={initialGallery} labels={galleryLabels}/><UnitLinks units={initialProject.units} label="Open unit gallery"/></Section>
    <Section id="step-8" title="8. Availability and channels"><p className="mb-12">Availability is derived from Booking, active holds, BlockedDate and approved external blocks. This screen configures inputs to that engine; it never maintains a second availability truth.</p><div className="rounded-md bg-state-warning-soft p-12 mb-16"><strong>Manual-risk warning:</strong> iCal and manual mappings do not push ARI. After every direct booking, close inventory in the OTA extranets until an ARI-capable connection reports <code>ari_push</code>.</div><ChannelForm units={initialProject.units} submit={submit}/></Section>
    <Section id="step-9" title="9. Team"><p>Invite people from the owner form above, then grant project or unit roles in People & access.</p><Link className="text-brand-andaman underline" href="/app/admin/people">Open People & access</Link></Section>
    <Section id="step-10" title="10. Review and publish"><Readiness report={initialReadiness}/><Button disabled={busy || !initialReadiness.readyForActivation || initialProject.status === 'live'} onClick={() => submit(`/api/admin/projects/${initialProject.id}`, { status: 'live' }, 'PUT')}>{initialProject.status === 'live' ? 'Property is live' : 'Publish property'}</Button></Section>
    <div className="mt-20 flex items-center justify-between gap-12"><Button type="button" variant="secondary" disabled={activeStep === 1} onClick={() => setActiveStep(v => Math.max(1, v - 1))}>Back</Button><Button type="button" disabled={activeStep === steps.length} onClick={() => { setActiveStep(v => Math.min(steps.length, v + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Continue →</Button></div>
  </main></StepContext.Provider>;
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) { const activeStep = useContext(StepContext); const visible = Number(id.replace('step-', '')) === activeStep; return <section id={id} hidden={!visible} className="scroll-mt-24 mb-20 rounded-lg border border-border-line bg-surface-paper p-20"><h2 className="font-display text-heading-lg font-semibold mb-12">{title}</h2>{children}</section>; }
function UnitLinks({ units, label }: { units: Unit[]; label: string }) { return <ul className="mt-12 space-y-8">{units.map(u => <li key={u.id}><Link className="text-brand-andaman underline" href={`/app/admin/units/${u.id}`}>{label}: {u.name}</Link> · <Link className="text-brand-andaman underline" href={'/app/admin/units/'+u.id+'/structure'}>Building / floor</Link></li>)}</ul>; }
function OwnerInvite({ units, submit }: { units: Unit[]; submit: (url: string, body: object, method?: string) => Promise<any> }) { return <form className="flex flex-wrap gap-8" onSubmit={async e => { e.preventDefault(); const d = new FormData(e.currentTarget); const invite = await submit('/api/admin/people/invite', { email: d.get('email'), firstName: d.get('firstName'), lastName: d.get('lastName'), preferredLocale: 'en' }); if (invite) await submit(`/api/admin/units/${d.get('unit')}/owner`, { ownerIdentityId: invite.identity.id }, 'PUT'); }}><select className={input} name="unit" required><option value="">Unit</option>{units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select><input className={input} name="firstName" placeholder="First name" required/><input className={input} name="lastName" placeholder="Last name" required/><input className={input} name="email" type="email" placeholder="Owner email" required/><Button>Invite and assign owner</Button></form>; }
function StayOfferingForm({ units, submit }: { units: Unit[]; submit: (url: string, body: object, method?: string) => Promise<any> }) {
  return <div className="space-y-12">
    {units.map(unit => {
      const offering = unit.commercialOfferings.find(row => row.offeringType === 'short_term_stay' || row.offeringType === 'short_stay');
      return <div key={unit.id} className="flex flex-wrap items-center gap-12 rounded-md border border-border-line p-12">
        <span className="flex-1 text-body font-semibold">{unit.name}</span>
        <span className="text-small">{offering?.status === 'active' ? 'Short stay active' : 'Short stay not active'}</span>
        <Button type="button" disabled={Boolean(offering?.status === 'active')} onClick={() =>
          submit(unitPropertyDetailsPath(unit.id), { action: 'stay_offering', status: 'active' })
        }>Enable short stay</Button>
        {(['sale', 'long_term_rental'] as const).map(offeringType => {
          const current = unit.commercialOfferings.find(row => row.offeringType === offeringType);
          const active = current?.status === 'active';
          return <Button key={offeringType} type="button" variant="secondary" onClick={() =>
            submit(unitPropertyDetailsPath(unit.id), { action: 'commercial_offering', offeringType, status: active ? 'paused' : 'active' })
          }>{offeringType === 'sale' ? (active ? 'Pause sale' : 'Offer for sale') : (active ? 'Pause long-term rent' : 'Offer long-term rent')}</Button>;
        })}
      </div>;
    })}
    {units.length === 0 && <p className="text-small text-text-secondary">Create a home first.</p>}
  </div>;
}
function ChannelForm({ units, submit }: { units: Unit[]; submit: (url: string, body: object, method?: string) => Promise<any> }) { return <form className="flex flex-wrap gap-8" onSubmit={async e => { e.preventDefault(); const d = new FormData(e.currentTarget); await submit(unitPropertyDetailsPath(String(d.get('unit') || '')), { action: 'channel_mapping', channel: d.get('channel'), externalListingId: d.get('listing'), syncState: d.get('sync') }); }}><select className={input} name="unit" required><option value="">Unit</option>{units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select><input className={input} name="channel" placeholder="Channel" required/><input className={input} name="listing" placeholder="Listing ID"/><select className={input} name="sync"><option value="ical_only">iCal only</option><option value="manual">Manual</option></select><Button>Save mapping</Button></form>; }
function SleepingForm({ units, submit }: { units: Unit[]; submit: (url: string, body: object, method?: string) => Promise<any> }) { return <form className="flex flex-wrap gap-8 my-12" onSubmit={async e => { e.preventDefault(); const d = new FormData(e.currentTarget); await submit(unitPropertyDetailsPath(String(d.get('unit') || '')), { action: 'sleeping_space', spaceType: d.get('spaceType'), name: d.get('name'), beds: [{ bedType: d.get('bedType'), count: Number(d.get('count')) }] }); }}><select className={input} name="unit" required><option value="">Unit</option>{units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select><select className={input} name="spaceType"><option value="bedroom">Bedroom</option><option value="living_room">Living room</option></select><input className={input} name="name" placeholder="Room name"/><select className={input} name="bedType"><option value="king">King bed</option><option value="queen">Queen bed</option><option value="single">Single bed</option><option value="sofa_bed">Sofa bed</option></select><input className={input} name="count" type="number" min="1" defaultValue="1"/><Button>Save sleeping space</Button></form>; }
function Readiness({ report }: { report: PropertyReadinessReport }) { return <div className="mb-16"><p className="mb-8"><strong>{report.blockers.length}</strong> blockers · <strong>{report.warnings.length}</strong> warnings</p><ul className="space-y-8">{[...report.blockers, ...report.warnings].map(item => <li key={`${item.key}-${item.unitId || ''}`} className={item.severity === 'blocker' ? 'text-state-error' : 'text-state-warning'}>{item.severity === 'blocker' ? 'Blocker' : 'Warning'}: {item.unitName ? `${item.unitName} — ` : ''}{item.message}</li>)}</ul></div>; }
