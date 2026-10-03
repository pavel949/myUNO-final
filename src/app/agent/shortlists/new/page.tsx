import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { getAgentContext } from '@/modules/distribution';
import AgentShortlistForm from '@/components/agent/AgentShortlistForm';

export const dynamic='force-dynamic';

export default async function NewShortlist({searchParams}:{searchParams?:{unitId?:string}}){
  const user=await getCurrentUser();if(!user)redirect('/login?next=/agent/shortlists/new');
  const context=await getAgentContext(prisma,user.identityId);if(!context&&!user.isAdmin)redirect('/');
  const agentId=context?.identityId??user.identityId;
  const [units,clients]=await Promise.all([
    prisma.unit.findMany({where:{status:'live',project:{status:'live'},commercialOfferings:{some:{status:'active'}}},select:{id:true,name:true,project:{select:{name:true}}},orderBy:[{project:{name:'asc'}},{name:'asc'}],take:200}),
    prisma.agentClientProtection.findMany({where:{agentIdentityId:agentId,status:'active',expiresAt:{gt:new Date()}},select:{id:true,clientName:true,clientWhatsapp:true},orderBy:{clientName:'asc'}})
  ]);
  return <main className="min-h-screen bg-surface-ivory p-16 md:p-32"><div className="mx-auto max-w-4xl space-y-20"><header><Link href="/agent/inventory" className="text-small font-semibold text-brand-andaman">← Inventory</Link><h1 className="mt-12 font-display text-display-xl font-semibold">Create shortlist</h1></header><AgentShortlistForm units={units} clients={clients} initialUnitId={searchParams?.unitId||''}/></div></main>;
}
