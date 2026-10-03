import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { getAgentContext } from '@/modules/distribution';

export const dynamic='force-dynamic';

export default async function AgentShortlistsPage(){
  const user=await getCurrentUser();if(!user)redirect('/login?next=/agent/shortlists');
  const context=await getAgentContext(prisma,user.identityId);if(!context&&!user.isAdmin)redirect('/');
  const agentId=context?.identityId??user.identityId;
  const rows=await prisma.agentShortlist.findMany({
    where:{agentIdentityId:agentId},
    include:{items:{include:{unit:{select:{name:true,project:{select:{name:true}}}}},orderBy:{sortOrder:'asc'}},clientProtection:{select:{clientName:true}},sharedLinks:{orderBy:{createdAt:'desc'},take:1}},
    orderBy:{updatedAt:'desc'},take:100,
  });
  return <main className="min-h-screen bg-surface-ivory p-16 md:p-32"><div className="mx-auto max-w-6xl space-y-20">
    <header className="flex items-end justify-between gap-12"><div><Link href="/agent" className="text-small font-semibold text-brand-andaman">← Agent workspace</Link><h1 className="mt-12 font-display text-display-xl font-semibold">Shortlists</h1></div><Link href="/agent/shortlists/new" className="rounded-md bg-brand-deep px-16 py-8 text-small font-semibold text-white">New shortlist</Link></header>
    <section className="space-y-10">{rows.map(row=><article key={row.id} className="rounded-xl border border-border-line bg-surface-paper p-16"><div className="flex flex-wrap justify-between gap-8"><div><h2 className="font-display text-heading-3 font-semibold">{row.title}</h2><p className="text-small text-text-secondary">{row.clientProtection?.clientName||'—'} · {row.items.length} properties</p></div><span className="text-small font-semibold text-brand-andaman">{row.brandMode}</span></div><div className="mt-10 flex flex-wrap gap-6">{row.items.slice(0,5).map(item=><span key={item.id} className="rounded-full bg-surface-ivory px-10 py-4 text-small">{item.unit.project.name} · {item.unit.name}</span>)}</div></article>)}</section>
  </div></main>;
}
