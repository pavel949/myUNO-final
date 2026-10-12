import {beforeEach,describe,it,expect,vi} from 'vitest';
import {NextRequest} from 'next/server';
import {db,resetDb,createIdentity,createProject,createUnit,createBooking,createBookingGuest} from '@/test/util';
const auth=vi.hoisted(()=>({identityId:''}));
vi.mock('@/app/actions/getCurrentUser',()=>({getCurrentUser:async()=>({identityId:auth.identityId,isAdmin:true,roles:[]})}));
vi.mock('@/lib/prisma',async()=>({prisma:(await import('@/test/util')).db}));
import {POST as checkIn} from './[id]/checkin/route';
import {POST as checkOut} from './[id]/check-out/route';
import {createConditionReport} from '@/modules/ops';
beforeEach(resetDb);
async function fixture(status:'confirmed'|'checked_in'){
 const admin=await createIdentity({isAdmin:true}),guest=await createIdentity(),project=await createProject(),unit=await createUnit(project.id);auth.identityId=admin.id;
 const booking=await createBooking({unitId:unit.id,projectId:project.id,guestIdentityId:guest.id,status,adults:1,startDate:new Date(Date.now()-86400000),endDate:new Date(Date.now()+2*86400000)});
 await createBookingGuest({bookingId:booking.id,fullName:'Synthetic Guest',nationality:'RU',passportNumber:'SYNTHETIC'});return{admin,guest,booking,unit};
}
const req=(notes='Synthetic inspection',photoMediaIds:string[]=[])=>new NextRequest('http://localhost/api/bookings/synthetic/transition',{method:'POST',body:JSON.stringify({notes,photoMediaIds})});
describe('condition evidence commits with PMS transitions',()=>{
 it.each(['check_in','check_out'] as const)('%s does not commit if submitted media cannot persist',async kind=>{
  const f=await fixture(kind==='check_in'?'confirmed':'checked_in');const response=await(kind==='check_in'?checkIn:checkOut)(req('Submitted damage evidence',['synthetic-nonexistent-media']),{params:{id:f.booking.id}});
  expect(response.status).toBeGreaterThanOrEqual(400);const booking=await db.booking.findUniqueOrThrow({where:{id:f.booking.id}});expect(booking.status).toBe(kind==='check_in'?'confirmed':'checked_in');expect(await db.conditionReport.count()).toBe(0);expect(await db.conditionReportMedia.count()).toBe(0);expect(await db.operationalTask.count()).toBe(0);expect(await db.tm30Filing.count()).toBe(0);
 });
 it('direct canonical condition report rolls back its parent if an attachment fails',async()=>{const f=await fixture('confirmed');await expect(createConditionReport(db,{unitId:f.unit.id,bookingId:f.booking.id,reportType:'check_in',createdByIdentityId:f.admin.id,photoMediaIds:['synthetic-nonexistent-media']})).rejects.toThrow();expect(await db.conditionReport.count()).toBe(0);});
 it.each(['check_in','check_out'] as const)('%s persists submitted notes exactly once and retries do not duplicate evidence',async kind=>{const f=await fixture(kind==='check_in'?'confirmed':'checked_in');const run=()=> (kind==='check_in'?checkIn:checkOut)(req(),{params:{id:f.booking.id}});expect((await run()).status).toBe(200);expect((await run()).status).toBeGreaterThanOrEqual(400);const reports=await db.conditionReport.findMany();expect(reports).toHaveLength(1);expect(reports[0].notes).toContain('Synthetic inspection');expect(reports[0].reportType).toBe(kind);expect(await db.operationalTask.count()).toBe(kind==='check_out'?2:0);expect(await db.tm30Filing.count()).toBe(kind==='check_in'?1:0);});
 it('rejects a booking/unit mismatch before recording condition evidence',async()=>{const f=await fixture('confirmed'),other=await createUnit(f.booking.projectId);await expect(createConditionReport(db,{unitId:other.id,bookingId:f.booking.id,reportType:'check_out',createdByIdentityId:f.admin.id})).rejects.toThrow(/does not belong/);expect(await db.conditionReport.count()).toBe(0);});
 it.each(['check_in','check_out'] as const)('%s commits attached media with the transition',async kind=>{const f=await fixture(kind==='check_in'?'confirmed':'checked_in');const media=await db.mediaAsset.create({data:{storageKey:'synthetic-inspection-'+f.booking.id,kind:'photo',mimeType:'image/jpeg',sizeBytes:10,uploadedByIdentityId:f.admin.id}});const response=await(kind==='check_in'?checkIn:checkOut)(req('Synthetic evidence',[media.id]),{params:{id:f.booking.id}});expect(response.status).toBe(200);expect(await db.conditionReport.count()).toBe(1);expect(await db.conditionReportMedia.findFirst()).toMatchObject({mediaId:media.id,sort:0});});

});
