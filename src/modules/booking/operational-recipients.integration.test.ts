import { beforeEach, describe, expect, it } from 'vitest';
import { db, resetDb, createIdentity, createProject, createUnit } from '@/test/util';
import { filterOperationalRecipients } from './operational-recipients';

describe('filterOperationalRecipients', () => {
  beforeEach(async()=>{ await resetDb(); });

  it('filters governed operators by exact unit assignment and capability', async()=>{
    const project=await createProject();
    const [unitA,unitB]=await Promise.all([
      createUnit({projectId:project.id,name:'A'}),
      createUnit({projectId:project.id,name:'B'}),
    ]);
    const [operatorA,operatorB,legacy]=await Promise.all([
      createIdentity({firstName:'Operator A'}),
      createIdentity({firstName:'Operator B'}),
      createIdentity({firstName:'Legacy'}),
    ]);
    const org=await db.organization.create({data:{
      name:'Ops',orgType:'management_company',projectId:project.id,
      contactEmail:'ops-filter@example.com',contactPhone:'+66000000005',
    }});
    const space=await db.operatingSpace.create({data:{key:'alert-space',name:'Alert Space',organizationId:org.id}});
    await Promise.all([
      db.operatingSpaceUnit.create({data:{operatingSpaceId:space.id,unitId:unitA.id}}),
      db.operatingSpaceUnit.create({data:{operatingSpaceId:space.id,unitId:unitB.id}}),
      db.operatingSpaceMember.create({data:{
        operatingSpaceId:space.id,identityId:operatorA.id,
        capabilities:['manage_reservations'],
      }}),
      db.operatingSpaceMember.create({data:{
        operatingSpaceId:space.id,identityId:operatorB.id,
        capabilities:['manage_reservations'],
      }}),
    ]);
    await Promise.all([
      db.operatingSpaceMemberUnit.create({data:{
        operatingSpaceId:space.id,identityId:operatorA.id,unitId:unitA.id,
      }}),
      db.operatingSpaceMemberUnit.create({data:{
        operatingSpaceId:space.id,identityId:operatorB.id,unitId:unitB.id,
      }}),
    ]);

    const recipients=await filterOperationalRecipients(
      db,unitA.id,[operatorA.id,operatorB.id,legacy.id],['manage_reservations'],
    );
    expect(recipients).toContain(operatorA.id);
    expect(recipients).toContain(legacy.id);
    expect(recipients).not.toContain(operatorB.id);
  });

  it('requires the requested capability for governed operators', async()=>{
    const project=await createProject();
    const unit=await createUnit({projectId:project.id});
    const operator=await createIdentity();
    const org=await db.organization.create({data:{
      name:'Ops 2',orgType:'management_company',projectId:project.id,
      contactEmail:'ops-filter-2@example.com',contactPhone:'+66000000006',
    }});
    const space=await db.operatingSpace.create({data:{key:'alert-space-2',name:'Alert Space 2',organizationId:org.id}});
    await db.operatingSpaceUnit.create({data:{operatingSpaceId:space.id,unitId:unit.id}});
    await db.operatingSpaceMember.create({data:{
      operatingSpaceId:space.id,identityId:operator.id,
      capabilities:['view_calendar'],
    }});
    await db.operatingSpaceMemberUnit.create({data:{
      operatingSpaceId:space.id,identityId:operator.id,unitId:unit.id,
    }});

    expect(await filterOperationalRecipients(db,unit.id,[operator.id],['record_payment'])).toEqual([]);
  });
});
