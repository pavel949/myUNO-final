import { describe, expect, it, vi } from 'vitest';
import { parseOwnerEvidence, readOwnerEvidenceStage } from './owner-evidence';
import { readOwnerEvidenceDraft, saveOwnerEvidenceDraft } from './owner-evidence.service';
const evidence = () => ({ ownerEntity: { legalName: 'Owner Company', businessAddress: null },
  ownerRepresentative: { displayName: 'Director', title: 'Director' },
  operatorEntity: { legalName: 'Operator Company', businessAddress: 'Office' },
  operatorRepresentative: { displayName: 'Manager', title: null },
  source: { url: 'https://docs.google.com/document/d/abc123/edit?usp=drivesdk', title: 'Contract copy', modifiedDate: '2026-07-27' },
  contract: { proposedCommencementDate: '2026-11-01', proposedTermYears: 3, sourceCopySignatureStatus: 'blank' } });
function fixture() {
  let stage: any = { unitDescriptions: { u: { revision: 7 } }, preserved: true };
  const calls: string[] = [];
  const db: any = {
    identity: { findUnique: vi.fn(async () => ({ isAdmin: true, status: 'active' })) },
    project: { findUnique: vi.fn(async () => ({ id: 'p' })) },
    projectOnboardingDraft: { findUnique: vi.fn(async () => ({ stage_data: structuredClone(stage) })),
      upsert: vi.fn(async (args: any) => { calls.push('upsert'); stage = structuredClone(args.update.stage_data); }) },
    auditLog: { create: vi.fn(async () => { calls.push('audit'); }) },
    $queryRaw: vi.fn(async () => { calls.push('project_lock'); }),
  };
  db.$transaction = vi.fn(async (fn: any) => { const before = structuredClone(stage); try { return await fn(db); } catch(e) { stage = before; throw e; } });
  return { db, calls, stage: () => stage };
}
const save = (db: any, expectedVersion: string, value: unknown = evidence()) => saveOwnerEvidenceDraft(db, { projectId: 'p', actorIdentityId: 'admin', expectedVersion, evidence: value });
describe('owner evidence intake validation', () => {
  it('normalizes source URL and keeps all legal parties separate', () => {
    const result = parseOwnerEvidence(evidence()); expect(result.source.url).toBe('https://docs.google.com/document/d/abc123/edit');
    expect(result.ownerEntity.legalName).toBe('Owner Company'); expect(result.ownerRepresentative.displayName).toBe('Director');
  });
  it.each(['http://docs.google.com/document/d/x','https://evil.test/document/d/x','https://docs.google.com.evil.test/document/d/x','https://user:secret@docs.google.com/document/d/x','https://docs.google.com:444/document/d/x','https://docs.google.com/spreadsheets/d/x'])('rejects unsupported locator %s', url => {
    const e = evidence(); e.source.url = url; expect(() => parseOwnerEvidence(e)).toThrow('OWNER_EVIDENCE_INVALID');
  });
  it.each([[['blank']], [{}], [{ toString: () => 'blank' }]])('rejects non-string signature observations %j', status => {
    const e = evidence();
    expect(() => parseOwnerEvidence({ ...e, contract: { ...e.contract, sourceCopySignatureStatus: status } })).toThrow('OWNER_EVIDENCE_INVALID');
  });
  it('rejects approval fields, identity/account data and invalid dates', () => {
    expect(() => parseOwnerEvidence({ ...evidence(), executionStatus: 'verified' })).toThrow();
    expect(() => parseOwnerEvidence({ ...evidence(), ownerEntity: { legalName: 'Company', businessAddress: null, identityId: 'x' } })).toThrow();
    const e = evidence(); e.contract.proposedCommencementDate = '2026-02-30'; expect(() => parseOwnerEvidence(e)).toThrow();
  });
  it('rejects oversized, fractional and malformed stored data', () => {
    const e = evidence(); e.ownerEntity.legalName = 'x'.repeat(251); expect(() => parseOwnerEvidence(e)).toThrow();
    e.ownerEntity.legalName = 'Company'; e.contract.proposedTermYears = 1.5; expect(() => parseOwnerEvidence(e)).toThrow();
    expect(() => readOwnerEvidenceStage({ ownerContractEvidence: { revision: 1, executionStatus: 'verified' } })).toThrow();
  });
});
describe('private no-schema writer (mock DB only)', () => {
  it('saves a locked versioned draft, merges siblings, audits without PII and has no authority writer', async () => {
    const f = fixture(); const initial = await readOwnerEvidenceDraft(f.db, 'p', 'admin');
    const result = await save(f.db, initial.version);
    expect(result.draft).toMatchObject({ revision: 1, executionStatus: 'unverified', ownershipStatus: 'unverified', licenceStatus: 'unverified' });
    expect(f.calls).toEqual(['project_lock','upsert','audit']); expect(f.stage().unitDescriptions.u.revision).toBe(7); expect(f.stage().preserved).toBe(true);
    expect(JSON.stringify(f.db.auditLog.create.mock.calls)).not.toContain('Owner Company');
    expect(Object.keys(f.db)).not.toContain('roleAssignment');
  });
  it('same-content uncertain retry makes no second write or audit', async () => {
    const f = fixture(); const initial = await readOwnerEvidenceDraft(f.db, 'p', 'admin');
    const a = await save(f.db, initial.version); const b = await save(f.db, initial.version);
    expect(b).toEqual(a); expect(f.db.projectOnboardingDraft.upsert).toHaveBeenCalledTimes(1); expect(f.db.auditLog.create).toHaveBeenCalledTimes(1);
  });
  it('stale changed content is rejected without writes', async () => {
    const f = fixture(); const initial = await readOwnerEvidenceDraft(f.db, 'p', 'admin'); await save(f.db, initial.version);
    const e = evidence(); e.ownerEntity.legalName = 'Other'; await expect(save(f.db, initial.version,e)).rejects.toThrow('OWNER_EVIDENCE_CONFLICT');
    expect(f.db.projectOnboardingDraft.upsert).toHaveBeenCalledTimes(1);
  });
  it('versions are project-bound', async () => {
    const f = fixture(); const other = await readOwnerEvidenceDraft(f.db, 'other', 'admin'); await expect(save(f.db, other.version)).rejects.toThrow('OWNER_EVIDENCE_CONFLICT');
  });
  it.each([{ isAdmin: false, status: 'active' },{ isAdmin: true, status: 'blocked' },{ isAdmin: true, status: 'invited' },null])('denies actor %j on reads and writes', async actor => {
    const f = fixture(); f.db.identity.findUnique.mockResolvedValue(actor);
    await expect(readOwnerEvidenceDraft(f.db, 'p', 'actor')).rejects.toThrow('OWNER_EVIDENCE_FORBIDDEN');
    await expect(save(f.db,'a'.repeat(64))).rejects.toThrow('OWNER_EVIDENCE_FORBIDDEN'); expect(f.db.projectOnboardingDraft.upsert).not.toHaveBeenCalled();
  });
  it('rejects missing project and required version', async () => {
    const f = fixture(); f.db.project.findUnique.mockResolvedValue(null);
    await expect(readOwnerEvidenceDraft(f.db,'p','admin')).rejects.toThrow('PROJECT_NOT_FOUND');
    await expect(save(f.db,'')).rejects.toThrow('OWNER_EVIDENCE_VERSION_REQUIRED');
  });
  it('rolls draft back if transactional audit fails', async () => {
    const f = fixture(); const before = structuredClone(f.stage()); const initial = await readOwnerEvidenceDraft(f.db,'p','admin');
    f.db.auditLog.create.mockRejectedValue(new Error('audit unavailable'));
    await expect(save(f.db, initial.version)).rejects.toThrow('audit unavailable'); expect(f.stage()).toEqual(before);
  });
  it('merges the newest sibling section after taking the project lock', async () => {
    const f = fixture(); const initial = await readOwnerEvidenceDraft(f.db,'p','admin');
    f.db.$queryRaw.mockImplementation(async () => { f.stage().unitDescriptions.u.revision = 8; });
    await save(f.db, initial.version); expect(f.stage().unitDescriptions.u.revision).toBe(8);
  });
});
