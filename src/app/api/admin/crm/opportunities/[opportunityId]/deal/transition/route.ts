import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, failed } from '@/app/libs/onboardingGuard';
import {
  transitionPropertyDeal, type PropertyDealStatus,
} from '@/modules/crm/property-deal.service';

const statuses:PropertyDealStatus[]=['proposed','accepted','signed','closed','cancelled'];
export async function POST(req:NextRequest,{params}:{
  params:{opportunityId:string};
}){
  const guard=await requireAdmin();
  if(!guard.ok)return guard.error;
  try{
    const body=await req.json() as Record<string,unknown>;
    const nextStatus=body.nextStatus as PropertyDealStatus;
    if(!statuses.includes(nextStatus))throw new Error('invalid_deal_status');
    const handoverAt=body.handoverAt===undefined||body.handoverAt===null?null:
      new Date(String(body.handoverAt));
    if(handoverAt&&!Number.isFinite(handoverAt.getTime()))throw new Error('invalid_handover_date');
    const updated=await transitionPropertyDeal(prisma,{
      opportunityId:params.opportunityId,nextStatus,
      actorIdentityId:guard.actorIdentityId,
      contractMediaId:typeof body.contractMediaId==='string'?body.contractMediaId:undefined,
      completionMediaId:typeof body.completionMediaId==='string'?body.completionMediaId:undefined,
      settlementReference:typeof body.settlementReference==='string'?body.settlementReference:undefined,
      handoverAt,
    });
    return NextResponse.json(updated);
  }catch(error){
    const message=error instanceof Error?error.message:'invalid_transition';
    const code=message==='lease_dates_unavailable'||message==='property_deal_changed_retry'||
      message==='active_matching_offering_required'?409:
      message==='property_deal_not_found'?404:400;
    if(code===400)return failed(error,'Unable to transition agreement');
    return NextResponse.json({error:message},{status:code});
  }
}
