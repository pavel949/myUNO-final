import { beforeEach, describe, expect, it } from 'vitest';
import { db, resetDb, createIdentity, createProject, createUnit, createBooking } from '@/test/util';
import { createOpportunity } from './crm.service';
import {
  createPropertyDeal, updateDraftPropertyDeal, transitionPropertyDeal,
} from './property-deal.service';

describe('canonical sale and long-term lease agreement', () => {
  beforeEach(resetDb);
  async function fixture(kind: 'sale'|'long_term_rental') {
    const project=await createProject({status:'live'});
    const owner=await createIdentity();
    const customer=await createIdentity();
    const admin=await createIdentity({isAdmin:true});
    const unit=await createUnit({projectId:project.id,status:'live',ownerIdentityId:owner.id});
    const offer=await db.commercialOffering.create({data:{
      projectId:project.id,unitId:unit.id,offeringType:kind,status:'active',
    }});
    const crm=await createOpportunity(db,{
      identityId:customer.id,projectId:project.id,unitId:unit.id,
      type:kind==='sale'?'purchase':'rental',source:'test',
      title:'Canonical agreement acceptance',
    });
    const contract=await db.mediaAsset.create({data:{
      uploadedByIdentityId:admin.id,kind:'document',mimeType:'application/pdf',
      storageKey:'test-encrypted-contract-'+crm.id,sizeBytes:20,encrypted:true,
    }});
    const completion=await db.mediaAsset.create({data:{
      uploadedByIdentityId:admin.id,kind:'document',mimeType:'application/pdf',
      storageKey:'test-encrypted-completion-'+crm.id,sizeBytes:20,encrypted:true,
    }});
    const draft=()=>createPropertyDeal(db,{
      opportunityId:crm.id,offeringId:offer.id,unitId:unit.id,kind,
      amountSatang:kind==='sale'?12500000000:30000000,
      depositSatang:kind==='sale'?100000000:3000000,
      ...(kind==='long_term_rental'?{
        startsOn:new Date('2026-12-01'),endsOn:new Date('2027-12-01'),
      }:{}),
    });
    const advance=(nextStatus:'proposed'|'accepted'|'signed'|'closed'|'cancelled')=>
      transitionPropertyDeal(db,{
        opportunityId:crm.id,nextStatus,actorIdentityId:admin.id,
        ...(nextStatus==='signed'?{contractMediaId:contract.id}:{}),
        ...(nextStatus==='closed'?{completionMediaId:completion.id,
          settlementReference:'test-verified-settlement',handoverAt:new Date('2026-12-01')}:{}),
      });
    return {project,unit,owner,customer,admin,offer,crm,contract,completion,draft,advance};
  }

  it('handles a high-value villa sale without truncating money or fabricating title transfer',async()=>{
    const f=await fixture('sale');
    const deal=await f.draft();
    expect(deal.amountThb).toBe(12500000000n);
    await f.advance('proposed');
    await f.advance('accepted');
    await f.advance('signed');
    await f.advance('closed');
    const closed=await db.propertyDeal.findUniqueOrThrow({where:{id:deal.id}});
    expect(closed.status).toBe('closed');
    expect(closed.completionMediaId).toBe(f.completion.id);
    expect((await db.crmOpportunity.findUniqueOrThrow({where:{id:f.crm.id}})).stage).toBe('won');
    expect((await db.unit.findUniqueOrThrow({where:{id:f.unit.id}})).ownerIdentityId).toBe(f.owner.id);
    expect(await db.ownershipPeriod.count({where:{unitId:f.unit.id}})).toBe(0);
    expect(await db.payment.count()).toBe(0);
  });

  it('signing a lease blocks the exact physical unit and prevents a second overlapping lease',async()=>{
    const f=await fixture('long_term_rental');
    const deal=await f.draft();
    await f.advance('proposed');
    await f.advance('accepted');
    await f.advance('signed');
    const block=await db.blockedDate.findUniqueOrThrow({where:{propertyDealId:deal.id}});
    expect(block.reason).toBe('other');
    expect(block.unitId).toBe(f.unit.id);
    expect(block.startDate.toISOString().slice(0,10)).toBe('2026-12-01');
    expect(block.endDate.toISOString().slice(0,10)).toBe('2027-12-01');
    const customer2=await createIdentity();
    const crm2=await createOpportunity(db,{
      identityId:customer2.id,unitId:f.unit.id,projectId:f.project.id,
      type:'rental',source:'test',title:'Competing lease',
    });
    await createPropertyDeal(db,{
      opportunityId:crm2.id,offeringId:f.offer.id,unitId:f.unit.id,
      kind:'long_term_rental',amountSatang:20000000,
      startsOn:new Date('2027-01-01'),endsOn:new Date('2028-01-01'),
    });
    const args={opportunityId:crm2.id,actorIdentityId:f.admin.id};
    await transitionPropertyDeal(db,{...args,nextStatus:'proposed'});
    await transitionPropertyDeal(db,{...args,nextStatus:'accepted'});
    await expect(transitionPropertyDeal(db,{
      ...args,nextStatus:'signed',contractMediaId:f.contract.id,
    })).rejects.toThrow('lease_dates_unavailable');
    expect(await db.blockedDate.count({where:{propertyDealId:crm2.id}})).toBe(0);
    expect((await db.propertyDeal.findUniqueOrThrow({where:{opportunityId:crm2.id}})).status).toBe('accepted');
  });

  it('does not sign an occupied lease and preserves the existing booking',async()=>{
    const f=await fixture('long_term_rental');
    await f.draft();
    await createBooking({
      unitId:f.unit.id,projectId:f.project.id,guestIdentityId:f.customer.id,
      startDate:new Date('2027-01-01'),endDate:new Date('2027-01-05'),
      status:'confirmed',
    });
    await f.advance('proposed');await f.advance('accepted');
    await expect(f.advance('signed')).rejects.toThrow('lease_dates_unavailable');
    expect(await db.booking.count({where:{unitId:f.unit.id}})).toBe(1);
    expect(await db.blockedDate.count({where:{unitId:f.unit.id}})).toBe(0);
  });

  it('does not sign using a public image or edit an accepted agreement',async()=>{
    const f=await fixture('sale');
    await f.draft();await f.advance('proposed');await f.advance('accepted');
    const publicImage=await db.mediaAsset.create({data:{
      uploadedByIdentityId:f.admin.id,kind:'photo',mimeType:'image/jpeg',
      storageKey:'public-insecure-'+f.crm.id,sizeBytes:15,encrypted:false,
    }});
    await expect(transitionPropertyDeal(db,{
      opportunityId:f.crm.id,nextStatus:'signed',
      actorIdentityId:f.admin.id,contractMediaId:publicImage.id,
    })).rejects.toThrow('evidence_must_be_encrypted');
    await expect(updateDraftPropertyDeal(db,f.crm.id,{
      amountSatang:1000,
    })).rejects.toThrow('only_draft_agreements_are_editable');
    expect((await db.propertyDeal.findUniqueOrThrow({where:{opportunityId:f.crm.id}})).status)
      .toBe('accepted');
  });
});
