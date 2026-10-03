import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';
import { getOperatingSpaceMembership, getOperatingSpaceUnitIds, hasOperatingSpaceCapability } from '@/modules/ops';
import DistributionPolicyTable from '@/components/ops/DistributionPolicyTable';

export const dynamic='force-dynamic';

export default async function DistributionControllerPage({
  searchParams,
}:{searchParams?:{spaceId?:string}}){
  const user=await getCurrentUser();
  if(!user)redirect('/login?next=/ops/distribution');
  const spaceId=typeof searchParams?.spaceId==='string'?searchParams.spaceId:'';
  if(!spaceId)redirect('/ops/spaces');

  const space=await prisma.operatingSpace.findUnique({
    where:{id:spaceId},
    select:{id:true,name:true,status:true},
  });
  if(!space||space.status!=='active')redirect('/ops/spaces');

  if(!user.isAdmin){
    const membership=await getOperatingSpaceMembership(prisma,spaceId,user.identityId);
    if(!membership?.active)redirect('/ops/spaces');
  }
  const canManage=user.isAdmin||await hasOperatingSpaceCapability(
    prisma,spaceId,user.identityId,'manage_channels',
  );

  const unitIds=await getOperatingSpaceUnitIds(prisma,spaceId);
  const scopedUnits=await prisma.unit.findMany({
    where:{id:{in:unitIds}},
    select:{id:true,projectId:true},
  });
  const projectIds=Array.from(new Set(scopedUnits.map(unit=>unit.projectId)));

  const offerings=await prisma.commercialOffering.findMany({
    where:{
      status:'active',
      OR:[
        {unitId:{in:unitIds}},
        {unitId:null,projectId:{in:projectIds}},
      ],
    },
    include:{
      unit:{select:{id:true,name:true,project:{select:{id:true,name:true}}}},
      project:{select:{id:true,name:true}},
      distributionPolicy:true,
      channelMappings:true,
    },
    orderBy:[{projectId:'asc'},{unitId:'asc'},{offeringType:'asc'}],
  });

  const suppliers=await prisma.organization.findMany({
    where:{
      status:'active',
      orgType:{in:['management_company','distribution_partner','agency']},
    },
    select:{id:true,name:true,orgType:true},
    orderBy:{name:'asc'},
  });

  const bookings=await prisma.booking.groupBy({
    by:['channel'],
    where:{
      unitId:{in:unitIds},
      status:{in:['confirmed','checked_in','checked_out','completed']},
    },
    _count:{_all:true},
    _sum:{totalThb:true},
  });

  const active=offerings.length;
  const agentEnabled=offerings.filter(o=>o.distributionPolicy?.agentDistributionEnabled!==false).length;
  const requestOnly=offerings.filter(o=>o.distributionPolicy?.availabilityMode==='request').length;
  const partner=offerings.filter(o=>o.distributionPolicy?.inventorySource==='partner').length;
  const channelErrors=offerings.reduce((sum,o)=>sum+o.channelMappings.filter(m=>
    m.syncState==='error'||(Array.isArray(m.syncErrors)&&m.syncErrors.length>0)
  ).length,0);

  const labels=await getLabels({
    'distribution.back_space':'← Operating space',
    'distribution.kicker':'DISTRIBUTION CONTROL',
    'distribution.title':'Distribution',
    'distribution.subtitle':'Control how each commercial offering is distributed without duplicating inventory.',
    'distribution.metric.offerings':'Active offerings',
    'distribution.metric.agent':'Agent enabled',
    'distribution.metric.request':'Request availability',
    'distribution.metric.partner':'Partner inventory',
    'distribution.metric.errors':'Channel errors',
    'distribution.project_unit':'Property',
    'distribution.offering':'Offering',
    'distribution.source':'Source',
    'distribution.availability':'Availability',
    'distribution.booking':'Booking',
    'distribution.agent':'Agents',
    'distribution.ota':'OTA',
    'distribution.commission':'Agent commission %',
    'distribution.markup':'Agent markup',
    'distribution.max_markup':'Max markup %',
    'distribution.sla':'Confirm SLA, min',
    'distribution.stale':'Stale after, min',
    'distribution.partner_org':'Supply partner',
    'distribution.none':'None',
    'distribution.yes':'Yes',
    'distribution.no':'No',
    'distribution.save':'Save',
    'distribution.saving':'Saving…',
    'distribution.saved':'Saved',
    'distribution.channel_ok':'Healthy',
    'distribution.channel_error':'Attention',
  });

  const rows=offerings.map(offering=>({
    id:offering.id,
    offeringType:offering.offeringType,
    propertyName:offering.unit
      ? offering.unit.project.name+' · '+offering.unit.name
      : offering.project?.name||'Project offering',
    unitId:offering.unitId,
    policy:offering.distributionPolicy?{
      inventorySource:offering.distributionPolicy.inventorySource,
      availabilityMode:offering.distributionPolicy.availabilityMode,
      bookingMode:offering.distributionPolicy.bookingMode,
      agentDistributionEnabled:offering.distributionPolicy.agentDistributionEnabled,
      directDistributionEnabled:offering.distributionPolicy.directDistributionEnabled,
      otaDistributionEnabled:offering.distributionPolicy.otaDistributionEnabled,
      allowAgentMarkup:offering.distributionPolicy.allowAgentMarkup,
      maxAgentMarkupPct:offering.distributionPolicy.maxAgentMarkupBps==null?null:offering.distributionPolicy.maxAgentMarkupBps/100,
      defaultAgentCommissionPct:offering.distributionPolicy.defaultAgentCommissionBps/100,
      confirmationSlaMinutes:offering.distributionPolicy.confirmationSlaMinutes,
      staleAfterMinutes:offering.distributionPolicy.staleAfterMinutes,
      supplyOrganizationId:offering.distributionPolicy.supplyOrganizationId,
    }:null,
    channelHealth:offering.channelMappings.map(mapping=>({
      channel:mapping.channel,
      syncState:mapping.syncState,
      lastSyncAt:mapping.lastSyncAt?.toISOString()||null,
      hasErrors:mapping.syncState==='error'||(Array.isArray(mapping.syncErrors)&&mapping.syncErrors.length>0),
    })),
  }));

  return <main className="min-h-screen bg-surface-ivory p-16 md:p-32">
    <div className="mx-auto max-w-[1500px] space-y-24">
      <header>
        <Link href={'/ops/spaces/'+encodeURIComponent(spaceId)}
          className="text-small font-semibold text-brand-andaman">{labels['distribution.back_space']}</Link>
        <p className="mt-16 text-kicker font-bold tracking-widest text-brand-andaman">{labels['distribution.kicker']}</p>
        <h1 className="mt-8 font-display text-display-xl font-semibold text-text-ink">{labels['distribution.title']}</h1>
        <p className="mt-8 max-w-3xl text-body text-text-secondary">{labels['distribution.subtitle']}</p>
      </header>

      <section className="grid grid-cols-2 gap-8 md:grid-cols-5">
        {[
          [labels['distribution.metric.offerings'],active],
          [labels['distribution.metric.agent'],agentEnabled],
          [labels['distribution.metric.request'],requestOnly],
          [labels['distribution.metric.partner'],partner],
          [labels['distribution.metric.errors'],channelErrors],
        ].map(([label,value])=><div key={String(label)} className="rounded-xl border border-border-line bg-surface-paper p-16">
          <p className="text-small text-text-secondary">{label}</p>
          <p className="mt-4 font-display text-heading-2 font-bold text-text-ink">{value}</p>
        </div>)}
      </section>

      <section className="rounded-xl border border-border-line bg-surface-paper p-16">
        <div className="flex flex-wrap gap-12">
          {bookings.map(row=><div key={row.channel} className="min-w-36">
            <p className="text-small text-text-secondary">{row.channel}</p>
            <p className="font-semibold text-text-ink">{row._count._all} · ฿{Math.round((row._sum.totalThb||0)/100).toLocaleString()}</p>
          </div>)}
        </div>
      </section>

      <DistributionPolicyTable
        operatingSpaceId={spaceId}
        rows={rows}
        suppliers={suppliers}
        labels={labels}
        canManage={canManage}
      />
    </div>
  </main>;
}
