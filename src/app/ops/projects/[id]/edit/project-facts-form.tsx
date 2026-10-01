'use client';
/* eslint-disable local-rules/no-literal-ui-text */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
type Project = { id: string; name: string; brand: string | null; address: string; city: string | null; district: string | null; projectType: string | null; totalUnits: number | null; facilities: string[]; status: string };
export default function ProjectFactsForm({ project }: { project: Project }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const field = 'mt-4 block w-full rounded-md border border-border-line bg-surface-paper px-12 py-12';
  return <form className="mt-24 grid gap-16 rounded-lg border border-border-line bg-surface-paper p-24 md:grid-cols-2" onSubmit={async (event) => {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      const data = new FormData(event.currentTarget);
      const response = await fetch(`/api/ops/projects/${project.id}/facts`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        name: String(data.get('name') || '').trim(), brand: String(data.get('brand') || '').trim() || null,
        address: String(data.get('address') || '').trim(), city: String(data.get('city') || '').trim() || null,
        district: String(data.get('district') || '').trim() || null,
        projectType: String(data.get('projectType') || '').trim() || null,
        totalUnits: data.get('totalUnits') ? Number(data.get('totalUnits')) : null,
        facilities: String(data.get('facilities') || '').split('\n').map((v) => v.trim()).filter(Boolean),
      }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Save failed');
      setMessage('Saved to canonical project.'); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Save failed'); }
    finally { setBusy(false); }
  }}>
    <label className="text-small">Project name<input required className={field} name="name" defaultValue={project.name}/></label>
    <label className="text-small">Brand<input className={field} name="brand" defaultValue={project.brand || ''}/></label>
    <label className="text-small md:col-span-2">Address<input required className={field} name="address" defaultValue={project.address}/></label>
    <label className="text-small">City<input className={field} name="city" defaultValue={project.city || ''}/></label>
    <label className="text-small">District<input className={field} name="district" defaultValue={project.district || ''}/></label>
    <label className="text-small">Project type<input className={field} name="projectType" defaultValue={project.projectType || ''}/></label>
    <label className="text-small">Total units<input type="number" min="0" className={field} name="totalUnits" defaultValue={project.totalUnits ?? ''}/></label>
    <label className="text-small md:col-span-2">Facilities (one per line)<textarea className={field} rows={5} name="facilities" defaultValue={project.facilities.join('\n')}/></label>
    <div className="md:col-span-2"><p className="mb-12 text-small text-text-secondary">Project facts are shared by all units. Publication, ownership and commercial approval remain separate guarded workflows.</p><button disabled={busy} className="rounded-md bg-brand-deep px-24 py-12 font-semibold text-white">{busy ? 'Saving…' : 'Save project facts'}</button>{message && <p role="status" className="mt-8 text-small">{message}</p>}</div>
  </form>;
}
