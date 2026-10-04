import { NextRequest, NextResponse } from 'next/server';
import type { IncidentStatus } from '@prisma/client';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getAuthorizedOperationalUnitIds } from '@/app/libs/projectScope';
import { prisma } from '@/lib/prisma';
import { getOperatingSpaceMembership, getOperatingSpaceUnitIds, hasOperatingSpaceCapability } from '@/modules/ops';

export async function PATCH(req:NextRequest,{params}:{params:{id:string}}){
  const user=await getCurrentUser();
  if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
  const body=await req.json().catch(()=>null) as {spaceId?:string;status?:IncidentStatus;resolutionNotes?:string;assignedToIdentityId?:string|null}|null;
  const spaceId=body?.spaceId||'';
  if(!spaceId)return NextResponse.json({error:'spaceId required'},{status:400});
  if(!user.isAdmin){
    const membership=await getOperatingSpaceMembership(prisma,spaceId,user.identityId);
    const allowed=membership?.active&&
      await hasOperatingSpaceCapability(prisma,spaceId,user.identityId,'manage_incidents');
    if(!allowed)return NextResponse.json({error:'Forbidden'},{status:403});
  }
  const spaceUnitIds=await getOperatingSpaceUnitIds(prisma,spaceId);
  const unitIds=user.isAdmin?spaceUnitIds:await getAuthorizedOperationalUnitIds(user,spaceUnitIds,['maintenance','guest_care','front_desk','housekeeping']);
  const incident=await prisma.incidentLog.findUnique({where:{id:params.id},select:{id:true,unitId:true}});
  if(!incident||!unitIds.includes(incident.unitId))return NextResponse.json({error:'Incident not found'},{status:404});
  const statuses:IncidentStatus[]=['open','acknowledged','in_progress','resolved','closed'];
  if(body?.status&&!statuses.includes(body.status))return NextResponse.json({error:'Invalid status'},{status:400});
  if(body?.assignedToIdentityId){
    const member=await prisma.operatingSpaceMember.findFirst({where:{operatingSpaceId:spaceId,identityId:body.assignedToIdentityId,active:true},select:{identityId:true}});
    if(!member)return NextResponse.json({error:'Assignee outside operating space'},{status:400});
  }
  const updated=await prisma.incidentLog.update({where:{id:incident.id},data:{
    ...(body?.status?{status:body.status}:{}),
    ...(body?.assignedToIdentityId!==undefined?{assignedToIdentityId:body.assignedToIdentityId}:{}),
    ...(body?.resolutionNotes!==undefined?{resolutionNotes:body.resolutionNotes.trim()||null}:{}),
    ...(body?.status==='resolved'?{resolvedAt:new Date()}:body?.status&&body.status!=='resolved'?{resolvedAt:null}:{}),
  }});
  return NextResponse.json({incident:updated});
}
