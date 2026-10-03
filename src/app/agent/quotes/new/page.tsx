import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { getAgentContext } from '@/modules/distribution';
import AgentQuoteForm from '@/components/agent/AgentQuoteForm';
import { getLabels } from '@/lib/i18n';

export const dynamic='force-dynamic';

export default async function AgentQuoteNewPage({searchParams}:{searchParams?:{unitId?:string}}){
  const user=await getCurrentUser();
  if(!user)redirect('/login?next=/agent/quotes/new');
  const context=await getAgentContext(prisma,user.identityId);
  if(!context&&!user.isAdmin)redirect('/');
  const unitId=typeof searchParams?.unitId==='string'?searchParams.unitId:'';
  if(!unitId)redirect('/agent/inventory');
  const unit=await prisma.unit.findFirst({
    where:{id:unitId,status:'live',project:{status:'live'}},
    select:{id:true,name:true,maxGuests:true,project:{select:{name:true}}},
  });
  if(!unit)notFound();
  const labels=await getLabels({
    'agent.common.back_inventory':'← Inventory',
    'agent.quote.new_title':'Create quote',
    'agent.common.client':'Client',
    'agent.common.no_client':'No protected client',
    'agent.common.brand':'Brand',
    'agent.common.brand.myuno':'myUNO',
    'agent.common.brand.cobranded':'Co-branded',
    'agent.common.brand.agent':'Agent branded',
    'agent.common.brand.neutral':'Neutral',
    'agent.quote.checkin':'Check-in',
    'agent.quote.checkout':'Check-out',
    'agent.quote.adults':'Adults',
    'agent.quote.children':'Children',
    'agent.quote.markup':'Markup THB',
    'agent.quote.discount':'Discount THB',
    'agent.quote.commission':'Commission %',
    'agent.quote.valid_hours':'Valid hours',
    'agent.quote.public_note':'Client note',
    'agent.quote.create_share':'Create & share',
    'agent.quote.creating':'Creating…',
    'agent.common.whatsapp_share':'Share in WhatsApp',
  });
  const agentId=context?.identityId??user.identityId;
  const clients=await prisma.agentClientProtection.findMany({
    where:{agentIdentityId:agentId,status:'active',expiresAt:{gt:new Date()}},
    select:{id:true,clientName:true,clientWhatsapp:true},
    orderBy:{clientName:'asc'},
  });
  return <main className="min-h-screen bg-surface-ivory p-16 md:p-32"><div className="mx-auto max-w-3xl space-y-20">
    <header><Link href="/agent/inventory" className="text-small font-semibold text-brand-andaman">{labels['agent.common.back_inventory']}</Link>
      <h1 className="mt-12 font-display text-display-xl font-semibold">{labels['agent.quote.new_title']}</h1>
      <p className="mt-8 text-body text-text-secondary">{unit.project.name} · {unit.name}</p></header>
    <AgentQuoteForm unit={unit} clients={clients} labels={labels}/>
  </div></main>;
}
