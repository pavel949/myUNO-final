import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';
import { getAgentContext } from '@/modules/distribution';
import AgentClientProtectionForm from '@/components/agent/AgentClientProtectionForm';

export const dynamic='force-dynamic';

export default async function AgentClientsPage() {
  const user=await getCurrentUser();
  if(!user)redirect('/login?next=/agent/clients');
  const context=await getAgentContext(prisma,user.identityId);
  if(!context&&!user.isAdmin)redirect('/');
  const agentId=context?.identityId??user.identityId;
  const clients=await prisma.agentClientProtection.findMany({
    where:{agentIdentityId:agentId},
    orderBy:{createdAt:'desc'},
    take:200,
  });
  const labels=await getLabels({
    'agent.clients.back':'← Agent workspace',
    'agent.clients.title':'Protected clients',
    'agent.clients.subtitle':'Register the client before sharing inventory or creating a transaction.',
    'agent.clients.name':'Client',
    'agent.clients.contact':'Contact',
    'agent.clients.scope':'Scope',
    'agent.clients.expires':'Protected until',
    'agent.clients.empty':'No protected clients yet.',
  });
  return <main className="min-h-screen bg-surface-ivory p-16 md:p-32">
    <div className="mx-auto max-w-6xl space-y-24">
      <header>
        <Link href="/agent" className="text-small font-semibold text-brand-andaman">{labels['agent.clients.back']}</Link>
        <h1 className="mt-12 font-display text-display-xl font-semibold text-text-ink">{labels['agent.clients.title']}</h1>
        <p className="mt-6 text-body text-text-secondary">{labels['agent.clients.subtitle']}</p>
      </header>
      <AgentClientProtectionForm />
      <section className="overflow-hidden rounded-xl border border-border-line bg-surface-paper">
        {!clients.length?<p className="p-20 text-text-secondary">{labels['agent.clients.empty']}</p>:
          clients.map(c=><article key={c.id} className="grid gap-8 border-b border-border-line p-16 last:border-0 md:grid-cols-4">
            <div><p className="text-small text-text-secondary">{labels['agent.clients.name']}</p><p className="font-semibold text-text-ink">{c.clientName}</p></div>
            <div><p className="text-small text-text-secondary">{labels['agent.clients.contact']}</p><p className="text-text-ink">{c.clientWhatsapp||c.clientPhone||'—'}</p></div>
            <div><p className="text-small text-text-secondary">{labels['agent.clients.scope']}</p><p className="text-text-ink">{c.transactionScope}</p></div>
            <div><p className="text-small text-text-secondary">{labels['agent.clients.expires']}</p><p className="text-text-ink">{c.expiresAt.toISOString().slice(0,10)}</p></div>
          </article>)}
      </section>
    </div>
  </main>;
}
