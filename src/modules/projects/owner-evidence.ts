/** Private source-attributed intake only. This module never resolves authority. */
export type OwnerEvidenceInput = {
  ownerEntity: { legalName: string; businessAddress: string | null };
  ownerRepresentative: { displayName: string; title: string | null };
  operatorEntity: { legalName: string; businessAddress: string | null };
  operatorRepresentative: { displayName: string; title: string | null };
  source: { url: string; title: string; modifiedDate: string | null };
  contract: { proposedCommencementDate: string | null; proposedTermYears: number | null;
    sourceCopySignatureStatus: 'not_checked' | 'blank' | 'signatures_visible' };
};
export type OwnerEvidenceDraft = { schemaVersion: 1; revision: number; evidence: OwnerEvidenceInput | null;
  executionStatus: 'unverified'; ownershipStatus: 'unverified'; licenceStatus: 'unverified' };
const invalid = () => { throw new Error('OWNER_EVIDENCE_INVALID'); };
export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
  return value as Record<string, unknown>;
}
function exact(value: unknown, keys: string[]) {
  const item = record(value);
  if (Object.keys(item).length !== keys.length || keys.some(k => !Object.prototype.hasOwnProperty.call(item, k))) invalid();
  return item;
}
function text(value: unknown, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) return invalid();
  return value.trim();
}
function optionalText(value: unknown, max: number) { return value === null ? null : text(value, max); }
function date(value: unknown): string | null {
  if (value === null) return null;
  const v = text(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || !Number.isFinite(Date.parse(v)) || new Date(v).toISOString().slice(0, 10) !== v) invalid();
  return v;
}
export function parseOwnerEvidence(value: unknown): OwnerEvidenceInput {
  const root = exact(value, ['ownerEntity','ownerRepresentative','operatorEntity','operatorRepresentative','source','contract']);
  const entity = (value: unknown) => { const x = exact(value, ['legalName','businessAddress']);
    return { legalName: text(x.legalName, 250), businessAddress: optionalText(x.businessAddress, 1000) }; };
  const representative = (value: unknown) => { const x = exact(value, ['displayName','title']);
    return { displayName: text(x.displayName, 250), title: optionalText(x.title, 150) }; };
  const source = exact(root.source, ['url','title','modifiedDate']);
  const rawUrl = text(source.url, 2000);
  let url: URL;
  try { url = new URL(rawUrl); } catch { return invalid(); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port ||
    !['docs.google.com','drive.google.com'].includes(url.hostname) ||
    !/^\/(?:document|file)\/d\/[a-zA-Z0-9_-]+(?:\/|$)/.test(url.pathname)) invalid();
  // Store the document locator only; query parameters can contain credentials or tracking.
  const sourceUrl = `${url.origin}${url.pathname}`;
  const contract = exact(root.contract, ['proposedCommencementDate','proposedTermYears','sourceCopySignatureStatus']);
  const years = contract.proposedTermYears;
  if (years !== null && (typeof years !== 'number' || !Number.isSafeInteger(years) || years < 1 || years > 100)) invalid();
  if (typeof contract.sourceCopySignatureStatus !== 'string' || !['not_checked','blank','signatures_visible'].includes(contract.sourceCopySignatureStatus)) invalid();
  return { ownerEntity: entity(root.ownerEntity), ownerRepresentative: representative(root.ownerRepresentative),
    operatorEntity: entity(root.operatorEntity), operatorRepresentative: representative(root.operatorRepresentative),
    source: { url: sourceUrl, title: text(source.title, 300), modifiedDate: date(source.modifiedDate) },
    contract: { proposedCommencementDate: date(contract.proposedCommencementDate), proposedTermYears: years as number | null,
      sourceCopySignatureStatus: contract.sourceCopySignatureStatus as OwnerEvidenceInput['contract']['sourceCopySignatureStatus'] } };
}
export function readOwnerEvidenceStage(stageData: unknown): { stages: Record<string, unknown>; draft: OwnerEvidenceDraft } {
  const stages = record(stageData ?? {});
  const raw = stages.ownerContractEvidence;
  if (raw === undefined) return { stages, draft: { schemaVersion: 1, revision: 0, evidence: null,
    executionStatus: 'unverified', ownershipStatus: 'unverified', licenceStatus: 'unverified' } };
  const d = exact(raw, ['schemaVersion','revision','evidence','executionStatus','ownershipStatus','licenceStatus']);
  if (d.schemaVersion !== 1 || !Number.isSafeInteger(d.revision) || Number(d.revision) < 1 ||
    d.executionStatus !== 'unverified' || d.ownershipStatus !== 'unverified' || d.licenceStatus !== 'unverified') invalid();
  return { stages, draft: { schemaVersion: 1, revision: Number(d.revision), evidence: parseOwnerEvidence(d.evidence),
    executionStatus: 'unverified', ownershipStatus: 'unverified', licenceStatus: 'unverified' } };
}
