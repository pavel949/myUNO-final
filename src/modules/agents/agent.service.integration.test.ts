import { beforeEach, describe, expect, it } from 'vitest';
import { db, resetDb, createIdentity, createProject, createUnit, createRegulatoryEvidence } from '@/test/util';
import { agentAction, adminAgentAction, getAgentContext, getAgentDashboard, getAgentAdminDashboard,
  getAgentInventory, resolveAgentShare } from './agent.service';
import { internalCrm } from './internal-crm';

describe('agent workspace isolation and approved client offers',()=>{
  beforeEach(resetDb);
  async function fixture() {
    const admin=await createIdentity({isAdmin:true});
    const alice=await createIdentity();
    const bob=await createIdentity();
    const a=await adminAgentAction(db,admin.id,{action:'provision',name:'Agency A',email:alice.email});
    const b=await adminAgentAction(db,admin.id,{action:'provision',name:'Agency B',email:bob.email});
    const contact=await agentAction(db,alice.id,a.id,'contacts',{
      displayName:'Private client',email:'private@example.com',phone:'+66812345678',privateNotes:'PRIVATE-NOTES',
    });
    const intro=await agentAction(db,alice.id,a.id,'opportunities',{
      relationshipId:contact.id,title:'Private villa purchase',type:'purchase',
    });
    return {admin,alice,bob,a,b,contact,intro};
  }
  async function saleFixture() {
    const f=await fixture();
    const project=await createProject({status:'live'});
    const unit=await createUnit({projectId:project.id,status:'live'});
    const photo=await db.mediaAsset.create({data:{uploadedByIdentityId:f.admin.id,kind:'photo',
      mimeType:'image/jpeg',storageKey:'https://example.com/public.jpg',sizeBytes:5}});
    await db.unit.update({where:{id:unit.id},data:{coverMediaId:photo.id}});
    const proof=await createRegulatoryEvidence(f.admin.id);
    for(const type of ['title_legal_use','sale_authority']) await db.regulatoryCredential.create({data:{
      requirementKey:type,credentialType:type,scopeLevel:'unit',unitId:unit.id,
      status:'active',verificationStatus:'verified',evidenceMediaId:proof.id,
    }});
    const offering=await db.commercialOffering.create({data:{
      projectId:project.id,unitId:unit.id,offeringType:'sale',status:'active',
    }});
    const draft=await agentAction(db,f.alice.id,f.a.id,'quotes',{
      introductionId:f.intro.id,offeringId:offering.id,title:'Villa quotation',
      amountSatang:'12500000000',feeSatang:'10000',depositSatang:'1000000',
      terms:'Subject to availability and contract approval',
      expiresAt:new Date(Date.now()+86400000).toISOString(),
    });
    return {...f,project,unit,offering,draft};
  }
  it('scopes every direct ID and keeps agency channels off the canonical identity',async()=>{
    const f=await fixture();
    await expect(getAgentContext(db,f.bob.id,f.a.id)).rejects.toThrow('workspace_not_found');
    await expect(agentAction(db,f.bob.id,f.b.id,'stage',{introductionId:f.intro.id,stage:'qualified'}))
      .rejects.toThrow('record_not_found');
    await expect(agentAction(db,f.bob.id,f.b.id,'opportunities',{relationshipId:f.contact.id,type:'rental',title:'Leak'}))
      .rejects.toThrow('record_not_found');
    const relationship=await db.crmContactRelationship.findUniqueOrThrow({where:{id:f.contact.id}});
    const identity=await db.identity.findUniqueOrThrow({where:{id:relationship.identityId}});
    expect(identity.email).toBeNull();expect(identity.phone).toBeNull();
    const other=await getAgentDashboard(db,f.bob.id,f.b.id,'en');
    expect(other.contacts).toEqual([]);expect(other.opportunities).toEqual([]);
  });
  it('resolves the same person across agencies without exposing the other relationship',async()=>{
    const f=await fixture();
    const bContact=await agentAction(db,f.bob.id,f.b.id,'contacts',{
      displayName:'My own name',email:'PRIVATE@example.com',privateNotes:'B only',
    });
    const rows=await db.crmContactRelationship.findMany({where:{id:{in:[f.contact.id,bContact.id]}}});
    expect(rows[0].identityId).toBe(rows[1].identityId);
    const data=await getAgentDashboard(db,f.bob.id,f.b.id,'en');
    expect(data.contacts).toHaveLength(1);
    expect(data.contacts[0].displayName).toBe('My own name');
    expect(JSON.stringify(data)).not.toContain('PRIVATE-NOTES');
  });
  it('ordinary agents see their own records, while their agency manager can coordinate them',async()=>{
    const f=await fixture();
    const member=await createIdentity();
    await adminAgentAction(db,f.admin.id,{action:'add-member',workspaceId:f.a.id,email:member.email,role:'agent'});
    const before=await getAgentDashboard(db,member.id,f.a.id,'en');
    expect(before.contacts).toHaveLength(0);expect(before.opportunities).toHaveLength(0);
    await agentAction(db,member.id,f.a.id,'contacts',{displayName:'Team client',telegram:'team_client'});
    expect((await getAgentDashboard(db,f.alice.id,f.a.id,'en')).contacts).toHaveLength(2);
  });
  it('revocation, suspension and blocked identities immediately deny access',async()=>{
    const f=await fixture();
    await adminAgentAction(db,f.admin.id,{action:'toggle-workspace',id:f.a.id,active:false});
    await expect(agentAction(db,f.alice.id,f.a.id,'contacts',{displayName:'X',email:'x@example.com'})).rejects.toThrow('workspace_not_found');
    await adminAgentAction(db,f.admin.id,{action:'toggle-workspace',id:f.a.id,active:true});
    const membership=await db.organizationMembership.findFirstOrThrow({where:{identityId:f.alice.id}});
    await adminAgentAction(db,f.admin.id,{action:'revoke-member',id:membership.id});
    await expect(getAgentContext(db,f.alice.id,f.a.id)).rejects.toThrow('workspace_not_found');
    await db.identity.update({where:{id:f.bob.id},data:{status:'blocked'}});
    await expect(getAgentContext(db,f.bob.id,f.b.id)).rejects.toThrow('workspace_not_found');
  });
  it('requires explicit handover permission, gives a stable receipt and shares no private notes',async()=>{
    const f=await fixture();
    expect((await getAgentAdminDashboard(db,f.admin.id)).handovers).toHaveLength(0);
    await expect(agentAction(db,f.alice.id,f.a.id,'handovers',{introductionId:f.intro.id,request:'Contracts'}))
      .rejects.toThrow('sharing_consent_required');
    const input={introductionId:f.intro.id,request:'Prepare contracts',consentConfirmed:true};
    const h1=await agentAction(db,f.alice.id,f.a.id,'handovers',input);
    const h2=await agentAction(db,f.alice.id,f.a.id,'handovers',input);
    expect(h1.id).toBe(h2.id);
    const queue=await getAgentAdminDashboard(db,f.admin.id);
    expect(queue.handovers).toHaveLength(1);
    expect(JSON.stringify(queue.handovers)).toContain('private@example.com');
    expect(JSON.stringify(queue.handovers)).not.toContain('PRIVATE-NOTES');
    await adminAgentAction(db,f.admin.id,{action:'handover-status',id:h1.id,status:'acknowledged'});
    const saved=await db.agentIntroduction.findUniqueOrThrow({where:{id:f.intro.id}});
    expect(saved.agentIdentityId).toBe(f.alice.id);
  });
  it('keeps private records out of the legacy internal CRM including direct IDs and aggregates',async()=>{
    const f=await fixture();
    const intro=await db.agentIntroduction.findUniqueOrThrow({where:{id:f.intro.id}});
    expect(await internalCrm.crmOpportunity.findUnique({where:{id:intro.opportunityId}})).toBeNull();
    expect(await internalCrm.crmOpportunity.count()).toBe(0);
    const task=await agentAction(db,f.alice.id,f.a.id,'activities',{
      introductionId:f.intro.id,subject:'Private task',dueAt:new Date().toISOString(),
    });
    expect(await internalCrm.crmActivity.findUnique({where:{id:task.id}})).toBeNull();
    expect(await internalCrm.crmActivity.count()).toBe(0);
    await expect(internalCrm.crmOpportunity.update({where:{id:intro.opportunityId},data:{stage:'won'}})).rejects.toThrow();
    expect((await db.crmOpportunity.findUniqueOrThrow({where:{id:intro.opportunityId}})).stage).toBe('new');
  });
  it('tracks follow-ups without writing global CRM profile fields',async()=>{
    const f=await fixture();
    const input={introductionId:f.intro.id,subject:'Call client',dueAt:new Date(Date.now()+10000).toISOString()};
    const task=await agentAction(db,f.alice.id,f.a.id,'activities',input);
    expect(await db.crmProfile.count()).toBe(0);
    await agentAction(db,f.alice.id,f.a.id,'complete-activity',{id:task.id});
    expect((await db.crmActivity.findUniqueOrThrow({where:{id:task.id}})).status).toBe('completed');
  });
  it('shows only published current answers in the exact requested language',async()=>{
    const f=await fixture();
    const article=await adminAgentAction(db,f.admin.id,{action:'knowledge-draft',locale:'en',title:'Contract process',
      body:'Ask your coordinator for verified contract terms.',sourceUrl:'https://example.com/process',
      expiresAt:new Date(Date.now()+86400000).toISOString()});
    expect((await getAgentDashboard(db,f.alice.id,f.a.id,'en')).knowledge).toHaveLength(0);
    await adminAgentAction(db,f.admin.id,{action:'publish-knowledge',id:article.id});
    expect((await getAgentDashboard(db,f.alice.id,f.a.id,'en','contract')).knowledge).toHaveLength(1);
    expect((await getAgentDashboard(db,f.alice.id,f.a.id,'ru')).knowledge).toHaveLength(0);
    await adminAgentAction(db,f.admin.id,{action:'withdraw-knowledge',id:article.id});
    expect((await getAgentDashboard(db,f.alice.id,f.a.id,'en')).knowledge).toHaveLength(0);
  });
  it('requires approval for sharing and publishes only a customer-safe immutable snapshot',async()=>{
    const f=await saleFixture();
    await expect(agentAction(db,f.alice.id,f.a.id,'shares',{id:f.draft.id})).rejects.toThrow('quote_not_shareable');
    await agentAction(db,f.alice.id,f.a.id,'submit-quote',{id:f.draft.id});
    await expect(adminAgentAction(db,f.alice.id,{action:'approve-quote',id:f.draft.id})).rejects.toThrow('forbidden');
    await adminAgentAction(db,f.admin.id,{action:'approve-quote',id:f.draft.id});
    const share=await agentAction(db,f.alice.id,f.a.id,'shares',{id:f.draft.id});
    const token=('path' in share ? String(share.path) : '').split('/').pop()!;
    const stored=await db.agentQuoteShare.findUniqueOrThrow({where:{id:share.id}});
    expect(stored.tokenHash).not.toBe(token);
    const snapshot=await resolveAgentShare(db,token);
    expect(snapshot).toMatchObject({amountSatang:'12500000000',totalSatang:'12500010000'});
    const json=JSON.stringify(snapshot);
    for(const secret of ['private@example.com','PRIVATE-NOTES','identityId','commission','evidenceMediaId'])
      expect(json).not.toContain(secret);
    await agentAction(db,f.alice.id,f.a.id,'revoke-quote',{id:f.draft.id});
    expect(await resolveAgentShare(db,token)).toBeNull();
  });
  it('rechecks legal authority at approval and when a client opens a previously approved offer',async()=>{
    const f=await saleFixture();
    expect((await getAgentInventory(db,f.alice.id,f.a.id))).toHaveLength(1);
    await agentAction(db,f.alice.id,f.a.id,'submit-quote',{id:f.draft.id});
    await db.regulatoryCredential.updateMany({where:{unitId:f.unit.id,credentialType:'sale_authority'},data:{verificationStatus:'unverified'}});
    await expect(adminAgentAction(db,f.admin.id,{action:'approve-quote',id:f.draft.id})).rejects.toThrow('offering_unavailable');
    await db.regulatoryCredential.updateMany({where:{unitId:f.unit.id,credentialType:'sale_authority'},data:{verificationStatus:'verified'}});
    await adminAgentAction(db,f.admin.id,{action:'approve-quote',id:f.draft.id});
    const share=await agentAction(db,f.alice.id,f.a.id,'shares',{id:f.draft.id});
    const token=('path' in share?String(share.path):'').split('/').pop()!;
    await db.commercialOffering.update({where:{id:f.offering.id},data:{status:'paused'}});
    expect(await resolveAgentShare(db,token)).toBeNull();
  });
  it('keeps financial entitlements empty until there are approved agreements and verified finance records',async()=>{
    const f=await fixture();
    await agentAction(db,f.alice.id,f.a.id,'stage',{introductionId:f.intro.id,stage:'proposal'});
    await expect(agentAction(db,f.alice.id,f.a.id,'stage',{introductionId:f.intro.id,stage:'won'})).rejects.toThrow('invalid_stage');
    expect((await getAgentDashboard(db,f.alice.id,f.a.id,'en')).commissions).toEqual([]);
    expect(await db.agentAgreementVersion.count()).toBe(0);
    expect(await db.payout.count()).toBe(0);
  });
});
