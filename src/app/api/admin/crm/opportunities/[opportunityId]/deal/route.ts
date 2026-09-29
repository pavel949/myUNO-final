import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { propertyDealJson } from '@/modules/crm/property-deal-serialization';
import { bahtToSatang } from '@/lib/money';
import { requireAdmin, failed } from '@/app/libs/onboardingGuard';
import {
  createPropertyDeal, updateDraftPropertyDeal,
  type PropertyDealKind, type PropertyDealChange,
} from '@/modules/crm/property-deal.service';
import type { Prisma } from '@prisma/client';

type Params={params:{opportunityId:string}};
const day=/^\d{4}-\d{2}-\d{2}$/;
function parseDate(value:unknown,field:string):Date|null{
  if(value===null||value===undefined||value==='')return null;
  if(typeof value!=='string'||!day.test(value))throw new Error('invalid_'+field);
  const d=new Date(value+'T00:00:00.000Z');
  if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==value)
    throw new Error('invalid_'+field);
  return d;
}
function money(value:unknown,field:string){
  if(value===undefined||value===null||value==='')throw new Error(field+'_required');
  const number=Number(value);
  if(!Number.isFinite(number))throw new Error('invalid_'+field);
  return bahtToSatang(number);
}
function terms(value:unknown):Prisma.InputJsonValue {
  if(typeof value!=='object'||value===null||Array.isArray(value))
    throw new Error('agreement_terms_must_be_an_object');
  const raw=JSON.stringify(value);
  if(raw.length>32768)throw new Error('agreement_terms_too_large');
  return JSON.parse(raw) as Prisma.InputJsonValue;
}

export async function GET(_req:NextRequest,{params}:Params){
  const guard=await requireAdmin();
  if(!guard.ok)return guard.error;
  const opportunity=await prisma.crmOpportunity.findUnique({
    where:{id:params.opportunityId},
    select:{id:true,unitId:true,projectId:true,type:true,stage:true,
      propertyDeal:{include:{
        offering:{select:{id:true,offeringType:true,status:true}},
        calendarBlock:{select:{id:true,startDate:true,endDate:true,reason:true}},
      }},
    },
  });
  return opportunity?NextResponse.json(propertyDealJson(opportunity)):
    NextResponse.json({error:'opportunity_not_found'},{status:404});
}

export async function POST(req:NextRequest,{params}:Params){
  const guard=await requireAdmin();
  if(!guard.ok)return guard.error;
  try{
    const body=await req.json() as Record<string,unknown>;
    const kind=body.kind as PropertyDealKind;
    if(!['sale','long_term_rental'].includes(kind))throw new Error('invalid_deal_kind');
    const deal=await createPropertyDeal(prisma,{
      opportunityId:params.opportunityId,
      offeringId:String(body.offeringId||''),
      unitId:String(body.unitId||''),
      kind,
      amountSatang:money(body.amountBaht,'amountBaht'),
      depositSatang:body.depositBaht===undefined?0:money(body.depositBaht,'depositBaht'),
      startsOn:parseDate(body.startsOn,'startsOn'),
      endsOn:parseDate(body.endsOn,'endsOn'),
      termsSnapshot:terms(body.termsSnapshot??{}),
    });
    return NextResponse.json(propertyDealJson(deal),{status:201});
  }catch(error){return failed(error,'Unable to create agreement');}
}

export async function PATCH(req:NextRequest,{params}:Params){
  const guard=await requireAdmin();
  if(!guard.ok)return guard.error;
  try{
    const body=await req.json() as Record<string,unknown>;
    const data:PropertyDealChange={};
    if(body.amountBaht!==undefined)data.amountSatang=money(body.amountBaht,'amountBaht');
    if(body.depositBaht!==undefined)data.depositSatang=money(body.depositBaht,'depositBaht');
    if(body.startsOn!==undefined)data.startsOn=parseDate(body.startsOn,'startsOn');
    if(body.endsOn!==undefined)data.endsOn=parseDate(body.endsOn,'endsOn');
    if(body.termsSnapshot!==undefined)data.termsSnapshot=terms(body.termsSnapshot);
    const deal=await updateDraftPropertyDeal(prisma,params.opportunityId,data);
    return NextResponse.json(propertyDealJson(deal));
  }catch(error){return failed(error,'Unable to edit agreement');}
}
