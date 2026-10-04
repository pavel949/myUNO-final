import { beforeEach, describe, expect, it } from 'vitest';
import { db, resetDb, createIdentity, createProject, createRoleAssignment, createUnit } from '@/test/util';
import { getAuthorizedOperationalUnitIds, getDepartmentProjectIds, hasProjectDepartmentAccess } from './projectScope';
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

  it('keeps a unit-scoped host inside the exact assigned property set',async()=>{
    const [project,identity]=await Promise.all([createProject(),createIdentity()]);
    const [unitA,unitB]=await Promise.all([
      createUnit({projectId:project.id,name:'Assigned'}),
      createUnit({projectId:project.id,name:'Neighbor'}),
    ]);
    await createRoleAssignment({identityId:identity.id,role:'onsite_host',scopeType:'unit',projectId:project.id,unitId:unitA.id});
    const user:CurrentUser={
      identityId:identity.id,email:identity.email,firstName:identity.firstName,lastName:identity.lastName,isAdmin:false,
      roles:[{role:'onsite_host',projectId:project.id,unitId:unitA.id,organizationId:null,providerId:null}],
    };
    expect(await getAuthorizedOperationalUnitIds(user,[unitA.id,unitB.id],['front_desk']))
      .toEqual([unitA.id]);
  });

  it('keeps management-company unit authority tied to the active engagement organization',async()=>{
    const [project,identity,owner]=await Promise.all([createProject(),createIdentity(),createIdentity()]);
    const [orgA,orgB]=await Promise.all([
      db.organization.create({data:{name:'MC A',orgType:'management_company',projectId:project.id}}),
      db.organization.create({data:{name:'MC B',orgType:'management_company',projectId:project.id}}),
    ]);
    const [unitA,unitB]=await Promise.all([
      createUnit({projectId:project.id,ownerIdentityId:owner.id,name:'A'}),
      createUnit({projectId:project.id,ownerIdentityId:owner.id,name:'B'}),
    ]);
    await Promise.all([
      db.unitEngagement.create({data:{unitId:unitA.id,ownerIdentityId:owner.id,engagementType:'via_management_company',managementOrgId:orgA.id,status:'active'}}),
      db.unitEngagement.create({data:{unitId:unitB.id,ownerIdentityId:owner.id,engagementType:'via_management_company',managementOrgId:orgB.id,status:'active'}}),
    ]);
    const user:CurrentUser={
      identityId:identity.id,email:identity.email,firstName:identity.firstName,lastName:identity.lastName,isAdmin:false,
      roles:[{role:'mc_member',projectId:project.id,unitId:null,organizationId:orgA.id,providerId:null}],
    };
    expect(await getAuthorizedOperationalUnitIds(user,[unitA.id,unitB.id])).toEqual([unitA.id]);
  });
});
