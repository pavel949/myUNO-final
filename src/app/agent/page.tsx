import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';
import { getAgentContext } from '@/modules/distribution';

export const dynamic = 'force-dynamic';

export default async function AgentHomePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/agent');
  const context = await getAgentContext(prisma, user.identityId);
  if (!context && !user.isAdmin) redirect('/');

  const agentId = context?.identityId ?? user.identityId;
  const [clients, shortlists, quotes, commissions] = await Promise.all([
    prisma.agentClientProtection.count({
      where: { agentIdentityId: agentId, status: 'active', expiresAt: { gt: new Date() } },
    }),
    prisma.agentShortlist.count({ where: { agentIdentityId: agentId, status: { not: 'archived' } } }),
    prisma.agentQuote.count({ where: { agentIdentityId: agentId, status: { in: ['draft', 'sent'] } } }),
    prisma.agentCommission.aggregate({
      where: { agentIdentityId: agentId, status: { in: ['estimated', 'accrued', 'approved', 'payable'] } },
      _sum: { amountSatang: true },
      _count: true,
    }),
  ]);

  const labels = await getLabels({
    'agent.home.kicker': 'AGENT WORKSPACE',
    'agent.home.title': 'Distribution workspace',
    'agent.home.subtitle': 'Search inventory, protect clients, create quotes, share selections and track commission.',
    'agent.home.inventory': 'Inventory',
    'agent.home.clients': 'Protected clients',
    'agent.home.shortlists': 'Shortlists',
    'agent.home.quotes': 'Open quotes',
    'agent.home.commissions': 'Open commissions',
    'agent.home.commission_value': 'Commission value',
    'agent.home.open': 'Open →',
  });

  const cards = [
    [labels['agent.home.clients'], clients, '/agent/clients'],
    [labels['agent.home.shortlists'], shortlists, '/agent/shortlists'],
    [labels['agent.home.quotes'], quotes, '/agent/quotes'],
    [labels['agent.home.commissions'], commissions._count, '/agent/commissions'],
  ] as const;

  return <main className="min-h-screen bg-surface-ivory p-16 md:p-32">
    <div className="mx-auto max-w-7xl space-y-24">
      <header>
        <p className="text-kicker font-bold tracking-widest text-brand-andaman">{labels['agent.home.kicker']}</p>
        <h1 className="mt-8 font-display text-display-xl font-semibold text-text-ink">{labels['agent.home.title']}</h1>
        <p className="mt-8 max-w-2xl text-body text-text-secondary">{labels['agent.home.subtitle']}</p>
        <Link href="/agent/inventory" className="mt-16 inline-flex rounded-md bg-brand-deep px-16 py-8 text-small font-semibold text-white">
          {labels['agent.home.inventory']} →
        </Link>
      </header>

      <section className="grid grid-cols-2 gap-12 lg:grid-cols-4">
        {cards.map(([label, value, href]) => <Link key={label} href={href} className="rounded-xl border border-border-line bg-surface-paper p-20">
          <p className="text-small text-text-secondary">{label}</p>
          <p className="mt-4 font-display text-heading-2 font-bold text-text-ink">{value}</p>
          <p className="mt-12 text-small font-semibold text-brand-andaman">{labels['agent.home.open']}</p>
        </Link>)}
      </section>

      <section className="rounded-xl border border-border-line bg-surface-paper p-20">
        <p className="text-small text-text-secondary">{labels['agent.home.commission_value']}</p>
        <p className="mt-4 font-display text-heading-2 font-bold text-text-ink">
          ฿{Math.round((commissions._sum.amountSatang ?? 0) / 100).toLocaleString()}
        </p>
      </section>
    </div>
  </main>;
}
