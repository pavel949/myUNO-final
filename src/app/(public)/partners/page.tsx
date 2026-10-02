import Link from 'next/link';
import type { Metadata } from 'next';
import { getLabels } from '@/lib/i18n';
import { publicPageAlternates } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const labels = await getLabels({
    'partners.meta.title': 'Partners on myUNO',
    'partners.meta.description':
      'Property managers, service providers and developers operate inside the same myUNO property record.',
  });
  return {
    title: labels['partners.meta.title'],
    description: labels['partners.meta.description'],
    alternates: publicPageAlternates('/partners'),
  };
}

export default async function PartnersPage() {
  const labels = await getLabels({
    'partners.kicker': 'FOR PARTNERS',
    'partners.title': 'Operate inside one property network.',
    'partners.body':
      'Partner workspaces are scoped. They do not invent a second inventory, price list or guest record.',
    'partners.mc.title': 'Property managers',
    'partners.mc.body':
      'Connect managed units, stays, tasks and settlement through a delegated management-company workspace.',
    'partners.mc.cta': 'Management companies',
    'partners.providers.title': 'Service providers',
    'partners.providers.body':
      'Apply, get vetted, receive orders and remit through the provider portal.',
    'partners.providers.cta': 'Providers',
    'partners.developers.title': 'Developers',
    'partners.developers.body':
      'Keep project presentation, operations and owner relationships on one record after handover.',
    'partners.developers.cta': 'Developers',
  });

  const cards = [
    {
      href: '/partners/property-managers',
      title: labels['partners.mc.title'],
      body: labels['partners.mc.body'],
      cta: labels['partners.mc.cta'],
    },
    {
      href: '/partners/providers',
      title: labels['partners.providers.title'],
      body: labels['partners.providers.body'],
      cta: labels['partners.providers.cta'],
    },
    {
      href: '/developers',
      title: labels['partners.developers.title'],
      body: labels['partners.developers.body'],
      cta: labels['partners.developers.cta'],
    },
  ];

  return (
    <main className="min-h-screen bg-surface-ivory">
      <section className="bg-brand-deep px-20 py-56 text-surface-ivory md:px-32 md:py-80">
        <div className="mx-auto max-w-content">
          <p className="text-kicker uppercase tracking-[0.18em] text-brand-sun-soft">{labels['partners.kicker']}</p>
          <h1 className="mt-12 max-w-4xl font-display text-display-xl font-semibold tracking-[-0.02em]">
            {labels['partners.title']}
          </h1>
          <p className="mt-16 max-w-2xl text-body text-surface-ivory/72">{labels['partners.body']}</p>
        </div>
      </section>
      <section className="mx-auto max-w-content px-20 py-56 md:px-32">
        <div className="grid gap-16 md:grid-cols-3">
          {cards.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="flex min-h-[220px] flex-col justify-between rounded-2xl border border-border-line bg-surface-paper p-24 transition-shadow hover:shadow-card"
            >
              <div>
                <h2 className="font-display text-heading-2 font-semibold text-text-ink">{card.title}</h2>
                <p className="mt-12 text-body text-text-secondary">{card.body}</p>
              </div>
              <span className="mt-24 text-small font-semibold text-brand-andaman">{card.cta} →</span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
