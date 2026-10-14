import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { db, resetDb, createIdentity, createProject, createUnit } from '@/test/util';
import { registerReservationGuest, registeredReservationGuestIds, canUseReservationGuest } from './reservation-guests.service';
const current = vi.hoisted(()=>vi.fn());
vi.mock('@/app/actions/getCurrentUser',()=>({getCurrentUser:()=>current()}));
vi.mock('@/lib/prisma',async()=>({prisma:(await import('@/test/util')).db}));
import { POST } from '@/app/api/ops/reservation-guests/route';

async function fixture(){
  const founder=await createIdentity({isAdmin:true});
  const staff=await createIdentity();
  const project=await createProject();
  const unit=await createUnit({projectId:project.id});
  const organization=await db.organization.create({data:{name:'Guest fixture',orgType:'management_company',contactEmail:'operator@example.test',contactPhone:'+66000000000'}});
  await db.projectOrganizationRole.create({data:{projectId:project.id,organizationId:organization.id,roleKey:'operator',provenance:'verified'}});
  const space=await db.operatingSpace.create({data:{key:'guest-desk',name:'Guest desk',organizationId:organization.id}});
  await db.operatingSpaceUnit.create({data:{operatingSpaceId:space.id,unitId:unit.id}});
  return {founder,staff,project,unit,organization,space};
}
type Fixture=Awaited<ReturnType<typeof fixture>>;
const input=(f:Fixture)=>({operatingSpaceId:f.space.id,unitId:f.unit.id,firstName:'New',lastName:'Guest',email:' New.Guest@example.test ',phone:'+66 92 000 0001'});
async function staffGrant(f:Fixture){
  await db.roleAssignment.create({data:{identityId:f.staff.id,role:'staff_ops',scopeType:'project',projectId:f.project.id}});
  await db.projectStaffPermission.create({data:{identityId:f.staff.id,projectId:f.project.id,departments:['reservations']}});
  await db.operatingSpaceMember.create({data:{identityId:f.staff.id,operatingSpaceId:f.space.id,capabilities:['manage_reservations']}});
}
describe('Manual reservation contact registration without login or email side effects',()=>{
  beforeEach(async()=>{await resetDb();current.mockReset();});
  it('creates one contact, records scope and returns only safe fields, with no auth or grants',async()=>{
    const f=await fixture();const roles=await db.roleAssignment.count();
    const result=await registerReservationGuest(db,f.founder.id,input(f));
    expect(result.created).toBe(true);
    expect(Object.keys(result.guest).sort()).toEqual(['email','firstName','id','lastName','phone']);
    expect(result.guest).toMatchObject({email:'new.guest@example.test',phone:'+66920000001'});
    const row=await db.identity.findUniqueOrThrow({where:{id:result.guest.id}});
    expect(row.hashedPassword).toBeNull();expect(row.isAdmin).toBe(false);
    expect(row.emailVerifiedAt).toBeNull();expect(row.phoneVerifiedAt).toBeNull();
    expect(await db.authAccount.count({where:{identityId:row.id}})).toBe(0);
    expect(await db.oneTimeToken.count({where:{identityId:row.id}})).toBe(0);
    expect(await db.roleAssignment.count()).toBe(roles);
    expect(await registeredReservationGuestIds(db,f.space.id,[f.unit.id])).toEqual([row.id]);
    const audit=await db.auditLog.findFirstOrThrow({where:{entityId:row.id}});
    expect(audit.data).toEqual({operatingSpaceId:f.space.id,unitId:f.unit.id,created:true,invitationSent:false,accessGranted:false});
  });
  it('reuses exact contacts without overwriting names or making duplicate audits',async()=>{
    const f=await fixture();const first=await registerReservationGuest(db,f.founder.id,input(f));
    const before=await db.identity.findUnique({where:{id:first.guest.id}});
    const again=await registerReservationGuest(db,f.founder.id,{...input(f),firstName:'Do not overwrite'});
    expect(again.created).toBe(false);expect(again.guest.id).toBe(first.guest.id);
    expect(await db.identity.findUnique({where:{id:first.guest.id}})).toEqual(before);
    expect(await db.auditLog.count({where:{entityId:first.guest.id}})).toBe(1);
  });
  it('serializes two submissions of the same contact into one identity and one audit',async()=>{
    const f=await fixture();
    const results=await Promise.all([registerReservationGuest(db,f.founder.id,input(f)),registerReservationGuest(db,f.founder.id,input(f))]);
    expect(new Set(results.map(r=>r.guest.id)).size).toBe(1);
    expect(await db.identity.count({where:{email:'new.guest@example.test'}})).toBe(1);
    expect(await db.auditLog.count({where:{action:'reservation_guest:registered'}})).toBe(1);
  });
  it('does not merge contacts matching two different people',async()=>{
    const f=await fixture();
    await createIdentity({email:'new.guest@example.test'});
    await createIdentity({phone:'+66920000001'});
    const count=await db.identity.count();
    await expect(registerReservationGuest(db,f.founder.id,input(f))).rejects.toMatchObject({status:409});
    expect(await db.identity.count()).toBe(count);expect(await db.auditLog.count()).toBe(0);
  });
  it.each([{firstName:''},{lastName:''},{email:'bad',phone:''},{email:'',phone:'0920000001'},{email:'',phone:''},{email:'x'.repeat(255)}])('rejects invalid input %j without a write',async patch=>{
    const f=await fixture();const count=await db.identity.count();
    await expect(registerReservationGuest(db,f.founder.id,{...input(f),...patch})).rejects.toMatchObject({status:400});
    expect(await db.identity.count()).toBe(count);expect(await db.auditLog.count()).toBe(0);
  });
  it('supports phone-only contact without inventing an email',async()=>{
    const f=await fixture();const r=await registerReservationGuest(db,f.founder.id,{...input(f),email:''});
    expect(r.guest.email).toBeNull();
  });
  it('rejects stale founder status and unknown or inactive scope',async()=>{
    const f=await fixture();await db.identity.update({where:{id:f.founder.id},data:{status:'blocked'}});
    await expect(registerReservationGuest(db,f.founder.id,input(f))).rejects.toMatchObject({status:403});
    await expect(registerReservationGuest(db,f.staff.id,input(f))).rejects.toMatchObject({status:403});
    expect(await db.auditLog.count()).toBe(0);
  });
  it('restricts staff to current scope and refuses foreign existing contacts without disclosing them',async()=>{
    const f=await fixture();await staffGrant(f);
    const foreign=await createIdentity({email:'new.guest@example.test'});
    await expect(registerReservationGuest(db,f.staff.id,input(f))).rejects.toMatchObject({status:409});
    expect(await canUseReservationGuest(db,foreign.id,f.space.id,[f.unit.id],false)).toBe(false);
    expect(await db.auditLog.count()).toBe(0);
    const created=await registerReservationGuest(db,f.staff.id,{...input(f),email:'own-scope@example.test'});
    expect(await canUseReservationGuest(db,created.guest.id,f.space.id,[f.unit.id],false)).toBe(true);
    await db.projectStaffPermission.update({where:{projectId_identityId:{projectId:f.project.id,identityId:f.staff.id}},data:{departments:['housekeeping']}});
    await expect(registerReservationGuest(db,f.staff.id,{...input(f),email:'another@example.test'})).rejects.toMatchObject({status:403});
  });
  it('binds registration visibility to authorized units and rejects unattached units',async()=>{
    const f=await fixture();const sibling=await createUnit({projectId:f.project.id});
    const count=await db.identity.count();
    await expect(registerReservationGuest(db,f.founder.id,{...input(f),unitId:sibling.id})).rejects.toMatchObject({status:403});
    expect(await db.identity.count()).toBe(count);
    const created=await registerReservationGuest(db,f.founder.id,input(f));
    expect(await registeredReservationGuestIds(db,f.space.id,[sibling.id])).toEqual([]);
    expect(await registeredReservationGuestIds(db,f.space.id,[])).toEqual([]);
    expect(await canUseReservationGuest(db,created.guest.id,f.space.id,[sibling.id],false)).toBe(false);
    expect(await canUseReservationGuest(db,created.guest.id,f.space.id,[],false)).toBe(false);
  });
  it('rolls back a new contact if its audit fails',async()=>{
    const f=await fixture();const count=await db.identity.count();
    const failing=db.$extends({query:{auditLog:{async create(){throw new Error('AUDIT_FAILURE');}}}}) as unknown as typeof db;
    await expect(registerReservationGuest(failing,f.founder.id,input(f))).rejects.toThrow('AUDIT_FAILURE');
    expect(await db.identity.count()).toBe(count);
  });
  it('HTTP boundary rejects missing authentication and caller-supplied admin flags',async()=>{
    const f=await fixture();
    const req=()=>new NextRequest('http://localhost/api/ops/reservation-guests',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...input(f),actorId:f.founder.id,isAdmin:true})});
    current.mockResolvedValue(null);expect((await POST(req())).status).toBe(401);
    current.mockResolvedValue({identityId:f.staff.id,isAdmin:true});expect((await POST(req())).status).toBe(403);
    current.mockResolvedValue({identityId:f.founder.id});expect((await POST(req())).status).toBe(201);
  });
});
