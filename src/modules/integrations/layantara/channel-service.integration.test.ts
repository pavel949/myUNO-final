import { beforeEach, describe, expect, it } from 'vitest';
import { db, resetDb, createProject, createUnit } from '@/test/util';
import { parseChannelEvent } from './channel-contract';
import { applyChannelEvent } from './channel-service';

describe('Layantara event ingestion: real transactional database', () => {
  beforeEach(async () => resetDb());

  async function setup(bookingAuthority:'source'|'myuno'='source') {
    const project=await createProject({status:'live'});
    const unit=await createUnit({projectId:project.id,status:'live'});
    const integrationActor=await db.identity.create({data:{firstName:'Source',lastName:'Integration'}});
    const system=await db.externalSystem.create({data:{
      system_key:'layantara',environment:'staging',display_name:'Layantara test',
      status:'active',config:{protectionEnabled:true,bookingAuthority,cutoverVerified:bookingAuthority==='myuno',integrationActorIdentityId:integrationActor.id},
    }});
    await db.externalMapping.create({data:{
      external_system_id:system.id,entity_type:'unit',external_id:'villa-G6',
      internal_id:unit.id,metadata:{verified:true,sourceCategory:'3BR_GRAND_DELUXE_G6_G7'},
    }});
    return {project,unit,system,integrationActor};
  }
  async function deliver(payload:Record<string,unknown>){
    const rawBody=JSON.stringify(payload);
    return applyChannelEvent(db,{rawBody,event:parseChannelEvent(payload),environment:'staging'});
  }
  const base={
    contractVersion:1,eventId:'occupancy-1',eventVersion:1,
    eventType:'occupancy.protect',externalBookingId:'occupancy:source-1',
    externalUnitId:'villa-G6',occupancyId:'source-1',occurredAt:'2026-09-28T08:00:00Z',
    startDate:'2026-10-22',endDate:'2026-10-26',blockReason:'ota_import',
  };

  it('enforces verified crosswalk and disabled source authority',async()=>{
    const {system,unit}=await setup();
    await db.externalMapping.updateMany({where:{external_system_id:system.id,entity_type:'unit'},
      data:{metadata:{verified:false}}});
    expect(await deliver(base)).toMatchObject({status:'quarantined',code:'unverified_unit_mapping'});
    expect(await db.blockedDate.count({where:{unitId:unit.id}})).toBe(0);
    expect(await deliver({...base,eventType:'booking.confirmed',eventId:'booking-without-authority',
      channel:'airbnb',guestExternalId:'guest-1',guestName:'Test Guest',adults:2,children:0,
      totalSatang:50000,currency:'THB'}))
      .toMatchObject({status:'quarantined',code:'authority_not_enabled'});
    expect(await db.booking.count({where:{unitId:unit.id}})).toBe(0);
  });

  it('protects once; exact replay and stale version do not duplicate inventory',async()=>{
    const {unit}=await setup();
    expect(await deliver(base)).toMatchObject({status:'processed'});
    expect(await deliver(base)).toMatchObject({status:'duplicate'});
    expect(await deliver({...base,eventId:'older-id'})).toMatchObject({status:'stale'});
    const blocks=await db.blockedDate.findMany({where:{unitId:unit.id}});
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({externalRef:'layantara:occupancy:source-1',reason:'ota_import'});
    expect(await db.booking.count({where:{unitId:unit.id}})).toBe(0);
  });

  it('does not allow direct booking over protected source occupancy',async()=>{
    const {unit,project}=await setup();
    await deliver(base);
    const guest=await db.identity.create({data:{firstName:'New',lastName:'Guest'}});
    const {createBooking}=await import('@/modules/booking');
    await expect(createBooking(db,{
      unitId:unit.id,projectId:project.id,guestIdentityId:guest.id,bookingType:'guest_stay',
      channel:'direct',startDate:new Date('2026-10-23'),endDate:new Date('2026-10-25'),
      adults:2,children:0,totalThb:100000,instantBook:true,
    })).rejects.toMatchObject({code:'DOUBLE_BOOK'});
  });

  it('prevents all local new booking writes and category allocation while source owns inventory',async()=>{
    const {unit,project,system}=await setup('source');
    const guest=await db.identity.create({data:{firstName:'Test',lastName:'Guest'}});
    const {createBooking,findAvailableUnitsForCategory}=await import('@/modules/booking');
    expect(await findAvailableUnitsForCategory(db,project.id,unit.categoryKey!,
      new Date('2026-11-20'),new Date('2026-11-22'))).toEqual([]);
    await expect(createBooking(db,{
      unitId:unit.id,projectId:project.id,guestIdentityId:guest.id,
      bookingType:'guest_stay',channel:'direct',startDate:new Date('2026-11-20'),
      endDate:new Date('2026-11-22'),adults:2,children:0,totalThb:100000,
      instantBook:true,
    })).rejects.toMatchObject({code:'DOUBLE_BOOK',blockReason:'source_authority'});
    await expect(db.booking.create({data:{
      unitId:unit.id,projectId:project.id,guestIdentityId:guest.id,bookingType:'guest_stay',
      channel:'direct',status:'confirmed',startDate:new Date('2026-11-20'),
      endDate:new Date('2026-11-22'),adults:2,children:0,totalThb:100000,
    }})).rejects.toThrow(/source-owned/i);
    await db.externalSystem.update({where:{id:system.id},
      data:{config:{protectionEnabled:true,bookingAuthority:'myuno',cutoverVerified:false}}});
    await expect(createBooking(db,{
      unitId:unit.id,projectId:project.id,guestIdentityId:guest.id,
      bookingType:'guest_stay',channel:'direct',startDate:new Date('2026-11-20'),
      endDate:new Date('2026-11-22'),adults:2,children:0,totalThb:100000,
      instantBook:true,
    })).rejects.toMatchObject({code:'DOUBLE_BOOK'});
  });

  it('releases matching source-only protection but not unrelated blocks',async()=>{
    const {unit}=await setup();
    await deliver(base);
    await db.blockedDate.create({data:{unitId:unit.id,reason:'maintenance',
      startDate:new Date('2026-10-30'),endDate:new Date('2026-11-02')}});
    expect(await deliver({...base,eventType:'occupancy.release',eventId:'release-2',
      eventVersion:2,occurredAt:'2026-09-28T09:00:00Z'})).toMatchObject({status:'processed'});
    const remaining=await db.blockedDate.findMany({where:{unitId:unit.id}});
    expect(remaining).toHaveLength(1);
    expect(remaining[0].reason).toBe('maintenance');
  });

  it('converts a matching protection into ONE booking and records money only on verified receipt',async()=>{
    const {unit,system}=await setup('myuno');
    await deliver(base);
    const bookingPayload={
      ...base,eventType:'booking.confirmed',eventId:'booking-2',eventVersion:2,
      occurredAt:'2026-09-28T09:00:00Z',channel:'airbnb',
      guestExternalId:'guest-1',guestName:'Test Guest',
      adults:2,children:0,totalSatang:450000,currency:'THB',
    };
    const first=await deliver(bookingPayload);
    expect(first).toMatchObject({status:'processed'});
    expect(first.bookingId).toBeTruthy();
    expect(await db.blockedDate.count({where:{unitId:unit.id}})).toBe(0);
    expect(await db.booking.count({where:{unitId:unit.id}})).toBe(1);
    expect(await db.payment.count({where:{bookingId:first.bookingId!}})).toBe(0);
    expect(await db.ledgerEntry.count({where:{bookingId:first.bookingId!}})).toBe(0);
    expect(await deliver(bookingPayload)).toMatchObject({status:'duplicate',bookingId:first.bookingId});
    expect(await deliver({...bookingPayload,eventType:'payment.received',eventId:'money-3',
      eventVersion:3,externalPaymentId:'operator-receipt-1',paymentSatang:250000,
      receiptRef:'bank-confirmation-1',settlement:'received_by_operator'}))
      .toMatchObject({status:'processed',bookingId:first.bookingId});
    expect(await db.payment.count({where:{bookingId:first.bookingId!}})).toBe(1);
    expect(await db.ledgerEntry.count({where:{bookingId:first.bookingId!}})).toBe(1);
    expect((await db.booking.findUniqueOrThrow({where:{id:first.bookingId!}})).balanceDueThb)
      .toBe(200000);
    expect(await db.externalMapping.count({where:{external_system_id:system.id,
      entity_type:'payment',external_id:'operator-receipt-1'}})).toBe(1);
  });

  it('does not silently overwrite immutable sold terms on later channel revisions',async()=>{
    const {integrationActor}=await setup('myuno');await deliver(base);
    const confirmed={...base,eventType:'booking.confirmed',eventId:'booking-2',eventVersion:2,
      channel:'airbnb',guestExternalId:'guest-1',guestName:'Test Guest',
      adults:2,children:0,totalSatang:450000,currency:'THB'};
    const first=await deliver(confirmed);
    const changed={...confirmed,eventType:'booking.changed',eventId:'booking-3',
      eventVersion:3,endDate:'2026-10-27',totalSatang:600000};
    const result=await deliver(changed);
    expect(result).toMatchObject({status:'processed',bookingId:first.bookingId});
    const booking=await db.booking.findUniqueOrThrow({where:{id:first.bookingId!}});
    expect(booking.totalThb).toBe(600000);
    expect(booking.priceBreakdown).toMatchObject({totalSatang:450000});
    const change=await db.bookingChange.findFirstOrThrow({where:{bookingId:first.bookingId!}});
    expect(change.actorIdentityId).toBe(integrationActor.id);
    expect(await db.ledgerEntry.count({where:{bookingId:first.bookingId!}})).toBe(0);
  });
});
