import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';
import { resolveAgentShare } from '@/modules/agents';
import { AGENT_LABELS } from '@/modules/agents/labels';
export const dynamic='force-dynamic';
export const revalidate=0;
export const metadata:Metadata={robots:{index:false,follow:false},referrer:'no-referrer'};
const money=(v:unknown)=>(Number(String(v))/100).toLocaleString('en-GB',{minimumFractionDigits:2});
export default async function PublicAgentQuote({params}:{params:{token:string}}) {
  const snapshot=await resolveAgentShare(prisma,params.token);
  if(!snapshot) notFound();
  const labels=await getLabels(AGENT_LABELS);
  const l=(key:string)=>labels[('agent.'+key) as keyof typeof labels]??key;
  const quote=snapshot as Record<string,unknown>;
  const home=quote.home as Record<string,unknown>;
  return <main className="mx-auto max-w-3xl px-20 py-48">
    <p className="text-small text-brand-andaman">{l('clientQuote')}</p>
    <h1 className="mt-8 font-display text-heading-1">{String(quote.title)}</h1>
    <p className="my-16 text-body text-text-stone">{String(home.project)} · {String(home.name)}</p>
    <section className="rounded-xl border border-border-line bg-surface-paper p-24">
      <dl className="grid gap-16 text-body">
        {[['amount','amountSatang'],['fee','feeSatang'],['total','totalSatang'],['deposit','depositSatang']].map(([label,key])=>
          <div key={key} className="flex flex-wrap justify-between gap-12"><dt>{l(label)}</dt><dd className="font-semibold">{money(quote[key])}</dd></div>)}
      </dl><p className="mt-24 whitespace-pre-line text-body">{String(quote.terms)}</p>
      <p className="mt-24 text-small text-text-stone">{l('validUntil')}: {new Date(String(quote.expiresAt)).toLocaleString('en-GB',{timeZone:'Asia/Bangkok'})}</p>
    </section><p className="mt-24 text-body text-text-stone">{l('availabilityNote')}</p>
  </main>;
}
