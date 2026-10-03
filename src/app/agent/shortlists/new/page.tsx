import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { getAgentContext } from '@/modules/distribution';
import AgentShortlistForm from '@/components/agent/AgentShortlistForm';
import { getLabels } from '@/lib/i18n';

export const dynamic='force-dynamic';

export default async function NewShortlist({searchParams}:{searchParams?:{unitId?:string}}){
  const user=await getCurrentUser();if(!user)redirect('/login?next=/agent/shortlists/new');
  const context=await getAgentContext(prisma,user.identityId);if(!context&&!user.isAdmin)redirect('/');
  const labels=await getLabels({
    'agent.common.back_inventory':'← Inventory',
    'agent.shortlist.new_title':'Create shortlist',
    'agent.shortlist.title_label':'Title',
    'agent.shortlist.default_title':'Property shortlist',
    'agent.common.client':'Client',
    'agent.common.no_client':'No protected client',
    'agent.common.brand':'Brand',
    'agent.common.brand.myuno':'myUNO',
    'agent.common.brand.cobranded':'Co-branded',
    'agent.common.brand.agent':'Agent branded',
    'agent.common.brand.neutral':'Neutral',
    'agent.shortlist.notes':'Notes',
    'agent.shortlist.search':'Search inventory',
    'agent.shortlist.selected':'selected',
    'agent.shortlist.create_share':'Create & share',
    'agent.shortlist.creating':'Creating…',
    'agent.common.whatsapp_share':'Share in WhatsApp',
  });
  const agentId=context?.identityId??user.identityId;
  const [units,clients]=await Promise.all([
    prisma.unit.findMany({where:{status:'live',project:{status:'live'},commercialOfferings:{some:{status:'active'}}},select:{id:true,name:true,project:{select:{name:true}}},orderBy:[{project:{name:'asc'}},{name:'asc'}],take:200}),
    prisma.agentClientProtection.findMany({where:{agentIdentityId:agentId,status:'active',expiresAt:{gt:new Date()}},select:{id:true,clientName:true,clientWhatsapp:true},orderBy:{clientName:'asc'}})
  ]);
  return <main className="min-h-screen bg-surface-ivory p-16 md:p-32"><div className="mx-auto max-w-4xl space-y-20"><header><Link href="/agent/inventory" className="text-small font-semibold text-brand-andaman">{labels['agent.common.back_inventory']}</Link><h1 className="mt-12 font-display text-display-xl font-semibold">{labels['agent.shortlist.new_title']}</h1></header><AgentShortlistForm units={units} clients={clients} initialUnitId={searchParams?.unitId||''} labels={labels}/></div></main>;
}
