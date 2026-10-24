'use client';
import { OperationalText } from '@/components/ops/OperationalText';
/* eslint-disable local-rules/no-literal-ui-text */
import { useEffect, useRef, useState } from 'react';
import { EMPLOYEE_CREATION_LABELS } from '@/modules/content/employee-creation.seed';
import Link from 'next/link';
import { LOCALES } from '@/modules/content/types';

export default function ConvertPropertySubmission({
  descriptionLocale, hasDescription, id, status, existingProjectId, projects, organizations, areas, proposedAddress, proposedAreaId, proposedLatitude, proposedLongitude, applicantKind, operatingModel, requestedManagementCompanyName, canonicalProjectId, canonicalUnitId, employeeCreation, creationLabels, employeeReviewOptions, employeeExistingUnitId,
}: {
  employeeCreation?: { kind: 'unit' | 'complex'; spaceId: string; organizationId: string; scopeProjectId: string | null; createdProjectId?: string | null; createdUnitId?: string | null } | null;
  employeeReviewOptions?: { units: { id: string; name: string; projectId: string }[]; projects: { id: string; name: string; address: string }[] } | null;
  employeeExistingUnitId?: string | null;
  creationLabels?: Record<string, string>;
  descriptionLocale: string | null; hasDescription: boolean;
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
  const sourceLocale = LOCALES.find(locale => locale === descriptionLocale);
  const [reviewLocale, setReviewLocale] = useState<string>(sourceLocale || '');
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
  if (employeeCreation) return <ConvertEmployeeCreation id={id} status={status} employeeCreation={employeeCreation} labels={creationLabels || {}} descriptionLocale={descriptionLocale} hasDescription={hasDescription} canonicalProjectId={canonicalProjectId} canonicalUnitId={canonicalUnitId} reviewOptions={employeeReviewOptions} initialExistingUnitId={employeeExistingUnitId} />;
  if (status === 'converted') return <div className="mt-12 rounded-lg bg-state-success-soft p-16"><p><OperationalText text={"Canonical draft created."} /></p>{canonicalProjectId && <Link className="text-brand-andaman underline" href={`/app/admin/properties/${canonicalProjectId}/onboarding`}><OperationalText text={"Continue project onboarding →"} /></Link>}{canonicalUnitId && <Link className="ml-12 text-brand-andaman underline" href={`/app/admin/units/${canonicalUnitId}`}><OperationalText text={"Open home →"} /></Link>}</div>;
  if (status !== 'submitted') return <p className="mt-12 text-small text-text-secondary"><OperationalText text={"Awaiting applicant submission."} /></p>;
  if (result) return <div role="status" className="mt-12 rounded-lg bg-state-success-soft p-16"><p><OperationalText text={"Created canonical draft records. Existing activation checks still apply."} /></p><Link className="text-brand-andaman underline" href={`/app/admin/properties/${result.projectId}/onboarding`}><OperationalText text={"Complete project onboarding →"} /></Link>{result.unitId && <Link className="ml-12 text-brand-andaman underline" href={`/app/admin/units/${result.unitId}`}><OperationalText text={"Complete home →"} /></Link>}</div>;
  return <form className="mt-16 space-y-12 border-t border-border-line pt-16" onSubmit={async e => {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      const response = await fetch(`/api/admin/property-submissions/${id}/convert`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ descriptionLocale: reviewLocale || null, projectId: projectId || null, verifiedAuthority: authority, checkedDuplicates: duplicates, checkedMedia: media, verifiedOwner: owner, organizationId: organizationId || null, projectAddress: address, areaId: areaId || null, latitude, longitude }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Conversion failed');
      setResult(data);
    } catch (e) { setError(e instanceof Error ? e.message : 'Conversion failed'); }
    finally { setBusy(false); }
  }}>
    <h3 className="font-semibold"><OperationalText text={"Review and convert to canonical draft"} /></h3>
    {hasDescription && <div className="block text-small"><label htmlFor={`description-language-${id}`}><OperationalText text={"Description language"} /></label>
      <select id={`description-language-${id}`} value={reviewLocale} disabled={Boolean(sourceLocale)} onChange={e => setReviewLocale(e.target.value)} className="mt-4 block w-full rounded-lg border border-border-line p-12">
        <option value=""><OperationalText text={"Choose the language of the submitted description"} /></option>
        {LOCALES.map(locale => <option key={locale} value={locale}>{locale.toUpperCase()}</option>)}
      </select>
    </div>}
    <div className="block text-small"><label htmlFor={`submission-project-${id}`}><OperationalText text={"Match this submission to an existing complex, or leave blank to create a new draft project."} /></label>
      <select id={`submission-project-${id}`} value={projectId} onChange={e => setProjectId(e.target.value)} className="mt-4 block w-full rounded-lg border border-border-line p-12">
        <option value=""><OperationalText text={"Create a new complex from the submitted project details"} /></option>
        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
    </div>
    {!projectId && <div className="space-y-12 rounded-lg border border-border-line p-16"><p className="font-semibold"><OperationalText text={"New complex: verify location before creation"} /></p><label className="block text-small"><OperationalText text={"Full address"} /><input className="mt-4 block w-full rounded-lg border border-border-line p-12" value={address} onChange={e => setAddress(e.target.value)} /></label><div className="block text-small"><label htmlFor={`submission-area-${id}`}><OperationalText text={"Canonical area"} /></label><select id={`submission-area-${id}`} className="mt-4 block w-full rounded-lg border border-border-line p-12" value={areaId} onChange={e => setAreaId(e.target.value)}><option value=""><OperationalText text={"Select an area"} /></option>{areas.map(a => <option key={a.id} value={a.id}>{a.slug}</option>)}</select></div><div className="grid grid-cols-2 gap-12"><label className="text-small"><OperationalText text={"Latitude"} /><input className="mt-4 block w-full rounded-lg border border-border-line p-12" type="number" step="any" value={latitude} onChange={e => setLatitude(e.target.value)}/></label><label className="text-small"><OperationalText text={"Longitude"} /><input className="mt-4 block w-full rounded-lg border border-border-line p-12" type="number" step="any" value={longitude} onChange={e => setLongitude(e.target.value)}/></label></div></div>}
        {(operatingModel === 'via_management_company' || applicantKind === 'management') && <div className="block text-small"><label htmlFor={`submission-company-${id}`}><OperationalText text={"Verified management company (requested: "} />{requestedManagementCompanyName || 'not supplied'})</label><select id={`submission-company-${id}`} className="mt-4 block w-full rounded-lg border border-border-line p-12" value={organizationId} onChange={e => setOrganizationId(e.target.value)}><option value=""><OperationalText text={"No verified company yet — keep engagement uncreated"} /></option>{organizations.filter(o => !o.projectId || o.projectId === projectId).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></div>}
        <label className="flex items-start gap-8 text-small"><input type="checkbox" checked={authority} onChange={e => setAuthority(e.target.checked)}/><OperationalText text={"I checked the applicant's identity, mandate or ownership evidence."} /></label>
    <label className="flex items-start gap-8 text-small"><input type="checkbox" checked={duplicates} onChange={e => setDuplicates(e.target.checked)}/><OperationalText text={"I checked project and unit duplicates and selected the correct canonical complex."} /></label>
    <label className="flex items-start gap-8 text-small"><input type="checkbox" checked={media} onChange={e => setMedia(e.target.checked)}/><OperationalText text={"I checked submitted project and unit photos are appropriate for their distinct scopes."} /></label>
    <label className="flex items-start gap-8 text-small"><input type="checkbox" checked={owner} onChange={e => setOwner(e.target.checked)}/><OperationalText text={"The applicant is independently verified as the unit owner; record their ownership history (leave unchecked for managers and representatives)."} /></label>
    <p className="text-small text-text-secondary"><OperationalText text={"Conversion creates draft records only. No booking, sale or rental is activated by this action."} /></p>
    {error && <p role="alert" className="text-state-error">{error}</p>}
    <button type="submit" disabled={busy || !authority || !duplicates || !media || (hasDescription && !reviewLocale)} className="rounded-lg bg-brand-andaman px-20 py-12 font-semibold text-white disabled:opacity-40"><OperationalText text={busy ? 'Creating…' : 'Create canonical draft →'} /></button>
  </form>;
}


