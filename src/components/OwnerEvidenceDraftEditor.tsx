'use client';
import { useRef, useState } from 'react';
import { ownerEvidenceLabelsForLocale } from '@/modules/content/owner-evidence.seed';
import type { OwnerEvidenceDraft, OwnerEvidenceInput } from '@/modules/projects/owner-evidence';

type Snapshot = { projectId: string; version: string; draft: OwnerEvidenceDraft };
const empty: OwnerEvidenceInput = {
  ownerEntity: { legalName: '', businessAddress: null }, ownerRepresentative: { displayName: '', title: null },
  operatorEntity: { legalName: '', businessAddress: null }, operatorRepresentative: { displayName: '', title: null },
  source: { url: '', title: '', modifiedDate: null },
  contract: { proposedCommencementDate: null, proposedTermYears: null, sourceCopySignatureStatus: 'not_checked' },
};
export default function OwnerEvidenceDraftEditor({ projectId, labels = ownerEvidenceLabelsForLocale('en') }: { projectId: string; labels?: Record<string,string> }) {
  const t = (key: string) => labels[`admin.owner_evidence.${key}`] ?? ownerEvidenceLabelsForLocale('en')[`admin.owner_evidence.${key}`];
  const errors: Record<string,string> = { OWNER_EVIDENCE_CONFLICT: t('conflict'), OWNER_EVIDENCE_FORBIDDEN: t('forbidden'), OWNER_EVIDENCE_INVALID: t('invalid'), Unauthorized: t('auth') };
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [reloadGeneration, setReloadGeneration] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const inFlight = useRef(false);
  const url = `/api/admin/projects/${encodeURIComponent(projectId)}/owner-evidence`;
  async function request(evidence?: OwnerEvidenceInput) {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setMessage(''); setFailed(false);
    try {
      const res = await fetch(url, evidence ? { method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedVersion: snapshot?.version, evidence }) } : { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) { setFailed(true); setMessage(errors[data.error] || t('error')); return; }
      setSnapshot(data);
      if (!evidence) setReloadGeneration(generation => generation + 1);
      if (evidence) setMessage(t('saved'));
    } catch { setFailed(true); setMessage(t('error')); }
    finally { inFlight.current = false; setBusy(false); }
  }
  const value = snapshot?.draft.evidence ?? empty;
  return <details className="mt-12 border border-border-line p-12">
    <summary>{t('title')}</summary>
    <p className="my-12">{t('hint')}</p>
    <button type="button" disabled={busy} onClick={() => { void request(); }} className="underline">{snapshot ? t('reload') : t('open')}</button>
    {message && <p role={failed ? 'alert' : 'status'}>{message}</p>}
    {snapshot && <form key={`${snapshot.version}:${reloadGeneration}`} className="mt-12 grid gap-12" onSubmit={e => {
      e.preventDefault(); const data = new FormData(e.currentTarget);
      const str = (key: string) => String(data.get(key) ?? '').trim();
      const optional = (key: string) => str(key) || null;
      void request({ ownerEntity: { legalName: str('ownerName'), businessAddress: optional('ownerAddress') },
        ownerRepresentative: { displayName: str('ownerRepresentative'), title: optional('ownerTitle') },
        operatorEntity: { legalName: str('operatorName'), businessAddress: optional('operatorAddress') },
        operatorRepresentative: { displayName: str('operatorRepresentative'), title: optional('operatorTitle') },
        source: { url: str('sourceUrl'), title: str('sourceTitle'), modifiedDate: optional('modifiedDate') },
        contract: { proposedCommencementDate: optional('commencement'), proposedTermYears: str('term') ? Number(str('term')) : null,
          sourceCopySignatureStatus: str('signatures') as OwnerEvidenceInput['contract']['sourceCopySignatureStatus'] } });
    }}>
      {([
        ['ownerName',t('ownerName'),value.ownerEntity.legalName,250,true],
        ['ownerAddress',t('ownerAddress'),value.ownerEntity.businessAddress,1000,false],
        ['ownerRepresentative',t('ownerRepresentative'),value.ownerRepresentative.displayName,250,true],
        ['ownerTitle',t('ownerTitle'),value.ownerRepresentative.title,150,false],
        ['operatorName',t('operatorName'),value.operatorEntity.legalName,250,true],
        ['operatorAddress',t('operatorAddress'),value.operatorEntity.businessAddress,1000,false],
        ['operatorRepresentative',t('operatorRepresentative'),value.operatorRepresentative.displayName,250,true],
        ['operatorTitle',t('operatorTitle'),value.operatorRepresentative.title,150,false],
        ['sourceUrl',t('sourceUrl'),value.source.url,2000,true],
        ['sourceTitle',t('sourceTitle'),value.source.title,300,true],
      ] as const).map(([name,label,initial,maxLength,required]) => <label key={name}>{label}<input name={name} defaultValue={initial ?? ''} maxLength={maxLength} required={required} disabled={busy} className="block w-full border border-border-line p-8" /></label>)}
      <label>{t('modifiedDate')}<input name="modifiedDate" type="date" defaultValue={value.source.modifiedDate ?? ''} disabled={busy}/></label>
      <label>{t('commencement')}<input name="commencement" type="date" defaultValue={value.contract.proposedCommencementDate ?? ''} disabled={busy}/></label>
      <label>{t('term')}<input name="term" type="number" min="1" max="100" step="1" defaultValue={value.contract.proposedTermYears ?? ''} disabled={busy}/></label>
      <label>{t('signatures')}<select name="signatures" defaultValue={value.contract.sourceCopySignatureStatus} disabled={busy}>
        <option value="not_checked">{t('notChecked')}</option><option value="blank">{t('blank')}</option><option value="signatures_visible">{t('visible')}</option>
      </select></label>
      <p>{t('status')}</p>
      <button type="submit" disabled={busy}>{busy ? t('saving') : t('save')}</button>
    </form>}
  </details>;
}
