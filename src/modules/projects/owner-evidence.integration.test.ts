import { beforeEach, describe, expect, it } from 'vitest';
import { db, resetDb, createProject, createIdentity } from '@/test/util';
import { readOwnerEvidenceDraft, saveOwnerEvidenceDraft } from './owner-evidence.service';
const evidence = { ownerEntity:{legalName:'Owner Company',businessAddress:null},ownerRepresentative:{displayName:'Director',title:'Director'},operatorEntity:{legalName:'Operator',businessAddress:null},operatorRepresentative:{displayName:'Manager',title:null},source:{url:'https://docs.google.com/document/d/test-source/edit',title:'Unsigned source',modifiedDate:'2026-07-27'},contract:{proposedCommencementDate:'2026-11-01',proposedTermYears:3,sourceCopySignatureStatus:'blank'}};
describe('owner evidence real database integrity',()=>{
 beforeEach(async()=>{await resetDb();});
 async function fixture(){ const p=await createProject();const a=await createIdentity({isAdmin:true});const initial=await readOwnerEvidenceDraft(db,p.id,a.id);return {projectId:p.id,actorIdentityId:a.id,expectedVersion:initial.version,evidence}; }
 it('serializes conflicting saves, preserves sibling data and never creates ownership or access',async()=>{
  const input=await fixture();await db.projectOnboardingDraft.create({data:{project_id:input.projectId,stage_data:{unrelated:{keep:true}}}});
  const results=await Promise.allSettled([saveOwnerEvidenceDraft(db,input),saveOwnerEvidenceDraft(db,{...input,evidence:{...evidence,ownerEntity:{...evidence.ownerEntity,legalName:'Other'}}})]);
  expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
  const failure=results.find(r=>r.status==='rejected') as PromiseRejectedResult;expect(failure.reason.message).toBe('OWNER_EVIDENCE_CONFLICT');
  const row=await db.projectOnboardingDraft.findUniqueOrThrow({where:{project_id:input.projectId}});
  expect(row.stage_data).toMatchObject({unrelated:{keep:true},ownerContractEvidence:{revision:1,executionStatus:'unverified',ownershipStatus:'unverified',licenceStatus:'unverified'}});
  expect(await db.auditLog.count({where:{action:'projects:owner_evidence_draft_saved'}})).toBe(1);
  expect(await db.unitEngagement.count()).toBe(0);expect(await db.roleAssignment.count()).toBe(0);
 });
 it('makes identical concurrent retries one save and one audit',async()=>{
  const input=await fixture();const results=await Promise.all([saveOwnerEvidenceDraft(db,input),saveOwnerEvidenceDraft(db,input)]);
  expect(results[0].version).toBe(results[1].version);expect(results[0].draft.revision).toBe(1);
  expect(await db.auditLog.count({where:{action:'projects:owner_evidence_draft_saved'}})).toBe(1);
 });
 it('rolls back the evidence when atomic audit fails',async()=>{
  const input=await fixture();
  await db.$executeRawUnsafe(`CREATE FUNCTION test_reject_owner_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test audit failure'; END; $$`);
  await db.$executeRawUnsafe('CREATE TRIGGER test_reject_owner_audit BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION test_reject_owner_audit()');
  try {await expect(saveOwnerEvidenceDraft(db,input)).rejects.toThrow();expect(await db.projectOnboardingDraft.count()).toBe(0);}
  finally {await db.$executeRawUnsafe('DROP TRIGGER test_reject_owner_audit ON audit_log');await db.$executeRawUnsafe('DROP FUNCTION test_reject_owner_audit()');}
 });
});
