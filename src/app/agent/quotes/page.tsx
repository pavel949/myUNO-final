import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';
import { getAgentContext } from '@/modules/distribution';

export const dynamic='force-dynamic';

export default async function AgentQuotesPage(){
  const user=await getCurrentUser();
  if(!user)redirect('/login?next=/agent/quotes');
  const context=await getAgentContext(prisma,user.identityId);
  if(!context&&!user.isAdmin)redirect('/');
  const agentId=context?.identityId??user.identityId;
  const quotes=await prisma.agentQuote.findMany({
    where:{agentIdentityId:agentId},
    include:{items:{include:{unit:{select:{name:true,project:{select:{name:true}}}}}},clientProtection:{select:{clientName:true}},sharedLinks:{orderBy:{createdAt:'desc'},take:1}},
    orderBy:{createdAt:'desc'},take:100,
  });
  const labels=await getLabels({
    'agent.quotes.back':'← Agent workspace','agent.quotes.title':'Quotes','agent.quotes.new':'Create quote',
    'agent.quotes.client':'Client','agent.quotes.total':'Client total','agent.quotes.commission':'Commission',
    'agent.quotes.availability':'Availability','agent.quotes.empty':'No quotes yet.','agent.quotes.share':'Share'
  });
  return <main className="min-h-screen bg-surface-ivory p-16 md:p-32"><div className="mx-auto max-w-6xl space-y-20">
    <header className="flex flex-wrap items-end justify-between gap-12"><div><Link href="/agent" className="text-small font-semibold text-brand-andaman">{labels['agent.quotes.back']}</Link><h1 className="mt-12 font-display text-display-xl font-semibold">{labels['agent.quotes.title']}</h1></div>
      <Link href="/agent/inventory" className="rounded-md bg-brand-deep px-16 py-8 text-small font-semibold text-white">{labels['agent.quotes.new']}</Link></header>
    <section className="space-y-12">{!quotes.length?<p className="rounded-lg border border-border-line bg-surface-paper p-20 text-text-secondary">{labels['agent.quotes.empty']}</p>:quotes.map(q=>{
      const item=q.items[0]; return <article key={q.id} className="rounded-xl border border-border-line bg-surface-paper p-16">
        <div className="grid gap-12 md:grid-cols-5"><div className="md:col-span-2"><p className="font-semibold">{item?.unit.project.name} · {item?.unit.name}</p><p className="text-small text-text-secondary">{q.clientProtection?.clientName||'—'}</p></div>
        <div><p className="text-small text-text-secondary">{labels['agent.quotes.total']}</p><p className="font-semibold">฿{Math.round(q.clientTotalSatang/100).toLocaleString()}</p></div>
        <div><p className="text-small text-text-secondary">{labels['agent.quotes.commission']}</p><p className="font-semibold">฿{Math.round(q.commissionSatang/100).toLocaleString()}</p></div>
        <div><p className="text-small text-text-secondary">{labels['agent.quotes.availability']}</p><p className="font-semibold">{q.availabilityState}</p></div></div>
      </article>})}</section>
  </div></main>;
}
