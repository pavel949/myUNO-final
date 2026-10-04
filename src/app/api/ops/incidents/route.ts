import { NextRequest, NextResponse } from 'next/server';
import type { IncidentSeverity, IncidentType } from '@prisma/client';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getAuthorizedOperationalUnitIds } from '@/app/libs/projectScope';
import { prisma } from '@/lib/prisma';
import { getOperatingSpaceMembership, getOperatingSpaceUnitIds, hasOperatingSpaceCapability } from '@/modules/ops';

async function scope(spaceId:string){
  const user=await getCurrentUser();
  if(!user)return {error:NextResponse.json({error:'Unauthorized'},{status:401})};
  const space=await prisma.operatingSpace.findUnique({where:{id:spaceId},select:{id:true,status:true}});
  if(!space||space.status!=='active')return {error:NextResponse.json({error:'Operating space not found'},{status:404})};
  if(!user.isAdmin){
    const membership=await getOperatingSpaceMembership(prisma,spaceId,user.identityId);
    const allowed=membership?.active&&(
      await hasOperatingSpaceCapability(prisma,spaceId,user.identityId,'manage_tasks')||
      await hasOperatingSpaceCapability(prisma,spaceId,user.identityId,'manage_maintenance')
    );
    if(!allowed)return {error:NextResponse.json({error:'Forbidden'},{status:403})};
  }
  const spaceUnitIds=await getOperatingSpaceUnitIds(prisma,spaceId);
  const unitIds=user.isAdmin?spaceUnitIds:await getAuthorizedOperationalUnitIds(user,spaceUnitIds,['maintenance','guest_care','front_desk','housekeeping']);
  return {user,unitIds};
}
export async function GET(req:NextRequest){
  const spaceId=req.nextUrl.searchParams.get('spaceId')||'';
  const scoped=await scope(spaceId);if(scoped.error)return scoped.error;
  const incidents=await prisma.incidentLog.findMany({
    where:{unitId:{in:scoped.unitIds}},
    include:{unit:{select:{id:true,name:true,project:{select:{name:true}}}},reportedBy:{select:{firstName:true,lastName:true}},assignedTo:{select:{firstName:true,lastName:true}}},
    orderBy:{createdAt:'desc'},take:100,
  });
  return NextResponse.json({incidents});
}
export async function POST(req:NextRequest){
  const body=await req.json().catch(()=>null) as {spaceId?:string;unitId?:string;incidentType?:IncidentType;severity?:IncidentSeverity;description?:string;assignedToIdentityId?:string|null}|null;
  const spaceId=body?.spaceId||'';const scoped=await scope(spaceId);if(scoped.error)return scoped.error;
  if(!body?.unitId||!scoped.unitIds?.includes(body.unitId))return NextResponse.json({error:'Unit outside authorized scope'},{status:403});
  const incidentTypes:IncidentType[]=['maintenance','complaint','violation'];
  const severities:IncidentSeverity[]=['low','medium','high','critical'];
  if(!body.incidentType||!incidentTypes.includes(body.incidentType)||!body.severity||!severities.includes(body.severity)||!body.description?.trim()){
    return NextResponse.json({error:'Type, severity and description are required'},{status:400});
  }
  if(body.assignedToIdentityId){
    const member=await prisma.operatingSpaceMember.findFirst({where:{operatingSpaceId:spaceId,identityId:body.assignedToIdentityId,active:true},select:{identityId:true}});
    if(!member)return NextResponse.json({error:'Assignee is outside this operating space'},{status:400});
  }
  const incident=await prisma.incidentLog.create({data:{
    unitId:body.unitId,incidentType:body.incidentType,severity:body.severity,description:body.description.trim(),
    reportedByIdentityId:scoped.user!.identityId,assignedToIdentityId:body.assignedToIdentityId||null,status:'open',
  }});
  return NextResponse.json({incident},{status:201});
}
