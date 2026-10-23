import {beforeEach,describe,it,expect,vi} from 'vitest';
import {NextRequest} from 'next/server';
import {db,resetDb,createIdentity,createProject,createUnit,createBooking,createBookingGuest} from '@/test/util';
const auth=vi.hoisted(()=>({identityId:''}));
vi.mock('@/app/actions/getCurrentUser',()=>({getCurrentUser:async()=>({identityId:auth.identityId,isAdmin:true,roles:[]})}));
vi.mock('@/lib/prisma',async()=>({prisma:(await import('@/test/util')).db}));
import {POST as checkIn} from './[id]/checkin/route';
import {POST as checkOut} from './[id]/check-out/route';
import {createConditionReport, getUnitReadinessMap} from '@/modules/ops';
import {PATCH as updateTask} from '@/app/api/ops/tasks/[id]/route';
beforeEach(resetDb);
async function fixture(status:'confirmed'|'checked_in'){
 const admin=await createIdentity({isAdmin:true}),guest=await createIdentity(),project=await createProject(),unit=await createUnit(project.id);auth.identityId=admin.id;
 const booking=await createBooking({unitId:unit.id,projectId:project.id,guestIdentityId:guest.id,status,adults:1,startDate:new Date(Date.now()-86400000),endDate:new Date(Date.now()+2*86400000)});
 await createBookingGuest({bookingId:booking.id,fullName:'Synthetic Guest',nationality:'RU',passportNumber:'SYNTHETIC'});return{admin,guest,booking,unit};
}
const req=(notes='Synthetic inspection',photoMediaIds:string[]=[])=>new NextRequest('http://localhost/api/bookings/synthetic/transition',{method:'POST',body:JSON.stringify({notes,photoMediaIds})});
describe('condition evidence commits with PMS transitions',()=>{
 it('keeps the next arrival blocked until both departure tasks are finished through the task API',async()=>{
  const f=await fixture('checked_in');
  const today=new Date(new Date().toISOString().slice(0,10));
  await db.booking.update({where:{id:f.booking.id},data:{
   startDate:new Date(today.getTime()-2*86400000),endDate:today,
  }});
  const next=await createBooking({unitId:f.unit.id,projectId:f.booking.projectId,
   guestIdentityId:f.guest.id,status:'confirmed',adults:1,startDate:today,
   endDate:new Date(today.getTime()+2*86400000)});
  await createBookingGuest({bookingId:next.id,fullName:'Synthetic next guest',nationality:'RU',passportNumber:'SYNTHETIC-NEXT'});
  expect((await checkOut(req(),{params:{id:f.booking.id}})).status).toBe(200);
  const tasks=await db.operationalTask.findMany({where:{bookingId:f.booking.id}});
  expect(tasks).toHaveLength(2);
  const arrive=()=>checkIn(req(),{params:{id:next.id}});
  const blocked=async()=>{
   const response=await arrive();
   expect(response.status).toBe(409);
   expect(await response.json()).toMatchObject({code:'UNIT_NOT_READY'});
   expect((await db.booking.findUniqueOrThrow({where:{id:next.id}})).status).toBe('confirmed');
   expect(await db.conditionReport.count({where:{bookingId:next.id}})).toBe(0);
   expect(await db.tm30Filing.count({where:{bookingId:next.id}})).toBe(0);
  };
  const advance=async(taskId:string,status:string)=>{
   const response=await updateTask(new NextRequest('http://localhost/api/ops/tasks/'+taskId,{
    method:'PATCH',body:JSON.stringify({status}),
   }),{params:{id:taskId}});
   expect(response.status).toBe(200);
  };
  await blocked();
  const cleaning=tasks.find(t=>t.taskType==='turnover_cleaning')!;
  const inspection=tasks.find(t=>t.taskType==='turnover_inspection')!;
  await advance(cleaning.id,'in_progress');
  await advance(cleaning.id,'ready');
  expect((await getUnitReadinessMap(db,[f.unit.id]))[f.unit.id].state).toBe('needs_inspection');
  await blocked();
  await advance(inspection.id,'in_progress');
  await advance(inspection.id,'inspected');
  await blocked();
  await advance(inspection.id,'ready');
  expect((await getUnitReadinessMap(db,[f.unit.id]))[f.unit.id]).toEqual({state:'ready',openTaskCount:0});
  expect((await arrive()).status).toBe(200);
  expect((await db.booking.findUniqueOrThrow({where:{id:next.id}})).status).toBe('checked_in');
  expect(await db.conditionReport.count({where:{bookingId:next.id,reportType:'check_in'}})).toBe(1);
  expect(await db.tm30Filing.count({where:{bookingId:next.id}})).toBe(1);
  expect(await db.operationalTask.count({where:{bookingId:f.booking.id}})).toBe(2);
 });
 it.each(['check_in','check_out'] as const)('%s does not commit if submitted media cannot persist',async kind=>{
  const f=await fixture(kind==='check_in'?'confirmed':'checked_in');const response=await(kind==='check_in'?checkIn:checkOut)(req('Submitted damage evidence',['synthetic-nonexistent-media']),{params:{id:f.booking.id}});
  expect(response.status).toBeGreaterThanOrEqual(400);const booking=await db.booking.findUniqueOrThrow({where:{id:f.booking.id}});expect(booking.status).toBe(kind==='check_in'?'confirmed':'checked_in');expect(await db.conditionReport.count()).toBe(0);expect(await db.conditionReportMedia.count()).toBe(0);expect(await db.operationalTask.count()).toBe(0);expect(await db.tm30Filing.count()).toBe(0);
 });
 it('direct canonical condition report rolls back its parent if an attachment fails',async()=>{const f=await fixture('confirmed');await expect(createConditionReport(db,{unitId:f.unit.id,bookingId:f.booking.id,reportType:'check_in',createdByIdentityId:f.admin.id,photoMediaIds:['synthetic-nonexistent-media']})).rejects.toThrow();expect(await db.conditionReport.count()).toBe(0);});
 it.each(['check_in','check_out'] as const)('%s persists submitted notes exactly once and retries do not duplicate evidence',async kind=>{const f=await fixture(kind==='check_in'?'confirmed':'checked_in');const run=()=> (kind==='check_in'?checkIn:checkOut)(req(),{params:{id:f.booking.id}});expect((await run()).status).toBe(200);expect((await run()).status).toBeGreaterThanOrEqual(400);const reports=await db.conditionReport.findMany();expect(reports).toHaveLength(1);expect(reports[0].notes).toContain('Synthetic inspection');expect(reports[0].reportType).toBe(kind);expect(await db.operationalTask.count()).toBe(kind==='check_out'?2:0);expect(await db.tm30Filing.count()).toBe(kind==='check_in'?1:0);});
 it('rejects a booking/unit mismatch before recording condition evidence',async()=>{const f=await fixture('confirmed'),other=await createUnit(f.booking.projectId);await expect(createConditionReport(db,{unitId:other.id,bookingId:f.booking.id,reportType:'check_out',createdByIdentityId:f.admin.id})).rejects.toThrow(/does not belong/);expect(await db.conditionReport.count()).toBe(0);});
 it.each(['check_in','check_out'] as const)('%s commits attached media with the transition',async kind=>{const f=await fixture(kind==='check_in'?'confirmed':'checked_in');const media=await db.mediaAsset.create({data:{storageKey:'synthetic-inspection-'+f.booking.id,kind:'photo',mimeType:'image/jpeg',sizeBytes:10,uploadedByIdentityId:f.admin.id}});const response=await(kind==='check_in'?checkIn:checkOut)(req('Synthetic evidence',[media.id]),{params:{id:f.booking.id}});expect(response.status).toBe(200);expect(await db.conditionReport.count()).toBe(1);expect(await db.conditionReportMedia.findFirst()).toMatchObject({mediaId:media.id,sort:0});});

});
