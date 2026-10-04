import { NextRequest, NextResponse } from 'next/server';
import type { OperationalTaskType } from '@prisma/client';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getAuthorizedOperationalUnitIds } from '@/app/libs/projectScope';
import { prisma } from '@/lib/prisma';
import {
  createPreventiveMaintenancePlan,
  getOperatingSpaceMembership,
  getOperatingSpaceUnitIds,
  hasOperatingSpaceCapability,
} from '@/modules/ops';

async function authorizedSpaceUnitIds(
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>,
  operatingSpaceId: string,
) {
  const spaceIds=await getOperatingSpaceUnitIds(prisma,operatingSpaceId);
  if(user.isAdmin)return spaceIds;
  return getAuthorizedOperationalUnitIds(
    user,
    spaceIds,
    ['maintenance','housekeeping','front_desk','reservations'],
  );
}

export async function GET(req:NextRequest){
  const user=await getCurrentUser();
  if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
  const operatingSpaceId=req.nextUrl.searchParams.get('spaceId')||'';
  if(!operatingSpaceId)return NextResponse.json({error:'spaceId required'},{status:400});

  if(!user.isAdmin){
    const membership=await getOperatingSpaceMembership(prisma,operatingSpaceId,user.identityId);
    if(!membership?.active)return NextResponse.json({error:'Forbidden'},{status:403});
  }
  const plans=await prisma.preventiveMaintenancePlan.findMany({
    where:{operatingSpaceId},
    include:{
      unit:{select:{id:true,name:true,project:{select:{name:true}}}},
      project:{select:{id:true,name:true}},
      assignedTeam:{select:{id:true,name:true}},
      assignee:{select:{id:true,firstName:true,lastName:true}},
    },
    orderBy:[{active:'desc'},{nextDueAt:'asc'}],
  });
  return NextResponse.json({plans});
}

export async function POST(req:NextRequest){
  const user=await getCurrentUser();
  if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
  const body=await req.json() as {
    operatingSpaceId?:string;projectId?:string;unitId?:string;assignedTeamId?:string;
    assignedIdentityId?:string;taskType?:OperationalTaskType;title?:string;description?:string;
    frequencyDays?:number;nextDueAt?:string;estimatedCostThb?:number;blocksInventory?:boolean;
  };
  if(!body.operatingSpaceId||!body.title||!body.nextDueAt){
    return NextResponse.json({error:'Missing operating space, title or next due date'},{status:400});
  }
  if(!user.isAdmin){
    const can=await hasOperatingSpaceCapability(prisma,body.operatingSpaceId,user.identityId,'manage_maintenance');
    if(!can)return NextResponse.json({error:'Forbidden'},{status:403});
  }
  if(!user.isAdmin&&(body.assignedIdentityId||body.assignedTeamId)){
    const canAssign=await hasOperatingSpaceCapability(prisma,body.operatingSpaceId,user.identityId,'assign_tasks');
    if(!canAssign)return NextResponse.json({error:'Assignment forbidden'},{status:403});
  }

  const allowed=await authorizedSpaceUnitIds(user,body.operatingSpaceId);
  const affected=await prisma.unit.findMany({
    where:{
      id:{in:allowed},
      ...(body.unitId?{id:body.unitId}:{}),
      ...(body.projectId?{projectId:body.projectId}:{}),
    },
    select:{id:true,projectId:true},
  });
  if(!affected.length)return NextResponse.json({error:'No authorized units in plan scope'},{status:403});
  if(body.unitId&&!affected.some(unit=>unit.id===body.unitId)){
    return NextResponse.json({error:'Unit outside authorized scope'},{status:403});
  }

  try{
    const plan=await createPreventiveMaintenancePlan(prisma,{
      operatingSpaceId:body.operatingSpaceId,
      projectId:body.projectId||null,
      unitId:body.unitId||null,
      assignedTeamId:body.assignedTeamId||null,
      assignedIdentityId:body.assignedIdentityId||null,
      taskType:body.taskType||'preventive_maintenance',
      title:body.title,
      description:body.description||null,
      frequencyDays:Math.max(1,Number(body.frequencyDays||90)),
      nextDueAt:new Date(body.nextDueAt),
      estimatedCostSatang:body.estimatedCostThb==null?null:Math.round(Number(body.estimatedCostThb)*100),
      blocksInventory:Boolean(body.blocksInventory),
    });
    return NextResponse.json({plan},{status:201});
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:'Plan creation failed'},{status:400});
  }
}
