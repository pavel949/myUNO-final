import type { PrismaClient } from '@prisma/client';

/**
 * OperatingSpace is an additional restriction for operational alerts.
 * Identities not governed by a space containing the unit retain legacy
 * project/unit-role behavior. Governed identities must have both the explicit
 * unit assignment (when configured) and one of the requested capabilities.
 */
export async function filterOperationalRecipients(
  db: PrismaClient,
  unitId: string,
  identityIds: Iterable<string>,
  capabilities: readonly string[],
): Promise<string[]> {
  const ids=Array.from(new Set(identityIds));
  if(!ids.length)return [];

  const memberships=await db.operatingSpaceMember.findMany({
    where:{
      identityId:{in:ids},
      active:true,
      operatingSpace:{
        status:'active',
        units:{some:{
          unitId,active:true,
          OR:[{endsOn:null},{endsOn:{gt:new Date()}}],
        }},
      },
    },
    select:{
      identityId:true,
      capabilities:true,
      operatingSpaceId:true,
      unitAssignments:{
        where:{unitId,active:true},
        select:{id:true},
      },
    },
  });
  const byIdentity=new Map<string,typeof memberships>();
  for(const membership of memberships){
    const rows=byIdentity.get(membership.identityId)||[];
    rows.push(membership);byIdentity.set(membership.identityId,rows);
  }

  return ids.filter(identityId=>{
    const governed=byIdentity.get(identityId);
    if(!governed?.length)return true;
    return governed.some(membership=>
      membership.unitAssignments.length>0 &&
      capabilities.some(capability=>membership.capabilities.includes(capability))
    );
  });
}
