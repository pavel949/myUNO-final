import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getLabels, getRequestLocale } from '@/lib/i18n';
import { prisma } from '@/lib/prisma';
import { AgentError, getAgentDashboard, getAgentInventory, listAgentWorkspaces } from '@/modules/agents';
import { AGENT_LABELS } from '@/modules/agents/labels';
import { AgentForm } from '@/components/agents/AgentForm';
export const dynamic='force-dynamic';
export const metadata:Metadata={robots:{index:false,follow:false}};
const sections=['home','contacts','opportunities','activities','inventory','offers','knowledge','commissions','team'] as const;
const card='rounded-xl border border-border-line bg-surface-paper p-24';
const date=(value:unknown)=>value?new Date(String(value)).toLocaleString('en-GB',{timeZone:'Asia/Bangkok'}):'—';
const money=(value:unknown)=>(Number(String(value))/100).toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2});
export default async function AgentPage({params,searchParams}:{params:{section?:string[]};searchParams:{workspace?:string;q?:string}}) {
  const user=await getCurrentUser();
  if(!user) redirect('/login?next=/agent');
  const labels=await getLabels(AGENT_LABELS);
  const l=(key:string)=>labels[('agent.'+key) as keyof typeof labels]??key;
  const workspaces=await listAgentWorkspaces(prisma,user.identityId);
  if(!workspaces.length) return <main className="mx-auto max-w-3xl px-20 py-48">
    <h1 className="font-display text-heading-1 text-text-ink">{l('home')}</h1>
    <p className="my-24 text-body text-text-stone">{l('notMember')}</p>
    <Link href="/partners/agents" className="text-brand-andaman">{l('help')}</Link>
  </main>;
  const workspaceId=searchParams.workspace??workspaces[0].id;
  if(!workspaces.some(w=>w.id===workspaceId)) notFound();
  const section=params.section?.join('/')??'home';
  if(!sections.includes(section as typeof sections[number])) notFound();
  let data:Awaited<ReturnType<typeof getAgentDashboard>>;
  try {data=await getAgentDashboard(prisma,user.identityId,workspaceId,getRequestLocale(),searchParams.q);}
  catch(error) {if(error instanceof AgentError && error.status===404) notFound();throw error;}
  const inventory=['inventory','offers'].includes(section)?await getAgentInventory(prisma,user.identityId,workspaceId):[];
  const endpoint=(resource:string)=>'/api/agent/'+workspaceId+'/'+resource;
  const url=(key:string)=>'/agent'+(key==='home'?'':'/'+key)+'?workspace='+encodeURIComponent(workspaceId);
  const opportunities=data.opportunities.map(r=>({value:r.id,label:r.opportunity.title+' · '+r.relationship.displayName}));
  const stageOptions=['new','qualified','discovery','proposal','negotiation','nurture','lost'].map(value=>({value,label:l(value)}));
  return <main className="mx-auto max-w-7xl px-20 py-32 md:px-32">
    <header className="mb-24 flex flex-wrap items-start justify-between gap-16">
      <div><p className="text-small text-brand-andaman">{workspaces.find(w=>w.id===workspaceId)?.organization.name}</p>
        <h1 className="font-display text-heading-1 font-semibold text-text-ink">{l(section)}</h1>
        <p className="mt-8 text-body text-text-stone">{l('intro')}</p></div>
      {workspaces.length>1?<details><summary className="cursor-pointer text-brand-andaman">{l('workspace')}</summary>
        <div className={card}>{workspaces.map(w=><Link key={w.id} className="block py-8" href={'/agent?workspace='+w.id}>{w.organization.name}</Link>)}</div>
      </details>:null}
    </header>
    <div className="grid gap-24 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside><nav aria-label={l('home')} className="flex gap-8 overflow-x-auto pb-12 lg:flex-col">
        {sections.map(key=><Link key={key} href={url(key)} aria-current={section===key?'page':undefined}
          className={'shrink-0 rounded-lg px-16 py-12 text-small '+(section===key?'bg-brand-andaman text-surface-ivory':'bg-surface-paper text-text-ink hover:bg-surface-ivory')}>{l(key)}</Link>)}
      </nav><p className="hidden mt-24 text-small text-text-stone lg:block">{l('privacy')}</p></aside>
      <div className="min-w-0 space-y-24">
        {section==='home'?<>
          <div className="grid gap-16 md:grid-cols-3">{['contacts','opportunities','offers'].map((key,i)=><Link className={card} key={key} href={url(key)}>
            <p className="text-small text-text-stone">{l(key)}</p>
            <p className="mt-8 font-display text-heading-1 text-brand-andaman">{[data.contacts.length,data.opportunities.length,data.quotes.length][i]}</p>
          </Link>)}</div>
          <section className={card}><h2 className="font-display text-heading-3 mb-16">{l('activities')}</h2>
            {data.activities.filter(a=>a.status==='open').slice(0,8).map(a=><div key={a.id} className="border-b border-border-line py-12">
              <p>{a.subject}</p><p className="text-small text-text-stone">{date(a.dueAt)}</p></div>)}
            {!data.activities.some(a=>a.status==='open')?<p className="text-body text-text-stone">{l('empty')}</p>:null}
          </section><section className={card}><h2 className="font-display text-heading-3">{l('handover')}</h2>
            <p className="my-16 text-body text-text-stone">{l('privacy')}</p>
            <Link href={url('opportunities')} className="text-brand-andaman">{l('seeAll')}</Link></section>
        </>:null}
        {section==='contacts'?<>
          <details className={card}><summary className="cursor-pointer font-display text-heading-3">{l('newContact')}</summary>
            <div className="mt-20"><AgentForm endpoint={endpoint('contacts')} labels={labels} button={l('newContact')} fields={[
              {name:'displayName',label:l('name'),required:true},{name:'email',label:l('email'),type:'email'},
              {name:'phone',label:l('phone'),type:'tel'},{name:'telegram',label:l('telegram')},
              {name:'privateNotes',label:l('privateNotes'),type:'textarea'},
            ]}/></div></details>
          <div className="grid gap-16 md:grid-cols-2">{data.contacts.map(c=><article className={card} key={c.id}>
            <h2 className="font-display text-heading-3">{c.displayName}</h2>
            <p className="my-12 break-words text-small text-text-stone">{[c.email,c.phone,c.telegram].filter(Boolean).join(' · ')}</p>
            <p className="whitespace-pre-line text-body text-text-ink">{c.privateNotes}</p>
          </article>)}</div>
        </>:null}
        {section==='opportunities'?<>
          <details className={card}><summary className="cursor-pointer font-display text-heading-3">{l('newOpportunity')}</summary>
            <div className="mt-20"><AgentForm endpoint={endpoint('opportunities')} labels={labels} button={l('newOpportunity')} fields={[
              {name:'relationshipId',label:l('contact'),required:true,options:data.contacts.map(c=>({value:c.id,label:c.displayName}))},
              {name:'title',label:l('title'),required:true},
              {name:'type',label:l('type'),options:['rental','purchase','sale'].map(value=>({value,label:l(value)}))},
            ]}/></div></details>
          {data.opportunities.map(r=><article className={card} key={r.id}>
            <div className="flex flex-wrap justify-between gap-12"><div><h2 className="font-display text-heading-3">{r.opportunity.title}</h2>
              <p className="mt-8 text-body text-text-stone">{r.relationship.displayName} · {l(r.opportunity.type)}</p></div>
              <span className="rounded-full bg-surface-ivory px-12 py-8 text-small">{l(r.opportunity.stage)}</span></div>
            <p className="mt-16 break-all text-small text-text-stone">{l('receipt')}: {r.id} · {date(r.createdAt)}</p>
            {r.handover?<div className="mt-16 rounded-lg bg-surface-ivory p-16">
              <p>{l(r.handover.status)}</p><p className="text-small text-text-stone">{l('receipt')}: {r.handover.id}</p>
              {r.handover.coordinator?<p>{l('coordinator')}: {r.handover.coordinator.firstName} {r.handover.coordinator.lastName}</p>:null}
            </div>:<details className="mt-20"><summary className="cursor-pointer text-brand-andaman">{l('handover')}</summary>
              <div className="mt-16"><AgentForm endpoint={endpoint('handovers')} values={{introductionId:r.id}} labels={labels} button={l('handover')} fields={[
                {name:'request',label:l('request'),type:'textarea',required:true},
                {name:'consentConfirmed',label:l('consent'),type:'checkbox',required:true},
              ]}/></div></details>}
            {!['won','lost'].includes(r.opportunity.stage)?<details className="mt-20"><summary className="cursor-pointer text-brand-andaman">{l('move')}</summary>
              <div className="mt-16"><AgentForm endpoint={endpoint('stage')} values={{introductionId:r.id}} labels={labels} button={l('move')} fields={[
                {name:'stage',label:l('stage'),options:stageOptions},{name:'lostReason',label:l('lostReason')},
              ]}/></div></details>:null}
          </article>)}
        </>:null}
        {section==='activities'?<>
          <details className={card}><summary className="cursor-pointer font-display text-heading-3">{l('newTask')}</summary>
            <div className="mt-20"><AgentForm endpoint={endpoint('activities')} labels={labels} button={l('newTask')} fields={[
              {name:'introductionId',label:l('opportunities'),options:opportunities,required:true},
              {name:'subject',label:l('subject'),required:true},{name:'dueAt',label:l('dueAt'),type:'datetime-local',required:true},
            ]}/></div></details>
          {data.activities.map(a=><article key={a.id} className={card}>
            <h2 className="font-display text-heading-3">{a.subject}</h2>
            <p className="my-16 text-small text-text-stone">{date(a.dueAt)} · {l(a.status)}</p>
            {a.status==='open'?<AgentForm endpoint={endpoint('complete-activity')} values={{id:a.id}} labels={labels} button={l('complete')}/>:null}
          </article>)}
        </>:null}
        {section==='inventory'?<>
          <p className="text-body text-text-stone">{l('inventoryNote')}</p>
          <div className="grid gap-16 md:grid-cols-2">{inventory.map(h=><article className={card} key={h.id}>
            <p className="text-small text-text-stone">{h.project.name}</p><h2 className="my-8 font-display text-heading-3">{h.name}</h2>
            <p>{h.bedrooms} / {h.bathrooms} · {h.sizeSqm??'—'} {l('sqm')}</p>
            <p className="my-16 text-small text-text-stone">{h.intents.map(i=>l(i==='buy'?'purchase':'rental')).join(' · ')}</p>
            <Link href={url('offers')} className="text-brand-andaman">{l('quote')}</Link>
          </article>)}</div>
        </>:null}
        {section==='offers'?<>
          <p className="text-body text-text-stone">{l('quotePolicy')}</p>
          <details className={card}><summary className="cursor-pointer font-display text-heading-3">{l('quote')}</summary>
            <div className="mt-20"><AgentForm endpoint={endpoint('quotes')} labels={labels} button={l('quote')} fields={[
              {name:'introductionId',label:l('opportunities'),options:opportunities,required:true},
              {name:'offeringId',label:l('offering'),required:true,options:inventory.flatMap(h=>h.offerings.map(o=>({
                value:o.id,label:h.name+' · '+l(o.offeringType==='sale'?'purchase':'rental'),
              })))},
              {name:'title',label:l('title'),required:true},
              {name:'amountSatang',label:l('amount'),type:'money',required:true},{name:'feeSatang',label:l('fee'),type:'money',required:true},
              {name:'depositSatang',label:l('deposit'),type:'money',required:true},
              {name:'terms',label:l('terms'),type:'textarea',required:true},
              {name:'expiresAt',label:l('expiresAt'),type:'datetime-local',required:true},
            ]}/></div></details>
          {data.quotes.map(q=><article className={card} key={q.id}>
            <h2 className="font-display text-heading-3">{q.title}</h2><p className="my-12 text-small text-text-stone">{l(q.status)} · {date(q.expiresAt)}</p>
            <dl className="grid gap-8 text-body"><div><dt>{l('amount')}</dt><dd>{money(q.amountSatang)}</dd></div>
              <div><dt>{l('fee')}</dt><dd>{money(q.feeSatang)}</dd></div><div><dt>{l('deposit')}</dt><dd>{money(q.depositSatang)}</dd></div></dl>
            <div className="mt-20 flex flex-wrap gap-16">
              {q.status==='draft'?<AgentForm endpoint={endpoint('submit-quote')} values={{id:q.id}} labels={labels} button={l('submit')}/>:null}
              {q.status==='approved'?<AgentForm endpoint={endpoint('shares')} values={{id:q.id}} labels={labels} button={l('share')} share shareMessage={q.title}/>:null}
              {q.status!=='revoked'?<AgentForm endpoint={endpoint('revoke-quote')} values={{id:q.id}} labels={labels} button={l('revoke')}/>:null}
            </div></article>)}
        </>:null}
        {section==='knowledge'?<>
          <form action="/agent/knowledge" className="flex gap-12">
            <input type="hidden" name="workspace" value={workspaceId}/>
            <label className="flex-1"><span className="mb-8 block text-small">{l('search')}</span>
              <input name="q" defaultValue={searchParams.q??''} maxLength={200} className="h-48 w-full rounded-lg border border-border-line px-16"/></label>
            <button className="self-end rounded-lg bg-brand-andaman px-20 py-12 text-surface-ivory" type="submit">{l('searchAction')}</button>
          </form>
          {!data.knowledge.length?<p className={card}>{l('knowledgeEmpty')}</p>:null}
          {data.knowledge.map(k=><article className={card} key={k.id}>
            <h2 className="font-display text-heading-3">{k.title}</h2><p className="my-16 whitespace-pre-line text-body">{k.body}</p>
            <a href={k.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-brand-andaman">{l('source')}</a>
            <p className="mt-12 text-small text-text-stone">{l('reviewed')}: {date(k.publishedAt)} · {l('validUntil')}: {date(k.expiresAt)}</p>
          </article>)}
        </>:null}
        {section==='commissions'?<>
          <p className={card}>{l('commissionNote')}</p>
          {data.commissions.map(c=><article className={card} key={c.id}>
            <h2 className="font-display text-heading-3">{c.introduction.opportunity.title}</h2>
            <p className="my-12">{money(c.amountSatang)} {c.currency} · {l(c.status)}</p>
            <p className="text-small text-text-stone">{l('dueAt')}: {date(c.dueAt)} · {l('targetAt')}: {date(c.targetAt)} · {l('deadlineAt')}: {date(c.deadlineAt)}</p>
          </article>)}
        </>:null}
        {section==='team'?<section className={card}><h2 className="font-display text-heading-3">{l('team')}</h2>
          {data.members.map((m,i)=><p className="border-b border-border-line py-16" key={i}>{m.identity.firstName} {m.identity.lastName} · {l(m.role)}</p>)}
          <p className="mt-20 text-small text-text-stone">{l('privacy')}</p></section>:null}
        {['contacts','opportunities','activities','inventory','offers','commissions'].includes(section)?
          <p className="text-small text-text-stone">{l('limited')}</p>:null}
      </div>
    </div>
  </main>;
}
