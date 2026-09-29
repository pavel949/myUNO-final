import { beforeEach, describe, expect, it } from 'vitest';
import { db, resetDb, createProject, createUnit, createIdentity, createBooking } from '@/test/util';

describe('canonical outbox is committed alongside every booking, inventory and money transition',()=>{
  beforeEach(async()=>resetDb());
  it('emits booking, payment and ledger events with identical canonical booking ID',async()=>{
    const project=await createProject({status:'live'});
    const unit=await createUnit({projectId:project.id,status:'live'});
    const guest=await createIdentity();
    const booking=await createBooking({
      unitId:unit.id,projectId:project.id,guestIdentityId:guest.id,status:'confirmed',
    });
    const created=await db.unifiedDomainEvent.findMany({where:{booking_id:booking.id}});
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({event_type:'booking.confirmed',entity_type:'Booking',
      project_id:project.id,unit_id:unit.id,booking_id:booking.id});
    const payment=await db.payment.create({data:{
      purpose:'stay',bookingId:booking.id,payerIdentityId:guest.id,
      method:'bank_transfer',provider:'bank_transfer',status:'succeeded',
      amountThb:10000,receiptRef:'test-receipt',receivedAt:new Date(),succeededAt:new Date(),
    }});
    await db.ledgerEntry.create({data:{
      entryType:'rental_revenue',unitId:unit.id,projectId:project.id,bookingId:booking.id,
      paymentId:payment.id,amountThb:10000,occurredOn:new Date(),description:'Test payment',
    }});
    const eventTypes=(await db.unifiedDomainEvent.findMany({where:{booking_id:booking.id},
      select:{event_type:true}})).map(e=>e.event_type).sort();
    expect(eventTypes).toEqual(['booking.confirmed','ledger.recorded','payment.succeeded']);
  });
  it('publishes manual block and release without copying inventory',async()=>{
    const project=await createProject({status:'live'});
    const unit=await createUnit({projectId:project.id,status:'live'});
    const block=await db.blockedDate.create({data:{
      unitId:unit.id,reason:'maintenance',startDate:new Date('2026-12-01'),
      endDate:new Date('2026-12-04'),
    }});
    let events=await db.unifiedDomainEvent.findMany({where:{entity_id:block.id},
      orderBy:{created_at:'asc'}});
    expect(events).toHaveLength(1);
    expect(events[0].event_type).toBe('inventory.block_changed');
    await db.blockedDate.delete({where:{id:block.id}});
    events=await db.unifiedDomainEvent.findMany({where:{entity_id:block.id}});
    expect(events).toHaveLength(2);
    expect(events.map(x=>x.event_type).sort()).toEqual(['inventory.block_changed','inventory.block_removed']);
  });
  it('does not create any outbox entry after transaction rollback',async()=>{
    const project=await createProject({status:'live'});
    const unit=await createUnit({projectId:project.id,status:'live'});
    const before=await db.unifiedDomainEvent.count();
    await expect(db.$transaction(async tx=>{
      await tx.blockedDate.create({data:{unitId:unit.id,reason:'owner_hold',
        startDate:new Date('2026-12-01'),endDate:new Date('2026-12-04')}});
      throw new Error('cancel commit');
    })).rejects.toThrow('cancel commit');
    expect(await db.unifiedDomainEvent.count()).toBe(before);
    expect(await db.blockedDate.count({where:{unitId:unit.id}})).toBe(0);
  });
});
