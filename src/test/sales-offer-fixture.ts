import { db,createIdentity,createProject,createUnit,setGlobalConfig } from './util';
import { tariffFingerprint } from '@/modules/sales-offers/tariff-provenance';
import { createOffer } from '@/modules/sales-offers/offer.service';
import { randomUUID } from 'node:crypto';
export async function salesFixture(approved=true) {
  const actor=await createIdentity({firstName:'Synthetic',lastName:'Salesperson'});
  const guest=await createIdentity({firstName:'Private',lastName:'Guest'});
  const stranger=await createIdentity();
  const project=await createProject({status:'live',name:'Synthetic Bay'});
  const unit=await createUnit({projectId:project.id,status:'live',baseNightlyThb:100000,maxGuests:6,instantBook:true,name:'Synthetic Villa'});
  const foreignProject=await createProject({status:'live'});
  const foreign=await createUnit({projectId:foreignProject.id,status:'live',baseNightlyThb:200000,name:'Foreign Villa'});
  const org=await db.organization.create({data:{name:'Synthetic Operator',orgType:'management_company',contactEmail:'synthetic@example.test',contactPhone:'+66000000000'}});
  await db.projectOrganizationRole.create({data:{projectId:project.id,organizationId:org.id,roleKey:'operator',provenance:'verified'}});
  const space=await db.operatingSpace.create({data:{key:randomUUID(),name:'Synthetic Sales Space',organizationId:org.id}});
  await db.operatingSpaceUnit.create({data:{operatingSpaceId:space.id,unitId:unit.id,startsOn:new Date(Date.now()-86400000)}});
  await db.operatingSpaceMember.create({data:{operatingSpaceId:space.id,identityId:actor.id,capabilities:['manage_reservations']}});
  await db.roleAssignment.create({data:{identityId:actor.id,role:'staff_ops',scopeType:'project',projectId:project.id}});
  await db.projectStaffPermission.create({data:{projectId:project.id,identityId:actor.id,departments:['reservations']}});
  await db.auditLog.create({data:{actorIdentityId:actor.id,action:'reservation_guest:registered',entityType:'Identity',entityId:guest.id,data:{operatingSpaceId:space.id,unitId:unit.id}}});
  await setGlobalConfig('cancellation.default_policy','moderate');
  await setGlobalConfig('cancellation.policy.moderate',[{days:7,pct:100},{days:0,pct:0}]);
  await setGlobalConfig('pricing.cleaning_fee_thb',20000);
  await setGlobalConfig('pricing.guest_service_fee_pct',5);
  await setGlobalConfig('finance.occupancy_tax_pct',7);
  const startDate=new Date(Date.now()+30*86400000).toISOString().slice(0,10);
  const endDate=new Date(Date.parse(startDate)+3*86400000).toISOString().slice(0,10);
  const stay={startDate,endDate,adults:2,children:1,pets:0};
  const input={spaceId:space.id,commandId:randomUUID(),selections:[{unitId:unit.id,stay}],locale:'en' as const,expiresAt:new Date(Date.now()+3600000).toISOString(),clientNote:'For your holiday'};
  if(approved)await approveSynthetic(unit.id,actor.id);
  return {actor,guest,stranger,project,unit,foreign,space,org,stay,input};
}
export async function approveSynthetic(unitId:string,reviewerId:string) {
  return db.salesTariffValidation.create({data:{unitId,fingerprint:await tariffFingerprint(db,unitId),ruleVersion:'SYNTHETIC-v1',evidenceRef:'synthetic:approved-fixture-only',reviewedByIdentityId:reviewerId,
    validFrom:new Date(),validThrough:new Date(Date.now()+366*86400000),expiresAt:new Date(Date.now()+86400000),currency:'THB'}});
}
export async function savedSalesFixture() {
  const f=await salesFixture();const saved=await createOffer(db,f.actor.id,f.input);return {...f,saved};
}