function ConvertEmployeeCreation({ id, status, employeeCreation, labels, descriptionLocale, hasDescription, reviewOptions, initialExistingUnitId }: {
  id: string; status: string; employeeCreation: { kind: 'unit' | 'complex'; spaceId: string; organizationId: string; scopeProjectId: string | null; createdProjectId?: string | null; createdUnitId?: string | null };
  reviewOptions?: { units: { id: string; name: string; projectId: string }[]; projects: { id: string; name: string; address: string }[] } | null;
  initialExistingUnitId?: string | null;
  labels: Record<string, string>; descriptionLocale: string | null; hasDescription: boolean;
  canonicalProjectId?: string | null; canonicalUnitId?: string | null;
}) {
  const l = (key: string) => labels[`property.creation.${key}`] || EMPLOYEE_CREATION_LABELS[`property.creation.${key}`];
  const [rights, setRights] = useState(false);
  const [duplicates, setDuplicates] = useState(false);
  const [media, setMedia] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [result, setResult] = useState<{ projectId: string; unitId: string | null; createdProjectId: string | null; createdUnitId: string | null; matchedExisting: boolean } | null>(null);
  const [matchId, setMatchId] = useState(reviewOptions?.units.some(unit => unit.id === initialExistingUnitId) ? initialExistingUnitId || '' : '');
  const lock = useRef(false);
  useEffect(() => {
    if (!busy) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [busy]);
  const converted = status === 'converted' || !!result;
  const createdId = employeeCreation.kind === 'unit' ? result?.createdUnitId || employeeCreation.createdUnitId : result?.createdProjectId || employeeCreation.createdProjectId;
  const matched = result?.matchedExisting || converted && !createdId;
  if (converted) return <div role="status" className="mt-16 rounded-md bg-state-success-soft p-16"><p>{l(matched ? 'admin.matched' : 'status.converted')}</p>{createdId && <Link className="mt-12 inline-block text-brand-andaman underline" href={employeeCreation.kind === 'unit' ? `/app/admin/units/${encodeURIComponent(createdId)}` : `/app/admin/properties/${encodeURIComponent(createdId)}/onboarding`}>{l(employeeCreation.kind === 'unit' ? 'admin.open_unit' : 'admin.open_complex')}</Link>}</div>;
  if (status !== 'submitted') return <p className="mt-12 text-small text-text-secondary">{l('admin.waiting')}</p>;
  const localeValid = !hasDescription || LOCALES.some(locale => locale === descriptionLocale);
  return <form className="mt-16 space-y-12 border-t border-border-line pt-16" onSubmit={async event => {
    event.preventDefault();
    if (lock.current || needsRefresh || !reviewOptions || !rights || !duplicates || !media || !localeValid) return;
    lock.current = true; setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/admin/property-submissions/${encodeURIComponent(id)}/convert`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ descriptionLocale, projectId: employeeCreation.kind === 'unit' ? employeeCreation.scopeProjectId : matchId || null, ...(employeeCreation.kind === 'unit' ? { existingUnitId: matchId || null } : {}), verifiedAuthority: true, checkedDuplicates: true, checkedMedia: true, verifiedOwner: false, organizationId: null }),
      });
      if (!response.ok) {
        if ([401, 403, 404, 409].includes(response.status)) setNeedsRefresh(true);
        if (response.status >= 500) { setNeedsRefresh(true); throw new Error('uncertain'); }
        throw new Error(({ 400: 'validation', 401: 'unauthorized', 403: 'forbidden', 404: 'not_found', 409: 'conflict' } as Record<number, string>)[response.status] || 'request');
      }
      const data = await response.json();
      if (!data || typeof data.projectId !== 'string' || typeof data.matchedExisting !== 'boolean' || !('createdProjectId' in data) || !('createdUnitId' in data) || employeeCreation.kind === 'unit' && typeof data.unitId !== 'string') { setNeedsRefresh(true); throw new Error('uncertain'); }
      const expectedTarget = employeeCreation.kind === 'unit' ? data.unitId : data.projectId;
      const createdTarget = employeeCreation.kind === 'unit' ? data.createdUnitId : data.createdProjectId;
      if ((employeeCreation.kind === 'unit' && data.projectId !== employeeCreation.scopeProjectId) ||
        data.matchedExisting !== Boolean(matchId) || (matchId ? expectedTarget !== matchId || data.createdUnitId !== null || data.createdProjectId !== null : createdTarget !== expectedTarget)) {
        setNeedsRefresh(true); throw new Error('uncertain');
      }
      setResult({ projectId: data.projectId, unitId: typeof data.unitId === 'string' ? data.unitId : null, createdProjectId: typeof data.createdProjectId === 'string' ? data.createdProjectId : null, createdUnitId: typeof data.createdUnitId === 'string' ? data.createdUnitId : null, matchedExisting: data.matchedExisting });
    } catch (reason) {
      const key = reason instanceof Error && ['validation', 'unauthorized', 'forbidden', 'not_found', 'conflict'].includes(reason.message) ? reason.message : 'uncertain';
      if (key === 'uncertain') setNeedsRefresh(true);
      setError(key);
    } finally { lock.current = false; setBusy(false); }
  }}>
    <h3 className="font-semibold">{l('admin.review')}</h3>
    {employeeCreation.kind === 'unit' && <p className="text-small text-text-secondary">{l('admin.fixed_project')}</p>}
    {!reviewOptions && <p role="alert" className="text-state-error">{l('admin.unavailable')}</p>}
    <label className="block text-small" htmlFor={`employee-match-${id}`}>{l(employeeCreation.kind === 'unit' ? 'admin.match_unit' : 'admin.match_project')}</label>
    <select id={`employee-match-${id}`} className="min-h-[44px] w-full rounded-md border border-border-line p-12" disabled={busy || needsRefresh || !reviewOptions} value={matchId} onChange={event => { setMatchId(event.target.value); setDuplicates(false); }}>
      <option value="">{l(employeeCreation.kind === 'unit' ? 'admin.new_unit' : 'admin.new_project')}</option>
      {(employeeCreation.kind === 'unit' ? reviewOptions?.units : reviewOptions?.projects)?.map(record => <option key={record.id} value={record.id}>{record.name}</option>)}
    </select>
    <p className="text-small text-text-secondary">{l('admin.match_hint')}</p>
    <p className="text-small">{l('admin.safety')}</p>
    {!localeValid && <p role="alert" className="text-state-error">{l('error.validation')}</p>}
    <fieldset disabled={busy || needsRefresh || !reviewOptions} className="space-y-12">
      <label className="flex items-start gap-8 text-small"><input type="checkbox" checked={rights} onChange={event => setRights(event.target.checked)} />{l('admin.review_rights')}</label>
      <label className="flex items-start gap-8 text-small"><input type="checkbox" checked={duplicates} onChange={event => setDuplicates(event.target.checked)} />{l('admin.review_duplicates')}</label>
      <label className="flex items-start gap-8 text-small"><input type="checkbox" checked={media} onChange={event => setMedia(event.target.checked)} />{l('admin.review_media')}</label>
    </fieldset>
    {error && <p role="alert" className="text-state-error">{l(`error.${error}`)}</p>}
    {needsRefresh && <button type="button" className="min-h-[44px] rounded-md border border-border-line px-16 py-8" onClick={() => window.location.reload()}>{l('admin.refresh')}</button>}
    <button type="submit" disabled={busy || needsRefresh || !reviewOptions || !rights || !duplicates || !media || !localeValid} className="min-h-[44px] rounded-md bg-brand-andaman px-20 py-12 font-semibold text-white disabled:opacity-40">{l(busy ? 'saving' : matchId ? 'admin.finish_match' : 'admin.create')}</button>
  </form>;
}
