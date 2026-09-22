'use client';
/* eslint-disable local-rules/no-literal-ui-text */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/Button';

export default function NewPropertyClient({ areas }: { areas: Array<{ id: string; slug: string }> }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const field = 'block h-40 w-full mt-4 rounded-sm border border-border-line px-12 bg-surface-paper';

  return <main className="max-w-5xl">
    <p className="text-kicker text-brand-andaman mb-8">Property onboarding · 1/10</p>
    <h1 className="font-display text-display-xl font-semibold mb-8">Add a property</h1>
    <p className="text-body text-text-secondary mb-24">Create the property shell, then continue through inventory, ownership, compliance, pricing, content, channels, team and final review.</p>
    {error ? <p role="alert" className="p-12 mb-16 bg-state-error-soft text-state-error rounded-md">{error}</p> : null}
    <form className="grid grid-cols-1 md:grid-cols-3 gap-16 bg-surface-paper border border-border-line rounded-lg p-24" onSubmit={async (event) => {
      event.preventDefault(); const data = new FormData(event.currentTarget); const plusCode = String(data.get('plusCode') || '').trim();
      setBusy(true); setError(null);
      try {
        if (!plusCode && (!String(data.get('latitude') || '').trim() || !String(data.get('longitude') || '').trim())) throw new Error('Enter a Plus Code or both coordinates.');
        const response = await fetch('/api/admin/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
          slug: data.get('slug'), name: data.get('name'), brand: data.get('brand') || undefined, address: data.get('address'), areaId: data.get('areaId'),
          projectType: data.get('projectType'), country: data.get('country') || 'TH', city: data.get('city') || undefined, district: data.get('district') || undefined,
          plusCode: plusCode || undefined, ...(!plusCode ? { latitude: Number(data.get('latitude')), longitude: Number(data.get('longitude')) } : {}),
          areaLabelKey: `project.${data.get('slug')}.area`, descriptionKey: `project.${data.get('slug')}.description`, handbookKey: `project.${data.get('slug')}.handbook`, status: 'draft',
        }) });
        const payload = await response.json(); if (!response.ok) throw new Error(payload.error || 'Could not create property.');
        router.push(`/app/admin/properties/${payload.id}/onboarding`);
      } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not create property.'); setBusy(false); }
    }}>
      <TextField label="Property name" name="name" field={field} required />
      <TextField label="URL slug" name="slug" field={field} required />
      <TextField label="Brand" name="brand" field={field} />
      <label className="text-small text-text-secondary">Property type<select name="projectType" className={field}><option value="resort">Resort</option><option value="condominium">Condominium</option><option value="villa_estate">Villa estate</option><option value="standalone">Standalone</option></select></label>
      <label className="text-small text-text-secondary">Canonical area<select name="areaId" required defaultValue="" className={field}><option value="" disabled>Select area</option>{areas.map((area) => <option key={area.id} value={area.id}>{area.slug}</option>)}</select></label>
      <TextField label="Full address" name="address" field={field} required />
      <TextField label="Country" name="country" field={field} defaultValue="TH" required />
      <TextField label="City" name="city" field={field} />
      <TextField label="District" name="district" field={field} />
      <TextField label="Plus Code" name="plusCode" field={field} placeholder="Preferred" />
      <TextField label="Latitude (without Plus Code)" name="latitude" field={field} type="number" step="any" />
      <TextField label="Longitude (without Plus Code)" name="longitude" field={field} type="number" step="any" />
      <div className="md:col-span-3"><Button type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create and continue'}</Button></div>
    </form>
  </main>;
}

function TextField({ label, field, ...props }: { label: string; field: string; name: string; [key: string]: unknown }) {
  return <label className="text-small text-text-secondary">{label}<input className={field} {...props} /></label>;
}
