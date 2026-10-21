import { beforeEach,describe,it,expect,vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { db,resetDb,setGlobalConfig } from '@/test/util';
import { salesFixture,savedSalesFixture,approveSynthetic } from '@/test/sales-offer-fixture';
import { createOffer,readOffer,quoteOption,revalidateOffer,requestOfferBooking,searchOffers,guestProjection,sanitizeOption } from './offer.service';
import { issueOfferShare,viewOfferShare,revokeOfferShare } from './share.service';
import { parseStay,type GuestOption } from './contracts';
import { offerText } from './presentation';
import { salesDefaults } from '@/modules/content/sales-offer.seed';
import { tariffFingerprint } from './tariff-provenance';

describe('sales offer canonical vertical slice (synthetic PostgreSQL)',()=>{
  beforeEach(resetDb);
  it('withholds price for calculable but unreviewed inventory and isolates search',async()=>{
    const f=await salesFixture(false);const results=await searchOffers(db,f.actor.id,f.space.id,f.stay);
    expect(results.results.map(o=>o.unitId)).toEqual([f.unit.id]);expect(results.results[0]).toMatchObject({state:'review_required',price:null});
    await expect(searchOffers(db,f.stranger.id,f.space.id,f.stay)).rejects.toMatchObject({status:403});
    await expect(createOffer(db,f.actor.id,{...f.input,selections:[{unitId:f.foreign.id,stay:f.stay}]})).rejects.toMatchObject({code:'FORBIDDEN'});
  });
  it('freezes canonical itemization, rejects mutation and seals later option insertion',async()=>{
    const f=await savedSalesFixture();const offer=await readOffer(db,f.actor.id,f.saved.id);const dto=guestProjection(offer);
    expect(dto.options[0]).toMatchObject({state:'ready',ruleVersion:'SYNTHETIC-v1',price:{subtotal:300000,cleaning:20000,service:15000,tax:23450,total:358450}});
    await expect(db.salesOffer.update({where:{id:offer.id},data:{clientNote:'rewritten'}})).rejects.toThrow(/immutable/);
    await expect(db.salesOfferOption.update({where:{id:offer.options[0].id},data:{snapshot:{total:1}}})).rejects.toThrow(/immutable/);
    await expect(db.salesOfferOption.create({data:{offerId:offer.id,unitId:f.unit.id,position:1,fingerprint:'bad',snapshot:{}}})).rejects.toThrow(/same transaction/);
    await expect(db.salesOffer.create({data:{seriesId:randomUUID(),version:1,operatingSpaceId:f.space.id,createdByIdentityId:f.actor.id,expiresAt:new Date(Date.now()+100000),locale:'en',clientNote:'',salespersonName:'Test'}})).rejects.toThrow(/one to four/);
  });
  it('replays save and serializes competing revisions without duplicate history',async()=>{
    const f=await savedSalesFixture();expect(await createOffer(db,f.actor.id,f.input)).toEqual(f.saved);
    await expect(createOffer(db,f.actor.id,{...f.input,clientNote:'different'})).rejects.toMatchObject({code:'INTENT_CONFLICT'});
    const revisions=await Promise.allSettled([1,2].map(()=>createOffer(db,f.actor.id,{...f.input,previousId:f.saved.id,commandId:randomUUID()})));
    expect(revisions.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(await db.salesOffer.count()).toBe(2);
    await expect(revalidateOffer(db,f.actor.id,f.saved.id)).rejects.toMatchObject({code:'STALE_VERSION'});
  });
  it('invalidates tariff approval after any relevant config/rate change without rewriting history',async()=>{
    const f=await savedSalesFixture();await setGlobalConfig('pricing.cleaning_fee_thb',40000);
    expect((await quoteOption(db,f.unit.id,f.stay)).snapshot.price).toBeNull();
    await expect(revalidateOffer(db,f.actor.id,f.saved.id)).rejects.toMatchObject({code:'REVALIDATION_REQUIRED'});
    expect(guestProjection(await readOffer(db,f.actor.id,f.saved.id)).options[0].price?.total).toBe(358450);
    await approveSynthetic(f.unit.id,f.actor.id);expect((await quoteOption(db,f.unit.id,f.stay)).snapshot.price?.cleaning).toBe(40000);
  });
  it('handles revoked validation, occupancy changes and revoked staff scope',async()=>{
    const f=await savedSalesFixture();await db.salesTariffValidation.updateMany({data:{revokedAt:new Date()}});
    await expect(revalidateOffer(db,f.actor.id,f.saved.id)).rejects.toMatchObject({code:'REVALIDATION_REQUIRED'});
    await db.blockedDate.create({data:{unitId:f.unit.id,startDate:new Date(f.stay.startDate),endDate:new Date(f.stay.endDate),reason:'maintenance'}});
    expect((await quoteOption(db,f.unit.id,f.stay)).snapshot.state).toBe('unavailable');
    await db.operatingSpaceMember.updateMany({where:{identityId:f.actor.id},data:{active:false}});
    await expect(readOffer(db,f.actor.id,f.saved.id)).rejects.toMatchObject({status:403});
  });
  it('issues hash-only scoped shares, sanitizes recursively, rejects foreign revoke and expires/revokes',async()=>{
    const f=await savedSalesFixture();const share=await issueOfferShare(db,f.actor.id,f.saved.id,f.input.expiresAt);
    const stored=await db.salesOfferShare.findUniqueOrThrow({where:{id:share.id}});expect(JSON.stringify(stored)).not.toContain(share.token);expect(share.token).toHaveLength(43);
    const viewed=await viewOfferShare(db,share.token);expect(viewed.current).toBe(true);
    const payload=JSON.stringify(viewed);for(const secret of [f.guest.email,f.actor.email,stored.tokenHash,f.actor.id,'fingerprint','validationId','guestIdentityId'])expect(payload).not.toContain(secret);
    const raw={...viewed.offer.options[0],internalNotes:'DO_NOT_EXPOSE',net:1,price:{...viewed.offer.options[0].price!,commission:9}} as GuestOption;
    expect(JSON.stringify(sanitizeOption(raw))).not.toMatch(/DO_NOT_EXPOSE|commission|net/);
    await expect(revokeOfferShare(db,f.stranger.id,f.saved.id,share.id)).rejects.toMatchObject({status:403});
    await expect(viewOfferShare(db,share.token.slice(1))).rejects.toMatchObject({code:'NOT_FOUND'});
    await revokeOfferShare(db,f.actor.id,f.saved.id,share.id);await expect(viewOfferShare(db,share.token)).rejects.toMatchObject({code:'NOT_FOUND'});
    const expiring=await issueOfferShare(db,f.actor.id,f.saved.id,f.input.expiresAt);
    await db.salesOfferShare.update({where:{id:expiring.id},data:{createdAt:new Date(Date.now()-7200000),expiresAt:new Date(Date.now()-3600000)}});
    await expect(viewOfferShare(db,expiring.token)).rejects.toMatchObject({code:'NOT_FOUND'});
  });
  it('retains stale snapshot identity but disables public CTA after price/rule change',async()=>{
    const f=await savedSalesFixture();const share=await issueOfferShare(db,f.actor.id,f.saved.id,f.input.expiresAt);
    await db.inventoryCategory.update({where:{id:f.unit.inventoryCategoryId!},data:{baseNightlyThb:900000}});
    const publicView=await viewOfferShare(db,share.token);expect(publicView.current).toBe(false);expect(publicView.links).toEqual([]);expect(publicView.offer.version).toBe(1);
    await expect(issueOfferShare(db,f.actor.id,f.saved.id,f.input.expiresAt)).rejects.toMatchObject({code:'REVALIDATION_REQUIRED'});
  });
  it('creates one canonical request on concurrent retry, never confirms/holds/notifies, recovers after change',async()=>{
    const f=await savedSalesFixture();const option=(await readOffer(db,f.actor.id,f.saved.id)).options[0];
    const results=await Promise.all([1,2].map(()=>requestOfferBooking(db,f.actor.id,f.saved.id,option.id,f.guest.id)));
    expect(new Set(results.map(r=>r.id)).size).toBe(1);expect(await db.booking.count()).toBe(1);
    const booking=await db.booking.findFirstOrThrow();expect(booking).toMatchObject({status:'requested',totalThb:358450,holdExpiresAt:null});expect(await db.notification.count()).toBe(0);expect(booking.priceBreakdown).toMatchObject({sales_offer_reference:{offerId:f.saved.id,version:1,optionId:option.id}});
    await setGlobalConfig('pricing.cleaning_fee_thb',99999);
    expect((await requestOfferBooking(db,f.actor.id,f.saved.id,option.id,f.guest.id)).replayed).toBe(true);
    await expect(requestOfferBooking(db,f.actor.id,f.saved.id,option.id,f.stranger.id)).rejects.toMatchObject({code:'FORBIDDEN'});
  });
  it('refuses a newly stale request or a foreign option without touching bookings',async()=>{
    const f=await savedSalesFixture();const option=(await readOffer(db,f.actor.id,f.saved.id)).options[0];
    await expect(requestOfferBooking(db,f.actor.id,f.saved.id,randomUUID(),f.guest.id)).rejects.toMatchObject({code:'FORBIDDEN'});
    await db.salesTariffValidation.updateMany({data:{expiresAt:new Date(0)}});
    await expect(requestOfferBooking(db,f.actor.id,f.saved.id,option.id,f.guest.id)).rejects.toMatchObject({code:'REVALIDATION_REQUIRED'});
    expect(await db.booking.count()).toBe(0);
  });
  it('rejects an expired frozen offer and hides expired capabilities',async()=>{
    const f=await savedSalesFixture();const share=await issueOfferShare(db,f.actor.id,f.saved.id,f.input.expiresAt);
    vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date(Date.now()+7200000));
    try{await expect(revalidateOffer(db,f.actor.id,f.saved.id)).rejects.toMatchObject({code:'OFFER_EXPIRED'});await expect(viewOfferShare(db,share.token)).rejects.toMatchObject({code:'NOT_FOUND'});}
    finally{vi.useRealTimers();}
  });
  it('enforces expiry, strict dates, party validation and max alternatives',async()=>{
    const f=await salesFixture();await expect(createOffer(db,f.actor.id,{...f.input,expiresAt:new Date(0).toISOString()})).rejects.toMatchObject({code:'INVALID_EXPIRY'});
    expect(()=>parseStay({...f.stay,startDate:'2027-02-30'})).toThrow();expect(()=>parseStay({...f.stay,adults:1.2})).toThrow();
    await expect(createOffer(db,f.actor.id,{...f.input,selections:Array(5).fill(f.input.selections[0])})).rejects.toMatchObject({code:'INVALID_INPUT'});
  });
  it('reuses the canonical tariff grid across season boundaries without a desk calculator',async()=>{
    const f=await salesFixture(false);const year=new Date().getUTCFullYear()+1;const stay={...f.stay,startDate:year+'-06-29',endDate:year+'-07-03'};
    const row=(id:string,start:string,end:string,amount:number)=>({sourceRateId:id,seasonCode:id,dateWindows:[{start,end}],rateMode:'daily',pricingUnit:'night',amountSatang:amount,currency:'THB',minimumNights:1,includesTaxes:true,includesServiceCharge:true,includesBreakfast:false,sourceSellable:true});
    await db.commercialOffering.updateMany({where:{unitId:f.unit.id,offeringType:'short_term_stay'},data:{pricingTerms:{quoteEngine:'canonical_tariff_grid_v1',taxPolicyVerified:true,sourceSystem:'layantara_os',policyEngineVerified:true,tariffGrid:[row('A','01-01','06-30',100000),row('B','07-01','12-31',200000)]},rulesAndPolicies:{bookingPolicies:[{id:'synthetic-policy-v1',active:true,scope_type:'project',rate_mode:'daily',season_code:null,min_nights:1,confirmation_payment_type:'percentage',confirmation_payment_value:50,security_deposit_thb:3000,security_deposit_usd:0,cancellation_summary:'Synthetic cancellation policy',balance_timing:'Synthetic balance timing',stay_terms:'Synthetic stay terms',included:[],excluded:[],cancellation_steps:[{days:0,pct:0}]}]}}});
    await approveSynthetic(f.unit.id,f.actor.id);const quoted=await quoteOption(db,f.unit.id,stay);
    expect(quoted.snapshot.price?.nights.map(n=>n.amount)).toEqual([100000,100000,200000,200000]);expect(quoted.snapshot.price?.total).toBe(600000);expect(quoted.snapshot.terms?.securityDeposit).toEqual({thbSatang:300000,usdCents:0});
    expect(await tariffFingerprint(db,f.unit.id)).toHaveLength(64);
  });
  it('preserves a declared unsupported currency and never substitutes a THB firm price',async()=>{const f=await salesFixture(false);await db.commercialOffering.updateMany({where:{unitId:f.unit.id},data:{pricingTerms:{currency:'USD'}}});await approveSynthetic(f.unit.id,f.actor.id);expect((await quoteOption(db,f.unit.id,f.stay)).snapshot).toMatchObject({currency:'USD',state:'review_required',price:null});});
  it('keeps the same snapshot and disclaimer in RU/EN/TH text exports',async()=>{
    const f=await savedSalesFixture();const dto=guestProjection(await readOffer(db,f.actor.id,f.saved.id));
    for(const locale of ['en','ru','th'] as const){const text=offerText({...dto,locale},salesDefaults(locale));expect(text).toContain(dto.options[0].name);expect(text).toContain(salesDefaults(locale)['sales.disclaimer']);expect(text).not.toMatch(/fingerprint|IdentityId|SYNTHETIC.*email/);}
  });
  it('closes every new table to Supabase Data API roles',async()=>{
    const rows=await db.$queryRaw<{table_name:string;role_name:string;readable:boolean}[]>`SELECT t.table_name,r.role_name,has_table_privilege(r.role_name,t.table_name,'SELECT') AS readable FROM (VALUES ('sales_offer'),('sales_offer_option'),('sales_tariff_validation'),('sales_offer_share')) t(table_name) CROSS JOIN (VALUES ('anon'),('authenticated'),('service_role')) r(role_name)`;
    expect(rows).toHaveLength(12);expect(rows.every(r=>!r.readable)).toBe(true);
  });
});
