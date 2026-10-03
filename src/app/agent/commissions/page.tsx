import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { getAgentContext } from '@/modules/distribution';

export const dynamic='force-dynamic';

export default async function AgentCommissionsPage(){
  const user=await getCurrentUser();if(!user)redirect('/login?next=/agent/commissions');
  const context=await getAgentContext(prisma,user.identityId);if(!context&&!user.isAdmin)redirect('/');
  const agentId=context?.identityId??user.identityId;
  const rows=await prisma.agentCommission.findMany({
    where:{agentIdentityId:agentId},
    include:{booking:{select:{id:true,startDate:true,endDate:true,unit:{select:{name:true,project:{select:{name:true}}}}}}},
    orderBy:{createdAt:'desc'},take:200,
  });
  const total=rows.filter(r=>r.status!=='reversed').reduce((sum,r)=>sum+r.amountSatang,0);
  return <main className="min-h-screen bg-surface-ivory p-16 md:p-32"><div className="mx-auto max-w-6xl space-y-20"><header><Link href="/agent" className="text-small font-semibold text-brand-andaman">← Agent workspace</Link><h1 className="mt-12 font-display text-display-xl font-semibold">Commissions</h1><p className="mt-6 text-body text-text-secondary">฿{Math.round(total/100).toLocaleString()}</p></header><section className="overflow-hidden rounded-xl border border-border-line bg-surface-paper">{rows.map(r=><article key={r.id} className="grid gap-8 border-b border-border-line p-16 last:border-0 md:grid-cols-4"><div><p className="font-semibold">{r.booking? r.booking.unit.project.name+' · '+r.booking.unit.name : r.transactionRef||r.transactionType}</p><p className="text-small text-text-secondary">{r.transactionType}</p></div><div><p className="text-small text-text-secondary">Rate</p><p>{(r.rateBps/100).toFixed(1)}%</p></div><div><p className="text-small text-text-secondary">Amount</p><p className="font-semibold">฿{Math.round(r.amountSatang/100).toLocaleString()}</p></div><div><p className="text-small text-text-secondary">Status</p><p className="font-semibold">{r.status}</p></div></article>)}</section></div></main>;
}
