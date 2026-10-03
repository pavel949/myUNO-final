import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getLabels } from '@/lib/i18n';
import { prisma } from '@/lib/prisma';
import { getAgentAdminDashboard } from '@/modules/agents';
import { AGENT_LABELS } from '@/modules/agents/labels';
import { AgentForm } from '@/components/agents/AgentForm';
export const dynamic='force-dynamic';
const card='rounded-xl border border-border-line bg-surface-paper p-24';
const money=(value:unknown)=>(Number(String(value))/100).toLocaleString('en-GB',{minimumFractionDigits:2});
export default async function AgentPartnersAdminPage() {
  const user=await getCurrentUser();
  if(!user || !user.isAdmin) redirect('/login?next=/app/admin/agent-partners');
  const [data,labels]=await Promise.all([getAgentAdminDashboard(prisma,user.identityId),getLabels(AGENT_LABELS)]);
  const l=(key:string)=>labels[('agent.'+key) as keyof typeof labels]??key;
  const endpoint='/api/admin/agent-partners';
  return <main className="space-y-24">
    <h1 className="font-display text-heading-1">{l('adminTitle')}</h1>
    <Link href="/work/crm" className="text-brand-andaman">{l('myunoAdmin')}</Link>
    <details className={card}><summary className="cursor-pointer font-display text-heading-3">{l('provision')}</summary>
      <div className="mt-20"><AgentForm endpoint={endpoint} labels={labels} button={l('provision')} values={{action:'provision'}} fields={[
        {name:'name',label:l('agencyName'),required:true},{name:'email',label:l('memberEmail'),type:'email',required:true},
      ]}/></div></details>
    {data.workspaces.map(w=><section key={w.id} className={card}><h2 className="font-display text-heading-3">{w.organization.name}</h2>
      <div className="my-16"><AgentForm endpoint={endpoint} labels={labels} button={l(w.active?'suspend':'activate')}
        values={{action:'toggle-workspace',id:w.id,active:!w.active}}/></div>
      {w.organization.memberships.map(m=><div key={m.id} className="flex flex-wrap items-center justify-between gap-16 border-t border-border-line py-16">
        <p>{m.identity.firstName} {m.identity.lastName} · {l(m.role)} · {m.status}</p>
        {m.status==='active'?<AgentForm endpoint={endpoint} labels={labels} button={l('revokeMember')} values={{action:'revoke-member',id:m.id}}/>:null}
      </div>)}
      <details className="mt-16"><summary className="cursor-pointer text-brand-andaman">{l('addMember')}</summary>
        <div className="mt-16"><AgentForm endpoint={endpoint} values={{action:'add-member',workspaceId:w.id}} labels={labels} button={l('addMember')} fields={[
          {name:'email',label:l('memberEmail'),type:'email',required:true},
          {name:'role',label:l('role'),options:['agent','manager'].map(value=>({value,label:l(value)}))},
        ]}/></div></details>
    </section>)}
    <section><h2 className="mb-16 font-display text-heading-2">{l('reviewQueue')}</h2><p className="mb-16 text-body text-text-stone">{l('approvalNote')}</p>
      {data.quotes.map(q=><article className={card+' mb-16'} key={q.id}>
        <h3 className="font-display text-heading-3">{q.title}</h3><p className="my-12">{q.workspace.organization.name} · {q.offering.unit?.name}</p>
        <dl className="grid gap-8"><div><dt>{l('amount')}</dt><dd>{money(q.amountSatang)}</dd></div>
          <div><dt>{l('fee')}</dt><dd>{money(q.feeSatang)}</dd></div><div><dt>{l('deposit')}</dt><dd>{money(q.depositSatang)}</dd></div></dl>
        <p className="my-16 whitespace-pre-line text-body">{q.terms}</p>
        <p className="my-16 text-small">{l('expiresAt')}: {String(q.expiresAt)}</p>
        <AgentForm endpoint={endpoint} labels={labels} button={l('approveQuote')} values={{action:'approve-quote',id:q.id}}/>
      </article>)}</section>
    <section><h2 className="mb-16 font-display text-heading-2">{l('handoverQueue')}</h2>
      {data.handovers.map(h=>{
        const contact=h.contactSnapshot as Record<string,unknown>;
        return <article className={card+' mb-16'} key={h.id}>
          <h3 className="font-display text-heading-3">{h.introduction.opportunity.title}</h3>
          <Link href={'/app/admin/crm/opportunities/'+h.introduction.opportunity.id+'/deal'} className="my-12 block text-brand-andaman">{l('contracts')}</Link>
          <p className="my-12">{h.introduction.workspace.organization.name} · {h.introduction.agent.firstName} {h.introduction.agent.lastName}</p>
          <p className="text-small text-text-stone">{l('receipt')}: {h.introduction.id}</p>
          <p className="my-16">{String(contact.displayName??'')} · {[contact.email,contact.phone,contact.telegram].filter(Boolean).join(' · ')}</p>
          <p className="mb-16 whitespace-pre-line">{h.request}</p><p className="mb-16">{l(h.status)}</p>
          {h.coordinator?<p className="mb-16">{l('coordinator')}: {h.coordinator.firstName} {h.coordinator.lastName}</p>:null}
          <AgentForm endpoint={endpoint} labels={labels} button={l('move')} values={{action:'handover-status',id:h.id}} fields={[
            {name:'status',label:l('status'),options:['acknowledged','completed','declined'].map(value=>({value,label:l(value)}))},
          ]}/>
        </article>;
      })}</section>
    <details className={card}><summary className="cursor-pointer font-display text-heading-3">{l('knowledgeDraft')}</summary>
      <div className="mt-20"><AgentForm endpoint={endpoint} labels={labels} button={l('knowledgeDraft')} values={{action:'knowledge-draft'}} fields={[
        {name:'title',label:l('title'),required:true},{name:'locale',label:l('locale'),options:['ru','en','th','zh'].map(value=>({value,label:value}))},
        {name:'body',label:l('body'),type:'textarea',required:true},{name:'sourceUrl',label:l('sourceUrl'),type:'url',required:true},
        {name:'expiresAt',label:l('expiresAt'),type:'datetime-local',required:true},
      ]}/></div></details>
    {data.knowledge.map(k=><article className={card} key={k.id}><h3 className="font-display text-heading-3">{k.title}</h3>
      <p className="my-12">{k.locale} · {l(k.status)}</p><p className="mb-16 whitespace-pre-line">{k.body}</p>
      <div className="flex flex-wrap gap-16">{k.status==='draft'?<AgentForm endpoint={endpoint} labels={labels}
        button={l('publish')} values={{action:'publish-knowledge',id:k.id}}/>:null}
        {k.status==='published'?<AgentForm endpoint={endpoint} labels={labels}
          button={l('withdraw')} values={{action:'withdraw-knowledge',id:k.id}}/>:null}</div>
    </article>)}
  </main>;
}
