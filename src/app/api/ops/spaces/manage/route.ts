import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { OPERATING_SPACE_CAPABILITIES } from '@/modules/ops';

async function requireAdmin() {
  const user=await getCurrentUser();
  if(!user)return {error:NextResponse.json({error:'Unauthorized'},{status:401})};
  if(!user.isAdmin)return {error:NextResponse.json({error:'Forbidden'},{status:403})};
  return {user};
}

export async function GET(){
  const auth=await requireAdmin(); if(auth.error)return auth.error;
  const [spaces,organizations,units]=await Promise.all([
    prisma.operatingSpace.findMany({
      select:{
        id:true,key:true,name:true,organizationId:true,timezone:true,status:true,
        units:{where:{active:true},select:{unitId:true}},
        _count:{select:{members:{where:{active:true}},teams:{where:{active:true}}}},
      },
      orderBy:{name:'asc'},
    }),
    prisma.organization.findMany({
      where:{status:'active'},
      select:{id:true,name:true,orgType:true},
      orderBy:{name:'asc'},
    }),
    prisma.unit.findMany({
      where:{status:{in:['draft','live']}},
      select:{id:true,name:true,status:true,project:{select:{id:true,name:true}},inventoryCategory:{select:{name:true}}},
      orderBy:[{project:{name:'asc'}},{name:'asc'}],
    }),
  ]);
  return NextResponse.json({spaces,organizations,units,capabilities:OPERATING_SPACE_CAPABILITIES});
}

export async function POST(req:NextRequest){
  const auth=await requireAdmin(); if(auth.error)return auth.error;
  const body=await req.json().catch(()=>null) as {
    id?:string;key?:string;name?:string;organizationId?:string;timezone?:string;status?:string;unitIds?:string[];
  }|null;
  const name=(body?.name||'').trim();
  const key=(body?.key||'').trim().toLowerCase().replace(/[^a-z0-9_-]+/g,'-').replace(/^-+|-+$/g,'');
  const organizationId=body?.organizationId||'';
  const unitIds=Array.from(new Set(body?.unitIds||[]));
  if(!name||!key||!organizationId)return NextResponse.json({error:'Name, key and organization are required'},{status:400});
  if(!unitIds.length)return NextResponse.json({error:'Select at least one property'},{status:400});
  const [org,validUnits]=await Promise.all([
    prisma.organization.findUnique({where:{id:organizationId},select:{id:true,status:true}}),
    prisma.unit.findMany({where:{id:{in:unitIds}},select:{id:true}}),
  ]);
  if(!org||org.status!=='active')return NextResponse.json({error:'Organization not found'},{status:404});
  if(validUnits.length!==unitIds.length)return NextResponse.json({error:'One or more properties are invalid'},{status:400});

  try{
    const result=await prisma.$transaction(async(tx)=>{
      const space=body?.id
        ? await tx.operatingSpace.update({
            where:{id:body.id},
            data:{name,key,organizationId,timezone:body.timezone||'Asia/Bangkok',status:body.status||'active'},
          })
        : await tx.operatingSpace.create({
            data:{name,key,organizationId,timezone:body?.timezone||'Asia/Bangkok',status:'active'},
          });
      const existing=await tx.operatingSpaceUnit.findMany({
        where:{operatingSpaceId:space.id},
        select:{id:true,unitId:true,active:true},
      });
      const selected=new Set(unitIds);
      for(const row of existing){
        if(!selected.has(row.unitId)&&row.active){
          await tx.operatingSpaceUnit.update({where:{id:row.id},data:{active:false,endsOn:new Date()}});
        }
      }
      for(const unitId of unitIds){
        const row=existing.find(item=>item.unitId===unitId);
        if(row){
          if(!row.active)await tx.operatingSpaceUnit.update({where:{id:row.id},data:{active:true,endsOn:null,startsOn:new Date()}});
        }else{
          await tx.operatingSpaceUnit.create({data:{operatingSpaceId:space.id,unitId}});
        }
      }
      await tx.operatingSpaceMember.upsert({
        where:{operatingSpaceId_identityId:{operatingSpaceId:space.id,identityId:auth.user!.identityId}},
        create:{operatingSpaceId:space.id,identityId:auth.user!.identityId,capabilities:[...OPERATING_SPACE_CAPABILITIES],active:true},
        update:{capabilities:[...OPERATING_SPACE_CAPABILITIES],active:true},
      });
      return space;
    });
    return NextResponse.json({space:result},{status:body?.id?200:201});
  }catch(error){
    const message=error instanceof Error?error.message:'Operating space update failed';
    const status=/unique/i.test(message)?409:400;
    return NextResponse.json({error:message},{status});
  }
}
