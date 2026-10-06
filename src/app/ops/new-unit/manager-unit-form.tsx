'use client';
/* eslint-disable local-rules/no-literal-ui-text */

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Project = { id: string; name: string; categories: { id: string; name: string; bedrooms: number; bathrooms: number; maxGuests: number; baseNightlyThb: number }[] };

export default function ManagerUnitForm({ projects }: { projects: Project[] }) {
  const router = useRouter();
  const [projectId, setProjectId] = useState(projects[0]?.id || '');
  const [categoryId, setCategoryId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const project = projects.find((item) => item.id === projectId);
  const category = project?.categories.find((item) => item.id === categoryId);
  const field = 'mt-4 block w-full rounded-md border border-border-line bg-surface-paper px-12 py-12 text-text-ink';
  return <form className="mt-24 grid gap-16 stitch-panel p-24 md:grid-cols-2" onSubmit={async (event) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const data = new FormData(event.currentTarget);
      const payload = {
        projectId, inventoryCategoryId: categoryId || undefined,
        name: String(data.get('name') || '').trim(),
        unitType: data.get('unitType'), addressSupplement: String(data.get('addressSupplement') || ''),
        floor: String(data.get('floor') || ''),
        bedrooms: Number(data.get('bedrooms')), bathrooms: Number(data.get('bathrooms')),
        maxGuests: Number(data.get('maxGuests')), sizeSqm: Number(data.get('sizeSqm')) || undefined,
        baseNightlyThb: category?.baseNightlyThb ?? Math.round(Number(data.get('nightlyBaht')) * 100),
        instantBook: false,
      };
      if (!payload.name || !payload.addressSupplement || !Number.isFinite(payload.baseNightlyThb) || payload.baseNightlyThb < 0 || payload.bedrooms < 0 || payload.bathrooms < 0 || payload.maxGuests < 1) throw new Error('Complete the required property facts.');
      const response = await fetch('/api/admin/units', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not create property');
      router.push(`/ops/calendar/${result.id}`);
      router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to save'); setBusy(false); }
  }}>
    {error && <p className="md:col-span-2 text-state-error" role="alert">{error}</p>}
    <label className="text-small">Complex / project<select required className={field} value={projectId} onChange={(e) => { setProjectId(e.target.value); setCategoryId(''); }}>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    <label className="text-small">Category<select className={field} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}><option value="">Individual unit / no category yet</option>{project?.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    <label className="text-small">Unit name / number<input required className={field} name="name" placeholder="F705 or Villa G6-01"/></label>
    <label className="text-small">Type<select className={field} name="unitType"><option value="condo">Condominium / apartment / hotel room</option><option value="villa">Villa</option><option value="townhouse">Townhouse</option></select></label>
    <label className="text-small">Location within project<input required className={field} name="addressSupplement" placeholder="Building F, floor 7"/></label>
    <label className="text-small">Floor<input className={field} name="floor"/></label>
    <label className="text-small">Bedrooms<input required className={field} type="number" min="0" name="bedrooms" defaultValue={category?.bedrooms ?? 1} key={categoryId + '-bed'}/></label>
    <label className="text-small">Bathrooms<input required className={field} type="number" min="0" name="bathrooms" defaultValue={category?.bathrooms ?? 1} key={categoryId + '-bath'}/></label>
    <label className="text-small">Max guests<input required className={field} type="number" min="1" name="maxGuests" defaultValue={category?.maxGuests ?? 2} key={categoryId + '-guests'}/></label>
    <label className="text-small">Size, sqm<input type="number" min="0" className={field} name="sizeSqm"/></label>
    {!category && <label className="text-small">Indicative nightly price (THB)<input required type="number" min="0" step="0.01" name="nightlyBaht" className={field} defaultValue="0"/></label>}
    <div className="md:col-span-2"><p className="mb-12 text-small text-text-secondary">Created as draft. Owner mandate, media, offering, compliance and commercial approval follow canonical onboarding before publication.</p><button type="submit" disabled={busy || !projectId} className="rounded-md bg-brand-deep px-24 py-12 font-semibold text-white disabled:opacity-50">{busy ? 'Creating…' : 'Create draft unit'}</button></div>
  </form>;
}
