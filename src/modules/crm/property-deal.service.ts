import type { Prisma, PrismaClient } from '@prisma/client';
import { assertLayantaraBookingAuthority } from '@/modules/booking/source-authority';
import { lifecycleAfterWinForExisting } from './domain';
import { blockingBookingConditions } from '@/modules/core/booking-occupancy';

export type PropertyDealKind = 'sale' | 'long_term_rental';
export type PropertyDealStatus = 'draft' | 'proposed' | 'accepted' | 'signed' | 'closed' | 'cancelled';

export interface PropertyDealDraft {
  opportunityId: string; offeringId: string; unitId: string; kind: PropertyDealKind;
  amountSatang: number; depositSatang?: number; startsOn?: Date | null;
  endsOn?: Date | null; termsSnapshot?: Prisma.InputJsonValue;
}
export interface PropertyDealChange {
  amountSatang?: number; depositSatang?: number; startsOn?: Date | null;
  endsOn?: Date | null; termsSnapshot?: Prisma.InputJsonValue;
}
function validateMoney(amount: number, deposit: number) {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('positive_agreement_amount_required');
  if (!Number.isSafeInteger(deposit) || deposit < 0 || deposit > amount)
    throw new Error('invalid_agreement_deposit');
}
function validateDates(kind: string, start: Date | null, end: Date | null) {
  if (kind !== 'long_term_rental') return;
  if (!start || !end || !Number.isFinite(start.getTime()) ||
    !Number.isFinite(end.getTime()) || end <= start) throw new Error('valid_lease_date_range_required');
}

async function validateRefs(db: PrismaClient, input: PropertyDealDraft) {
  const [opportunity, offering, unit] = await Promise.all([
    db.crmOpportunity.findUnique({where:{id:input.opportunityId},
      select:{id:true,type:true,stage:true,unitId:true,projectId:true}}),
    db.commercialOffering.findUnique({where:{id:input.offeringId},
      select:{id:true,unitId:true,projectId:true,offeringType:true,status:true}}),
    db.unit.findUnique({where:{id:input.unitId},select:{id:true,projectId:true}}),
  ]);
  if (!opportunity || !offering || !unit) throw new Error('property_deal_reference_not_found');
  if (opportunity.unitId !== unit.id || offering.unitId !== unit.id ||
    offering.offeringType !== input.kind ||
    (opportunity.projectId && opportunity.projectId !== unit.projectId) ||
    (offering.projectId && offering.projectId !== unit.projectId))
    throw new Error('property_deal_reference_mismatch');
  if (input.kind === 'sale' && !['sale','purchase'].includes(opportunity.type))
    throw new Error('sale_opportunity_required');
  if (input.kind === 'long_term_rental' && opportunity.type !== 'rental')
    throw new Error('rental_opportunity_required');
  if (opportunity.stage === 'lost') throw new Error('lost_opportunity_cannot_be_contracted');
}
export async function createPropertyDeal(db: PrismaClient, input: PropertyDealDraft) {
  if (!['sale','long_term_rental'].includes(input.kind)) throw new Error('invalid_deal_kind');
  validateMoney(input.amountSatang,input.depositSatang??0);
  validateDates(input.kind,input.startsOn??null,input.endsOn??null);
  await validateRefs(db,input);
  return db.propertyDeal.create({data:{
    opportunityId:input.opportunityId,unitId:input.unitId,offeringId:input.offeringId,
    kind:input.kind,amountThb:BigInt(input.amountSatang),depositThb:BigInt(input.depositSatang??0),
    startsOn:input.kind==='long_term_rental'?input.startsOn:null,
    endsOn:input.kind==='long_term_rental'?input.endsOn:null,
    termsSnapshot:input.termsSnapshot??{},status:'draft',
  }});
}
export async function updateDraftPropertyDeal(db: PrismaClient, opportunityId:string,input:PropertyDealChange) {
  const deal=await db.propertyDeal.findUnique({where:{opportunityId}});
  if(!deal)throw new Error('property_deal_not_found');
  if(deal.status!=='draft')throw new Error('only_draft_agreements_are_editable');
  const amount=input.amountSatang??Number(deal.amountThb);
  const deposit=input.depositSatang??Number(deal.depositThb);
  validateMoney(amount,deposit);
  const startsOn=input.startsOn===undefined?deal.startsOn:input.startsOn;
  const endsOn=input.endsOn===undefined?deal.endsOn:input.endsOn;
  validateDates(deal.kind,startsOn,endsOn);
  return db.propertyDeal.update({where:{id:deal.id},data:{
    ...(input.amountSatang!==undefined&&{amountThb:BigInt(amount)}),
    ...(input.depositSatang!==undefined&&{depositThb:BigInt(deposit)}),
    ...(input.startsOn!==undefined&&{startsOn}),
    ...(input.endsOn!==undefined&&{endsOn}),
    ...(input.termsSnapshot!==undefined&&{termsSnapshot:input.termsSnapshot}),
  }});
}

async function assertPrivateEvidence(tx: Prisma.TransactionClient,mediaId:string|undefined,actor:string) {
  if(!mediaId)throw new Error('private_contract_evidence_required');
  const media=await tx.mediaAsset.findUnique({where:{id:mediaId},
    select:{id:true,encrypted:true,uploadedByIdentityId:true}});
  if(!media||!media.encrypted||media.uploadedByIdentityId!==actor)
    throw new Error('evidence_must_be_encrypted_and_uploaded_by_actor');
  return media.id;
}

