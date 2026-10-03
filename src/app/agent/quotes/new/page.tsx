import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { getAgentContext } from '@/modules/distribution';
import AgentQuoteForm from '@/components/agent/AgentQuoteForm';

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
  const agentId=context?.identityId??user.identityId;
  const clients=await prisma.agentClientProtection.findMany({
    where:{agentIdentityId:agentId,status:'active',expiresAt:{gt:new Date()}},
    select:{id:true,clientName:true,clientWhatsapp:true},
    orderBy:{clientName:'asc'},
  });
  return <main className="min-h-screen bg-surface-ivory p-16 md:p-32"><div className="mx-auto max-w-3xl space-y-20">
    <header><Link href="/agent/inventory" className="text-small font-semibold text-brand-andaman">← Inventory</Link>
      <h1 className="mt-12 font-display text-display-xl font-semibold">Create quote</h1>
      <p className="mt-6 text-body text-text-secondary">{unit.project.name} · {unit.name}</p></header>
    <AgentQuoteForm unit={unit} clients={clients}/>
  </div></main>;
}
