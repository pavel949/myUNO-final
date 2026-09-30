import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { propertyDealJson } from '@/modules/crm/property-deal-serialization';
import PropertyDealClient from '@/components/property/PropertyDealClient';
import { getLabels } from '@/lib/i18n';

export const dynamic='force-dynamic';
export default async function OpportunityDealPage({params}:{params:{id:string}}){
  const user=await getCurrentUser();
  if(!user)redirect('/login?next=/app/admin/crm/opportunities/'+params.id+'/deal');
  if(!user.isAdmin)redirect('/');
  const opportunity=await prisma.crmOpportunity.findUnique({
    where:{id:params.id},
    select:{id:true,title:true,type:true,stage:true,unitId:true,
      unit:{select:{id:true,name:true,commercialOfferings:{
        select:{id:true,offeringType:true,status:true},
      }}},
      propertyDeal:true,
    },
  });
  if(!opportunity||!opportunity.unit||!opportunity.unitId)notFound();
  const labels=await getLabels({
    'admin.deal.back':'Back to opportunity',
    'admin.deal.title':'Commercial agreement',
    'admin.deal.no_unit':'Select a physical unit in CRM before drafting an agreement.',
  });
  return <main className="mx-auto max-w-5xl space-y-24 px-16 py-32">
    <Link href={'/app/admin/crm/opportunities/'+opportunity.id} className="text-small font-semibold text-brand-andaman">{labels['admin.deal.back']} ←</Link>
    <header>
      <h1 className="font-display text-heading-1 font-semibold text-text-ink">{opportunity.title} · {labels['admin.deal.title']}</h1>
    </header>
    <PropertyDealClient
      opportunityId={opportunity.id} opportunityType={opportunity.type}
      opportunityStage={opportunity.stage} unitId={opportunity.unitId}
      unitName={opportunity.unit.name}
      offers={opportunity.unit.commercialOfferings}
      initialDeal={propertyDealJson(opportunity.propertyDeal) as any}
    />
  </main>;
}