async function claimLeaseDates(tx: Prisma.TransactionClient,deal:{
  id:string;unitId:string;startsOn:Date|null;endsOn:Date|null;
},actor:string) {
  if(!deal.startsOn||!deal.endsOn)throw new Error('lease_dates_required');
  await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))',deal.unitId);
  await assertLayantaraBookingAuthority(tx as unknown as PrismaClient,deal.unitId);
  const overlap={unitId:deal.unitId,startDate:{lt:deal.endsOn},endDate:{gt:deal.startsOn}};
  const [booking,block]=await Promise.all([
    tx.booking.findFirst({where:{...overlap,OR: blockingBookingConditions()},select:{id:true}}),
    tx.blockedDate.findFirst({where:overlap,select:{id:true}}),
  ]);
  if(booking||block)throw new Error('lease_dates_unavailable');
  await tx.blockedDate.create({data:{
    unitId:deal.unitId,startDate:deal.startsOn,endDate:deal.endsOn,
    reason:'other',note:'Signed long-term lease — protected canonical agreement',
    propertyDealId:deal.id,createdByIdentityId:actor,
  }});
}
export interface PropertyDealTransition {
  opportunityId:string; nextStatus:PropertyDealStatus; actorIdentityId:string;
  contractMediaId?:string;completionMediaId?:string;settlementReference?:string;
  handoverAt?:Date|null;
}
const nextStatuses:Record<PropertyDealStatus,PropertyDealStatus[]>={
  draft:['proposed','cancelled'],proposed:['accepted','cancelled'],
  accepted:['signed','cancelled'],signed:['closed'],closed:[],cancelled:[],
};
export async function transitionPropertyDeal(db:PrismaClient,input:PropertyDealTransition) {
  const deal=await db.propertyDeal.findUnique({where:{opportunityId:input.opportunityId}});
  if(!deal)throw new Error('property_deal_not_found');
  const current=deal.status as PropertyDealStatus;
  if(!nextStatuses[current]?.includes(input.nextStatus))throw new Error('invalid_property_deal_transition');
  const now=new Date();
  return db.$transaction(async tx=>{
    await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))',deal.id);
    const fresh=await tx.propertyDeal.findUniqueOrThrow({
      where:{id:deal.id},include:{opportunity:true},
    });
    if(fresh.status!==current)throw new Error('property_deal_changed_retry');
    if(input.nextStatus==='signed'){
      const offer=await tx.commercialOffering.findUnique({where:{id:fresh.offeringId},
        select:{unitId:true,offeringType:true,status:true}});
      if(!offer||offer.status!=='active'||offer.unitId!==fresh.unitId||
        offer.offeringType!==fresh.kind)throw new Error('active_matching_offering_required');
      await assertPrivateEvidence(tx,input.contractMediaId,input.actorIdentityId);
      if(fresh.kind==='long_term_rental')await claimLeaseDates(tx,fresh,input.actorIdentityId);
    }
    if(input.nextStatus==='closed'){
      await assertPrivateEvidence(tx,input.completionMediaId,input.actorIdentityId);
      if(!input.settlementReference?.trim()||!input.handoverAt||
        !Number.isFinite(input.handoverAt.getTime()))throw new Error('verified_settlement_and_handover_required');
      if(fresh.kind==='long_term_rental'&&!await tx.blockedDate.findUnique({
        where:{propertyDealId:fresh.id},select:{id:true},
      }))throw new Error('signed_lease_calendar_block_missing');
      // A commercial closing does not fabricate a payment or title transfer.
      // OwnershipPeriod must be updated separately after title verification.
    }
    if(input.nextStatus==='closed'){
      if(fresh.opportunity.stage==='lost')throw new Error('lost_opportunity_cannot_close');
      const existing=await tx.crmProfile.findUnique({
        where:{identityId:fresh.opportunity.identityId},select:{lifecycleStage:true},
      });
      const lifecycle=lifecycleAfterWinForExisting(fresh.opportunity.type,existing?.lifecycleStage??null);
      await tx.crmOpportunity.update({where:{id:fresh.opportunityId},data:{
        stage:'won',wonAt:now,lostAt:null,lostReason:null,probability:100,
      }});
      if(lifecycle)await tx.crmProfile.upsert({
        where:{identityId:fresh.opportunity.identityId},
        create:{identityId:fresh.opportunity.identityId,lifecycleStage:lifecycle},
        update:{lifecycleStage:lifecycle,lifecycleChangedAt:now,
          lifecycleChangeReason:'Verified commercial agreement closed; title requires separate evidence'},
      });
    }
    const updated=await tx.propertyDeal.update({where:{id:fresh.id},data:{
      status:input.nextStatus,
      ...(input.nextStatus==='accepted'&&{acceptedAt:now}),
      ...(input.nextStatus==='signed'&&{signedAt:now,contractMediaId:input.contractMediaId!}),
      ...(input.nextStatus==='closed'&&{
        closedAt:now,completionMediaId:input.completionMediaId!,
        settlementReference:input.settlementReference!.trim(),handoverAt:input.handoverAt!,
      }),
    }});
    await tx.crmActivity.create({data:{
      identityId:fresh.opportunity.identityId,opportunityId:fresh.opportunityId,
      createdByIdentityId:input.actorIdentityId,type:'system',status:'completed',
      subject:'Agreement status: '+current+' → '+input.nextStatus,
      completedAt:now,metadata:{propertyDealId:fresh.id,kind:fresh.kind},
    }});
    return updated;
  });
}
