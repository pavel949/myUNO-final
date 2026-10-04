import { beforeEach,describe,expect,it } from 'vitest';
import { db,resetDb,createIdentity,createProject,createUnit,createBooking } from '@/test/util';
import { recordConfirmedStayInCrm } from './crm.service';

describe('confirmed stay CRM integration',()=>{
 beforeEach(async()=>resetDb());

 it('promotes an early-stage contact to guest and records an audited CRM interaction',async()=>{
  const [identity,project]=await Promise.all([createIdentity(),createProject()]);
  const unit=await createUnit({projectId:project.id});
  const booking=await createBooking({projectId:project.id,unitId:unit.id,guestIdentityId:identity.id,status:'confirmed'});
  await db.crmProfile.create({data:{identityId:identity.id,lifecycleStage:'prospect'}});
  const profile=await recordConfirmedStayInCrm(db,{identityId:identity.id,bookingId:booking.id,projectId:project.id,unitId:unit.id});
  expect(profile.lifecycleStage).toBe('guest');
  expect(profile.guestSince).not.toBeNull();
  expect(profile.lastInteractionAt).not.toBeNull();
  expect(await db.lifecycleTransitionLog.count({where:{profileId:profile.id,toStage:'guest'}})).toBe(1);
  expect(await db.crmActivity.count({where:{identityId:identity.id,subject:'Stay confirmed'}})).toBe(1);
 });

 it('does not downgrade a buyer relationship when a stay is confirmed',async()=>{
  const [identity,project]=await Promise.all([createIdentity(),createProject()]);
  const unit=await createUnit({projectId:project.id});
  const booking=await createBooking({projectId:project.id,unitId:unit.id,guestIdentityId:identity.id,status:'confirmed'});
  await db.crmProfile.create({data:{identityId:identity.id,lifecycleStage:'buyer'}});
  const profile=await recordConfirmedStayInCrm(db,{identityId:identity.id,bookingId:booking.id,projectId:project.id,unitId:unit.id});
  expect(profile.lifecycleStage).toBe('buyer');
  expect(profile.guestSince).not.toBeNull();
 });

 it('marks a returning guest as repeat without duplicating the confirmed-stay activity',async()=>{
  const [identity,project]=await Promise.all([createIdentity(),createProject()]);
  const unit=await createUnit({projectId:project.id});
  await createBooking({projectId:project.id,unitId:unit.id,guestIdentityId:identity.id,status:'checked_out',
    startDate:new Date('2026-01-01'),endDate:new Date('2026-01-05')});
  const booking=await createBooking({projectId:project.id,unitId:unit.id,guestIdentityId:identity.id,status:'confirmed',
    startDate:new Date('2026-11-01'),endDate:new Date('2026-11-05')});
  await db.crmProfile.create({data:{identityId:identity.id,lifecycleStage:'guest',guestSince:new Date('2026-01-01')}});
  await recordConfirmedStayInCrm(db,{identityId:identity.id,bookingId:booking.id,projectId:project.id,unitId:unit.id});
  await recordConfirmedStayInCrm(db,{identityId:identity.id,bookingId:booking.id,projectId:project.id,unitId:unit.id});
  const profile=await db.crmProfile.findUniqueOrThrow({where:{identityId:identity.id}});
  expect(profile.lifecycleStage).toBe('repeat');
  expect(await db.crmActivity.count({where:{identityId:identity.id,subject:'Stay confirmed'}})).toBe(1);
 });
});
