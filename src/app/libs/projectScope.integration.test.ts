import { beforeEach, describe, expect, it } from 'vitest';
import { db, resetDb, createIdentity, createProject, createRoleAssignment } from '@/test/util';
import { getDepartmentProjectIds, hasProjectDepartmentAccess } from './projectScope';
import type { CurrentUser } from '@/app/actions/getCurrentUser';

describe('project-level team isolation',()=>{
  beforeEach(async()=>resetDb());
  it('separates resort and condominium operating teams and revocations',async()=>{
    const [resort,condo,identity]=await Promise.all([createProject(),createProject(),createIdentity()]);
    const role=await createRoleAssignment({identityId:identity.id,role:'staff_ops',scopeType:'project',projectId:resort.id});
    const user:CurrentUser={identityId:identity.id,email:identity.email,firstName:identity.firstName,lastName:identity.lastName,isAdmin:false,
      roles:[{role:'staff_ops',projectId:resort.id,unitId:null,organizationId:null,providerId:null}]};
    expect(await getDepartmentProjectIds(user,['reservations'])).toEqual([resort.id]);
    expect(await hasProjectDepartmentAccess(user,condo.id,'reservations')).toBe(false);
    await db.projectStaffPermission.create({data:{projectId:resort.id,identityId:identity.id,departments:['housekeeping']}});
    expect(await hasProjectDepartmentAccess(user,resort.id,'reservations')).toBe(false);
    expect(await hasProjectDepartmentAccess(user,resort.id,'housekeeping')).toBe(true);
    expect(await getDepartmentProjectIds(user,['reservations'])).toEqual([]);
    expect(await getDepartmentProjectIds(user,['housekeeping'])).toEqual([resort.id]);
    await db.roleAssignment.update({where:{id:role.id},data:{status:'revoked'}});
    const revoked:CurrentUser={...user,roles:[]};
    expect(await getDepartmentProjectIds(revoked,['housekeeping'])).toEqual([]);
    expect(await hasProjectDepartmentAccess(revoked,resort.id,'housekeeping')).toBe(false);
  });
});
