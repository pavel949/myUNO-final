'use client';
/* eslint-disable local-rules/no-literal-ui-text */
import { useState } from 'react';
import Link from 'next/link';

export default function ConvertPropertySubmission({
  id, status, existingProjectId, projects, organizations, areas, proposedAddress, proposedAreaId, proposedLatitude, proposedLongitude, applicantKind, operatingModel, requestedManagementCompanyName, canonicalProjectId, canonicalUnitId,
}: {
  id: string; status: string; existingProjectId: string | null;
  projects: { id: string; name: string }[];
  organizations: { id: string; name: string; projectId: string | null }[];
  applicantKind: string;
  operatingModel: string | null;
  requestedManagementCompanyName: string;
  areas: { id: string; slug: string }[];
  proposedAddress: string; proposedAreaId: string | null;
  proposedLatitude: number | null; proposedLongitude: number | null;
  canonicalProjectId?: string | null; canonicalUnitId?: string | null;
}) {
  const [projectId, setProjectId] = useState(existingProjectId || '');
  const [organizationId, setOrganizationId] = useState('');
  const [address, setAddress] = useState(proposedAddress);
  const [areaId, setAreaId] = useState(proposedAreaId || '');
  const [latitude, setLatitude] = useState(proposedLatitude == null ? '' : String(proposedLatitude));
  const [longitude, setLongitude] = useState(proposedLongitude == null ? '' : String(proposedLongitude));
  const [authority, setAuthority] = useState(false);
  const [duplicates, setDuplicates] = useState(false);
  const [media, setMedia] = useState(false);
  const [owner, setOwner] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ projectId: string; unitId: string | null } | null>(null);
  if (status === 'converted') return <div className="mt-12 rounded-lg bg-state-success-soft p-16"><p>Canonical draft created.</p>{canonicalProjectId && <Link className="text-brand-andaman underline" href={`/app/admin/properties/${canonicalProjectId}/onboarding`}>Continue project onboarding →</Link>}{canonicalUnitId && <Link className="ml-12 text-brand-andaman underline" href={`/app/admin/units/${canonicalUnitId}`}>Open home →</Link>}</div>;
  if (status !== 'submitted') return <p className="mt-12 text-small text-text-secondary">Awaiting applicant submission.</p>;
  if (result) return <div role="status" className="mt-12 rounded-lg bg-state-success-soft p-16"><p>Created canonical draft records. Existing activation checks still apply.</p><Link className="text-brand-andaman underline" href={`/app/admin/properties/${result.projectId}/onboarding`}>Complete project onboarding →</Link>{result.unitId && <Link className="ml-12 text-brand-andaman underline" href={`/app/admin/units/${result.unitId}`}>Complete home →</Link>}</div>;
  return <form className="mt-16 space-y-12 border-t border-border-line pt-16" onSubmit={async e => {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      const response = await fetch(`/api/admin/property-submissions/${id}/convert`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: projectId || null, verifiedAuthority: authority, checkedDuplicates: duplicates, checkedMedia: media, verifiedOwner: owner, organizationId: organizationId || null, projectAddress: address, areaId: areaId || null, latitude, longitude }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Conversion failed');
      setResult(data);
    } catch (e) { setError(e instanceof Error ? e.message : 'Conversion failed'); }
    finally { setBusy(false); }
  }}>
    <h3 className="font-semibold">Review and convert to canonical draft</h3>
    <label className="block text-small">Match this submission to an existing complex, or leave blank to create a new draft project.
      <select value={projectId} onChange={e => setProjectId(e.target.value)} className="mt-4 block w-full rounded-lg border border-border-line p-12">
        <option value="">Create a new complex from the submitted project details</option>
        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
    </label>
    {!projectId && <div className="space-y-12 rounded-lg border border-border-line p-16"><p className="font-semibold">New complex: verify location before creation</p><label className="block text-small">Full address<input className="mt-4 block w-full rounded-lg border border-border-line p-12" value={address} onChange={e => setAddress(e.target.value)} /></label><label className="block text-small">Canonical area<select className="mt-4 block w-full rounded-lg border border-border-line p-12" value={areaId} onChange={e => setAreaId(e.target.value)}><option value="">Select an area</option>{areas.map(a => <option key={a.id} value={a.id}>{a.slug}</option>)}</select></label><div className="grid grid-cols-2 gap-12"><label className="text-small">Latitude<input className="mt-4 block w-full rounded-lg border border-border-line p-12" type="number" step="any" value={latitude} onChange={e => setLatitude(e.target.value)}/></label><label className="text-small">Longitude<input className="mt-4 block w-full rounded-lg border border-border-line p-12" type="number" step="any" value={longitude} onChange={e => setLongitude(e.target.value)}/></label></div></div>}
        {(operatingModel === 'via_management_company' || applicantKind === 'management') && <label className="block text-small">Verified management company (requested: {requestedManagementCompanyName || 'not supplied'})<select className="mt-4 block w-full rounded-lg border border-border-line p-12" value={organizationId} onChange={e => setOrganizationId(e.target.value)}><option value="">No verified company yet — keep engagement uncreated</option>{organizations.filter(o => !o.projectId || o.projectId === projectId).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>}
        <label className="flex items-start gap-8 text-small"><input type="checkbox" checked={authority} onChange={e => setAuthority(e.target.checked)}/>I checked the applicant's identity, mandate or ownership evidence.</label>
    <label className="flex items-start gap-8 text-small"><input type="checkbox" checked={duplicates} onChange={e => setDuplicates(e.target.checked)}/>I checked project and unit duplicates and selected the correct canonical complex.</label>
    <label className="flex items-start gap-8 text-small"><input type="checkbox" checked={media} onChange={e => setMedia(e.target.checked)}/>I checked submitted project and unit photos are appropriate for their distinct scopes.</label>
    <label className="flex items-start gap-8 text-small"><input type="checkbox" checked={owner} onChange={e => setOwner(e.target.checked)}/>The applicant is independently verified as the unit owner; record their ownership history (leave unchecked for managers and representatives).</label>
    <p className="text-small text-text-secondary">Conversion creates draft records only. No booking, sale or rental is activated by this action.</p>
    {error && <p role="alert" className="text-state-error">{error}</p>}
    <button type="submit" disabled={busy || !authority || !duplicates || !media} className="rounded-lg bg-brand-andaman px-20 py-12 font-semibold text-white disabled:opacity-40">{busy ? 'Creating…' : 'Create canonical draft →'}</button>
  </form>;
}
