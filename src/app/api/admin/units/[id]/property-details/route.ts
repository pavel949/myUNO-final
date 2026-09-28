import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, failed } from '@/app/libs/onboardingGuard';
import { bahtToSatang } from '@/lib/money';
import { evaluateCommercialEligibility } from '@/modules/compliance/commercial-eligibility.engine';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;
  const unit = await prisma.unit.findUnique({
    where: { id: params.id },
    include: {
      sleepingSpaces: { include: { beds: true }, orderBy: { sortOrder: 'asc' } },
      commercialOfferings: { include: { channelMappings: true } },
      inventoryCategory: true,
      media: { include: { media: true }, orderBy: { sort: 'asc' } },
    },
  });
  return unit ? NextResponse.json(unit) : NextResponse.json({ error: 'Unit not found' }, { status: 404 });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;
  try {
    const body = await req.json();
    if (body.action === 'physical_facts') {
      const current=await prisma.unit.findUnique({where:{id:params.id},select:{id:true}});
      if(!current)throw new Error('Home not found');
      const areaKeys=['usableAreaSqm','grossAreaSqm','outdoorAreaSqm','plotAreaSqm','balconyAreaSqm'] as const;
      const areas:Record<string,number|null>={};
      for(const key of areaKeys){
        const value=body[key];
        if(value===undefined)continue;
        if(value===null||value===''){areas[key]=null;continue;}
        const parsed=Number(value);
        if(!Number.isFinite(parsed)||parsed<0||parsed>1000000)throw new Error('Invalid '+key);
        areas[key]=parsed;
      }
      const accepted=['fully_furnished','part_furnished','unfurnished'];
      if(body.furnishingStatus && !accepted.includes(body.furnishingStatus))throw new Error('Invalid furnishing');
      if(body.privacyType && !['entire_place','private_room'].includes(body.privacyType))throw new Error('Invalid privacy');
      const cleanList=(items:unknown)=>Array.isArray(items)?items.filter((x):x is string=>typeof x==='string').map(x=>x.trim().slice(0,80)).filter(Boolean).slice(0,40):[];
      const unit=await prisma.unit.update({where:{id:params.id},data:{
        ...areas,
        ...(body.floor!==undefined?{floor:String(body.floor||'').trim().slice(0,60)||null}:{}),
        ...(body.furnishingStatus!==undefined?{furnishingStatus:body.furnishingStatus||null}:{}),
        ...(body.privacyType!==undefined?{privacyType:body.privacyType||null}:{}),
        ...(body.accommodationType!==undefined?{accommodationType:String(body.accommodationType||'').trim().slice(0,80)||null}:{}),
        ...(body.unitFeatures!==undefined?{unitFeatures:cleanList(body.unitFeatures)}:{}),
        ...(body.views!==undefined?{views:cleanList(body.views)}:{}),
      }});
      return NextResponse.json(unit);
    }
    if (body.action === 'commercial_offering') {
      const type=String(body.offeringType||'');
      const cadence=type==='short_term_stay'?'night':type==='long_term_rental'?'month':type==='sale'?'once':null;
      if(!cadence) throw new Error('Offering must be short_stay, long_stay or sale');
      const status=body.status||'draft';
      if(!['draft','active','paused'].includes(status)) throw new Error('Invalid offering status');
      const amount=Number(body.priceBaht);
      if(!Number.isFinite(amount)||amount<=0)throw new Error('Enter a positive offer price in THB');
      const unit=await prisma.unit.findUnique({where:{id:params.id},
        select:{id:true,projectId:true,name:true,status:true,project:{select:{status:true}}}});
      if(!unit)throw new Error('Home not found');
      if(status==='active'&&(unit.status!=='live'||unit.project.status!=='live'))throw new Error('Complete the property and home readiness checks before publishing an offer');
      if(status==='active'){
        const eligibility=await evaluateCommercialEligibility(prisma,{unitId:unit.id,offeringType:type as 'short_term_stay'|'long_term_rental'|'sale'});
        if(!eligibility.eligible)throw new Error('Cannot publish this offer: '+eligibility.blockingReasons.join(', '));
      }
      const priceSatang=bahtToSatang(amount);
      const minimum=Number(body.minimumStay||1);
      if(type!=='sale'&&(!Number.isInteger(minimum)||minimum<1||minimum>3650))throw new Error('Minimum stay must be 1–3650');
      const pricingTerms={currency:'THB',amountSatang:priceSatang,cadence,
        ...(type!=='sale'?{minimumStay:minimum}:{}),
        ...(body.depositBaht!==undefined&&body.depositBaht!==''?{depositSatang:bahtToSatang(Number(body.depositBaht))}:{}),
        ...(type==='long_term_rental'?{utilitiesIncluded:body.utilitiesIncluded===true}:{}),
        ...(type==='sale'&&body.tenure?{tenure:String(body.tenure)}:{})};
      const existing=await prisma.commercialOffering.findFirst({where:{unitId:unit.id,offeringType:type},select:{id:true}});
      const offering=existing?await prisma.commercialOffering.update({where:{id:existing.id},
        data:{status,pricingTerms,rulesAndPolicies:{notes:String(body.notes||'')},ownershipTenure:type==='sale'?{tenure:String(body.tenure||'unspecified')}:{}}
      }):await prisma.commercialOffering.create({data:{projectId:unit.projectId,unitId:unit.id,offeringType:type,status,
        pricingTerms,rulesAndPolicies:{notes:String(body.notes||'')},ownershipTenure:type==='sale'?{tenure:String(body.tenure||'unspecified')}:{}}});
      return NextResponse.json(offering,{status:existing?200:201});
    }
    if (body.action === 'sleeping_space') {
      const space = await prisma.sleepingSpace.create({
        data: {
          unitId: params.id,
          spaceType: body.spaceType || 'bedroom',
          name: body.name || null,
          sortOrder: Number(body.sortOrder) || 0,
          beds: {
            create: (body.beds || []).filter((bed: { count?: number }) => Number(bed.count) > 0).map((bed: { bedType: string; count: number }) => ({ bedType: bed.bedType, count: Number(bed.count) })),
          },
        },
        include: { beds: true },
      });
      return NextResponse.json(space, { status: 201 });
    }
    if (body.action === 'channel_mapping') {
      if (body.syncState === 'ari_push') throw new Error('ARI push cannot be marked manually; connect a verified ARI provider first');
      const existingOffering = body.offeringId
        ? await prisma.commercialOffering.findFirst({ where: { id: body.offeringId, unitId: params.id } })
        : null;
      if (body.offeringId && !existingOffering) throw new Error('Offering does not belong to this unit');
      const unitForOffer=await prisma.unit.findUnique({where:{id:params.id},select:{projectId:true}});
      if(!unitForOffer)throw new Error('Home not found');
      const offering = await prisma.commercialOffering.upsert({
        where: { id: existingOffering?.id || '__new__' },
        create: { projectId:unitForOffer.projectId,unitId: params.id, offeringType: body.offeringType || 'short_term_stay', status: 'draft' },
        update: {},
      });
      const mapping = await prisma.channelMapping.upsert({
        where: { offeringId_channel: { offeringId: offering.id, channel: body.channel } },
        create: {
          offeringId: offering.id,
          channel: body.channel,
          externalListingId: body.externalListingId || null,
          syncState: body.syncState || 'ical_only',
          externalStatus: body.externalStatus || 'active',
        },
        update: {
          externalListingId: body.externalListingId || null,
          syncState: body.syncState || 'ical_only',
          externalStatus: body.externalStatus || 'active',
        },
      });
      return NextResponse.json(mapping, { status: 201 });
    }
    throw new Error('Unknown property-details action');
  } catch (error) {
    return failed(error, 'Failed to save unit details');
  }
}
