import {beforeEach,describe,it,expect} from 'vitest';
import {db,resetDb,createIdentity,createProject,createUnit,createBooking,createBookingGuest} from '@/test/util';
import {checkInBooking,checkOutBooking,cancelBooking} from './booking.service';
beforeEach(resetDb);
async function fixture(status:'confirmed'|'checked_in'='confirmed'){
 const project=await createProject(),unit=await createUnit(project.id),guest=await createIdentity();
 const booking=await createBooking({unitId:unit.id,projectId:project.id,guestIdentityId:guest.id,status,adults:1,startDate:new Date('2026-10-12'),endDate:new Date('2026-10-15')});
 await createBookingGuest({bookingId:booking.id,fullName:'Synthetic Guest',nationality:'TH',passportNumber:'SYNTHETIC'});
 return{project,unit,guest,booking};
}
function pauseFirstBookingRead(){
 let observed!:()=>void,release!:()=>void;const read=new Promise<void>(r=>{observed=r;}),resume=new Promise<void>(r=>{release=r;});let paused=false;
 const client=new Proxy(db,{get(target,key){if(key!=='booking')return Reflect.get(target,key);return new Proxy(target.booking,{get(model,method){if(method!=='findUnique')return Reflect.get(model,method);return async(...args:any[])=>{const result=await (model.findUnique as any)(...args);if(!paused){paused=true;observed();await resume;}return result;};}});}}) as typeof db;
 return{client,read,release};
}
describe('PMS source transition races',()=>{
 it.each(['turnover_cleaning','turnover_inspection'] as const)('blocks check-in while %s is blocked',async taskType=>{
  const f=await fixture();await db.operationalTask.create({data:{projectId:f.project.id,unitId:f.unit.id,bookingId:f.booking.id,taskType,status:'blocked',dueAt:new Date()}});
  await expect(checkInBooking(db,f.booking.id,new Date('2026-10-12T12:00:00Z'))).rejects.toMatchObject({code:'UNIT_NOT_READY'});expect((await db.booking.findUniqueOrThrow({where:{id:f.booking.id}})).status).toBe('confirmed');
 });
 it('does not revive a cancelled booking from a stale check-in read',async()=>{
  const f=await fixture(),barrier=pauseFirstBookingRead();const arrival=checkInBooking(barrier.client,f.booking.id,new Date('2026-10-12T12:00:00Z'));await barrier.read;
  await cancelBooking(db,{bookingId:f.booking.id,cancelledByIdentityId:f.guest.id,reason:'synthetic cancel',refundAmountThb:0});barrier.release();await expect(arrival).rejects.toThrow(/cancelled/);expect((await db.booking.findUniqueOrThrow({where:{id:f.booking.id}})).status).toBe('cancelled');
 });
 it('does not overwrite cancellation or create turnover from a stale checkout read',async()=>{
  const f=await fixture('checked_in'),barrier=pauseFirstBookingRead();const departure=checkOutBooking(barrier.client,f.booking.id);await barrier.read;
  await cancelBooking(db,{bookingId:f.booking.id,cancelledByIdentityId:f.guest.id,reason:'synthetic cancel',refundAmountThb:0});barrier.release();await expect(departure).rejects.toThrow(/cancelled/);expect(await db.operationalTask.count()).toBe(0);
 });
 it('a duplicate stale checkout cannot rewrite departure or turnover deadlines',async()=>{
  const f=await fixture('checked_in'),barrier=pauseFirstBookingRead(),firstAt=new Date('2026-10-14T10:00:00Z');const stale=checkOutBooking(barrier.client,f.booking.id,new Date('2026-10-14T11:00:00Z'));await barrier.read;
  await checkOutBooking(db,f.booking.id,firstAt);barrier.release();await expect(stale).rejects.toThrow(/checked_out/);expect((await db.booking.findUniqueOrThrow({where:{id:f.booking.id}})).checkedOutAt).toEqual(firstAt);expect((await db.operationalTask.findMany()).every(t=>t.dueAt.getTime()===firstAt.getTime())).toBe(true);
 });
});
