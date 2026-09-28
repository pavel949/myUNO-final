import type { Prisma, PrismaClient } from '@prisma/client';
import { channelPayloadHash, type ChannelEvent } from './channel-contract';

type Tx = Prisma.TransactionClient;
type Outcome = { status: 'processed'|'duplicate'|'stale'|'quarantined'; bookingId: string|null; code?: string };
const day=(s:string)=>new Date(s+'T00:00:00.000Z');
const externalKey=(environment:string,id:string)=>'layantara:'+environment+':'+id;
function verified(metadata:unknown) {
  return !!metadata && typeof metadata==='object' && !Array.isArray(metadata) &&
    (metadata as Record<string,unknown>).verified===true;
}
async function mapping(tx:Tx,systemId:string,type:string,id:string) {
  return tx.externalMapping.findFirst({where:{
    external_system_id:systemId,entity_type:type,external_id:id,
  }});
}
async function hasBookingConflict(tx:Tx,unitId:string,start:Date,end:Date,except?:string) {
  return tx.booking.findFirst({where:{
    unitId,...(except?{id:{not:except}}:{}),startDate:{lt:end},endDate:{gt:start},
    OR:[{status:{in:['confirmed','checked_in']}},{status:'pending_payment',holdExpiresAt:{gt:new Date()}}],
  },select:{id:true}});
}

/** Authoritative channel intake; all writes share existing Booking, BlockedDate,
 * Payment and LedgerEntry. Only activated, mapped systems may submit events. */
export async function applyChannelEvent(
  db:PrismaClient, input:{event:ChannelEvent;rawBody:string;environment:string},
):Promise<Outcome> {
  const {event:e,rawBody,environment}=input,hash=channelPayloadHash(rawBody);
  const system=await db.externalSystem.findFirst({
    where:{system_key:'layantara',environment,status:'active'},
  });
  if(!system)return{status:'quarantined',bookingId:null,code:'system_not_enabled'};
  const config=system.config as Record<string,unknown>;
  const protection=e.eventType==='occupancy.protect'||e.eventType==='occupancy.release';
  if((protection && config.protectionEnabled!==true) ||
     (!protection && (config.bookingAuthority!=='myuno'||config.cutoverVerified!==true))) {
    return{status:'quarantined',bookingId:null,code:'authority_not_enabled'};
  }

  return db.$transaction(async(tx)=>{
    // Version order is serialized per external reservation.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${system.id+':'+e.externalBookingId}))`;
    const prior=await tx.externalEventInbox.findFirst({where:{
      external_system_id:system.id,event_id:e.eventId,
    }});
    if(prior && prior.payload_hash!==hash)return{status:'quarantined',bookingId:null,code:'event_id_collision'};
    if(prior?.status==='processed'||prior?.status==='stale'){
      const existing=await mapping(tx,system.id,'booking',e.externalBookingId);
      return{status:'duplicate',bookingId:existing?.internal_id??null};
    }
    const inbox=prior??await tx.externalEventInbox.create({data:{
      external_system_id:system.id,event_id:e.eventId,aggregate_type:'booking',
      aggregate_external_id:e.externalBookingId,event_type:e.eventType,
      event_version:BigInt(e.eventVersion),occurred_at:new Date(e.occurredAt),
      payload:e as unknown as Prisma.InputJsonValue,payload_hash:hash,status:'received',
    }});
    const quarantine=async(code:string):Promise<Outcome>=>{
      await tx.externalEventInbox.update({where:{id:inbox.id},data:{
        status:'quarantined',error_code:code,processed_at:new Date(),
      }});
      return{status:'quarantined',bookingId:null,code};
    };
    const checkpoint=await tx.externalAggregateCheckpoint.findFirst({where:{
      external_system_id:system.id,aggregate_type:'booking',
      aggregate_external_id:e.externalBookingId,
    }});
    if(checkpoint?.last_event_version!==null && checkpoint?.last_event_version!==undefined &&
       BigInt(e.eventVersion)<=checkpoint.last_event_version){
      await tx.externalEventInbox.update({where:{id:inbox.id},data:{
        status:'stale',error_code:null,processed_at:new Date(),
      }});
      return{status:'stale',bookingId:null};
    }
    const unitMapping=await mapping(tx,system.id,'unit',e.externalUnitId);
    if(!unitMapping||!verified(unitMapping.metadata))return quarantine('unverified_unit_mapping');
    const unit=await tx.unit.findUnique({where:{id:unitMapping.internal_id},
      select:{id:true,projectId:true,inventoryCategoryId:true,status:true}});
    if(!unit||!unit.inventoryCategoryId||unit.status==='offboarded')return quarantine('unit_not_onboarded');
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${unit.id}))`;
    const bookingMapping=await mapping(tx,system.id,'booking',e.externalBookingId);
    let bookingId=bookingMapping?.internal_id??null;
    if(e.eventType==='occupancy.protect'){
      if(!e.occupancyId||!e.startDate||!e.endDate)return quarantine('invalid_source_interval');
      const ref='layantara:occupancy:'+e.occupancyId;
      const start=day(e.startDate),end=day(e.endDate);
      const previous=await tx.blockedDate.findFirst({where:{unitId:unit.id,externalRef:ref}});
      if(previous){
        if(previous.startDate.getTime()!==start.getTime()||previous.endDate.getTime()!==end.getTime())
          return quarantine('source_interval_changed');
      }else{
        const conflictBlock=await tx.blockedDate.findFirst({where:{
          unitId:unit.id,startDate:{lt:end},endDate:{gt:start},
        }});
        if(conflictBlock||await hasBookingConflict(tx,unit.id,start,end))return quarantine('inventory_conflict');
        await tx.blockedDate.create({data:{
          unitId:unit.id,startDate:start,endDate:end,reason:e.blockReason??'ota_import',externalRef:ref,
          note:'Layantara source protection; guest and finance reconciliation pending.',
        }});
      }
    }else if(e.eventType==='occupancy.release'){
      if(!e.occupancyId)return quarantine('missing_occupancy_identity');
      // Never let an imported cancellation unlock a verified canonical booking.
      if(bookingId)return quarantine('release_requires_booking_reconciliation');
      const ref='layantara:occupancy:'+e.occupancyId;
      const protectedRow=await tx.blockedDate.findFirst({
        where:{unitId:unit.id,externalRef:ref,reason:{in:['ota_import','owner_hold','maintenance','other']}},
      });
      if(protectedRow)await tx.blockedDate.delete({where:{id:protectedRow.id}});
    }else if(e.eventType==='booking.confirmed'||e.eventType==='booking.changed'){
      if(!e.startDate||!e.endDate||!e.channel||!e.guestExternalId||!e.guestName||
         e.adults===undefined||e.children===undefined||e.totalSatang===undefined||
         !Number.isSafeInteger(e.totalSatang)||e.currency!=='THB')
        return quarantine('invalid_booking_contract');
      if(unit.status!=='live')return quarantine('unit_not_sellable');
      if(e.eventType==='booking.changed'&&!bookingId)return quarantine('booking_mapping_missing');
      const start=day(e.startDate),end=day(e.endDate);
      if(await hasBookingConflict(tx,unit.id,start,end,bookingId??undefined))
        return quarantine('inventory_conflict');
      const ref=e.occupancyId?'layantara:occupancy:'+e.occupancyId:null;
      const blocks=await tx.blockedDate.findMany({where:{
        unitId:unit.id,startDate:{lt:end},endDate:{gt:start},
      }});
      if(blocks.some(b=>!ref||b.externalRef!==ref||
         b.startDate.getTime()!==start.getTime()||b.endDate.getTime()!==end.getTime()))
        return quarantine('unreconciled_inventory_block');
      if(bookingId){
        const current=await tx.booking.findUnique({where:{id:bookingId},include:{
          payments:{where:{status:'succeeded'},select:{amountThb:true,refunds:{
            where:{status:{in:['requested','processing','succeeded']}},select:{amountThb:true},
          }}},
        }});
        if(!current||current.unitId!==unit.id||current.projectId!==unit.projectId||
           current.channel!==e.channel)return quarantine('booking_identity_mismatch');
        if(!['confirmed','requested','pending_payment'].includes(current.status))
          return quarantine('invalid_booking_transition');
        const datesChanged=current.startDate.getTime()!==start.getTime()||
          current.endDate.getTime()!==end.getTime();
        const amountChanged=current.totalThb!==e.totalSatang;
        const partyChanged=current.adults!==e.adults||current.children!==e.children;
        if(e.eventType==='booking.confirmed' && (datesChanged||amountChanged||partyChanged))
          return quarantine('existing_booking_requires_change_event');
        if(datesChanged||amountChanged||partyChanged){
          // Attribute an OTA/source change to a dedicated integration identity,
          // never misrepresent the guest as the person who edited the stay.
          const actorId=config.integrationActorIdentityId;
          if(typeof actorId!=='string'||!actorId)return quarantine('integration_actor_missing');
          const actor=await tx.identity.findUnique({where:{id:actorId},select:{id:true}});
          if(!actor)return quarantine('integration_actor_missing');
          let balance=current.balanceDueThb, refund=current.refundAccruedThb;
          const difference=e.totalSatang-current.totalThb;
          if(difference>0){
            const offset=Math.min(difference,refund);
            refund-=offset;balance+=difference-offset;
          }else if(difference<0){
            let credit=-difference,offset=Math.min(credit,balance);
            balance-=offset;credit-=offset;
            const netPaid=current.payments.reduce((sum,p)=>
              sum+p.amountThb-p.refunds.reduce((r,x)=>r+x.amountThb,0),0);
            refund+=Math.min(credit,Math.max(0,netPaid-refund));
          }
          await tx.booking.update({where:{id:bookingId},data:{
            startDate:start,endDate:end,totalThb:e.totalSatang,
            adults:e.adults,children:e.children,status:'confirmed',
            balanceDueThb:balance,refundAccruedThb:refund,
          }});
          // The original price breakdown is immutable. Record the changed
          // external terms on a BookingChange, including their provenance.
          await tx.bookingChange.create({data:{
            bookingId,changeType:datesChanged?'dates':partyChanged?'party':'price',
            oldValue:{startDate:current.startDate.toISOString(),endDate:current.endDate.toISOString(),
              totalThb:current.totalThb,adults:current.adults,children:current.children},
            newValue:{startDate:start.toISOString(),endDate:end.toISOString(),
              totalThb:e.totalSatang,adults:e.adults,children:e.children,
              source:'layantara',eventId:e.eventId,sourceVersion:e.eventVersion},
            priceDeltaThb:difference,actorIdentityId:actor.id,
          }});
        }else if(current.status!=='confirmed'){
          await tx.booking.update({where:{id:bookingId},data:{status:'confirmed'}});
        }
        // A historical source block may predate a previously reconciled
        // booking. Remove it only when the source identity and exact interval
        // match; availability is never exposed between transactions.
        if(blocks.length)await tx.blockedDate.delete({where:{id:blocks[0].id}});
      }else{
        const guestMap=await mapping(tx,system.id,'guest',e.guestExternalId);
        let guestId=guestMap?.internal_id;
        if(!guestId){
          const words=e.guestName.trim().split(/\s+/);
          const guest=await tx.identity.create({data:{
            firstName:words[0],lastName:words.slice(1).join(' ')||'-',status:'invited',
          }});
          guestId=guest.id;
          await tx.externalMapping.create({data:{
            external_system_id:system.id,entity_type:'guest',internal_id:guest.id,
            external_id:e.guestExternalId,metadata:{verified:true,source:'signed_channel_event'},
          }});
        }
        if(blocks.length)await tx.blockedDate.delete({where:{id:blocks[0].id}});
        const created=await tx.booking.create({data:{
          unitId:unit.id,projectId:unit.projectId,guestIdentityId:guestId,
          bookingType:'external_ota',channel:e.channel,
          externalRef:externalKey(environment,e.externalBookingId),
          status:'confirmed',startDate:start,endDate:end,adults:e.adults,children:e.children,
          totalThb:e.totalSatang,balanceDueThb:e.totalSatang,
          priceBreakdown:{source:'layantara',externalBookingId:e.externalBookingId,
            currency:'THB',totalSatang:e.totalSatang,sourceVersion:e.eventVersion},
        }});
        bookingId=created.id;
        await tx.externalMapping.create({data:{
          external_system_id:system.id,entity_type:'booking',internal_id:created.id,
          external_id:e.externalBookingId,external_version:BigInt(e.eventVersion),
          metadata:{verified:true,channel:e.channel},
        }});
      }
    }else if(e.eventType==='booking.cancelled'){
      if(!bookingId)return quarantine('booking_mapping_missing');
      const current=await tx.booking.findUnique({where:{id:bookingId},select:{unitId:true,status:true}});
      if(!current||current.unitId!==unit.id)return quarantine('booking_identity_mismatch');
      if(['checked_in','checked_out','completed'].includes(current.status))
        return quarantine('occupied_booking_requires_manual_cancellation');
      if(current.status!=='cancelled')await tx.booking.update({where:{id:bookingId},data:{
        status:'cancelled',cancelledAt:new Date(e.occurredAt),
        cancellationReason:'Channel cancellation; financial settlement requires explicit evidence.',
        holdExpiresAt:null,requestExpiresAt:null,
      }});
    }else if(e.eventType==='payment.received'){
      if(!bookingId||!e.externalPaymentId||!e.paymentSatang||!e.receiptRef||
         e.settlement!=='received_by_operator')return quarantine('payment_evidence_missing');
      const booked=await tx.booking.findUnique({where:{id:bookingId},select:{
        id:true,unitId:true,projectId:true,guestIdentityId:true,totalThb:true,
      }});
      if(!booked||booked.unitId!==unit.id)return quarantine('booking_identity_mismatch');
      const previous=await mapping(tx,system.id,'payment',e.externalPaymentId);
      if(previous){
        const original=await tx.payment.findUnique({where:{id:previous.internal_id},
          select:{bookingId:true,amountThb:true,receiptRef:true,status:true}});
        if(original?.bookingId!==bookingId || original.amountThb!==e.paymentSatang ||
           original.receiptRef!==e.receiptRef || original.status!=='succeeded')
          return quarantine('payment_identity_or_amount_mismatch');
      }else{
        const payments=await tx.payment.findMany({where:{bookingId,status:'succeeded'},
          select:{amountThb:true}});
        const received=payments.reduce((sum,x)=>sum+x.amountThb,0);
        if(received+e.paymentSatang>booked.totalThb)return quarantine('payment_exceeds_total');
        const payment=await tx.payment.create({data:{
          purpose:received===0?'stay':'stay_balance',bookingId,
          payerIdentityId:booked.guestIdentityId,method:'bank_transfer',provider:'bank_transfer',
          amountThb:e.paymentSatang,receiptRef:e.receiptRef,
          status:'succeeded',succeededAt:new Date(e.occurredAt),receivedAt:new Date(e.occurredAt),
        }});
        await tx.ledgerEntry.create({data:{
          entryType:'rental_revenue',amountThb:e.paymentSatang,unitId:booked.unitId,
          projectId:booked.projectId,bookingId,paymentId:payment.id,
          occurredOn:new Date(e.occurredAt),
          description:'Verified channel funds '+e.externalPaymentId,
        }});
        await tx.externalMapping.create({data:{
          external_system_id:system.id,entity_type:'payment',internal_id:payment.id,
          external_id:e.externalPaymentId,external_version:BigInt(e.eventVersion),
          metadata:{verified:true,receiptRef:e.receiptRef},
        }});
        await tx.booking.update({where:{id:bookingId},data:{
          balanceDueThb:Math.max(0,booked.totalThb-received-e.paymentSatang),
        }});
      }
    }
    if(checkpoint){
      await tx.externalAggregateCheckpoint.updateMany({where:{
        external_system_id:system.id,aggregate_type:'booking',
        aggregate_external_id:e.externalBookingId,
      },data:{last_event_id:e.eventId,last_event_version:BigInt(e.eventVersion),
        last_occurred_at:new Date(e.occurredAt),updated_at:new Date()}});
    }else{
      await tx.externalAggregateCheckpoint.create({data:{
        external_system_id:system.id,aggregate_type:'booking',
        aggregate_external_id:e.externalBookingId,last_event_id:e.eventId,
        last_event_version:BigInt(e.eventVersion),last_occurred_at:new Date(e.occurredAt),
      }});
    }
    await tx.externalEventInbox.update({where:{id:inbox.id},data:{
      status:'processed',error_code:null,processed_at:new Date(),
    }});
    await tx.auditLog.create({data:{
      action:'channel.'+e.eventType,entityType:bookingId?'Booking':'BlockedDate',
      entityId:bookingId??e.occupancyId??e.externalBookingId,
      data:{systemId:system.id,eventId:e.eventId,eventVersion:e.eventVersion,
        unitId:unit.id,bookingId,externalBookingId:e.externalBookingId},
    }});
    return{status:'processed',bookingId};
  },{timeout:15000,maxWait:10000});
}
