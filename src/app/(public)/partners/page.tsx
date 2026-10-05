import type { Metadata } from 'next';
import Link from 'next/link';
import { getLabels } from '@/lib/i18n';
import { publicPageAlternates } from '@/lib/seo';
import { getDestination } from '@/modules/destinations';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const destination = getDestination();
  const labels = await getLabels({
    'partners.title': 'Partner with myUNO',
    'partners.lede':
      `Operate properties, connect a development, or provide trusted services through one ${destination.name} property network.`,
  });

  return {
    title: `${labels['partners.title']} | myUNO`,
    description: labels['partners.lede'],
    alternates: publicPageAlternates('/partners'),
  };
}

export default async function PartnersPage() {
  const destination = getDestination();
  const labels = await getLabels({
    'partners.kicker': 'PARTNERS',
    'partners.title': 'Partner with myUNO',
    'partners.lede':
      `Operate properties, connect a development, or provide trusted services through one ${destination.name} property network.`,
    'partners.management.title': 'Property managers',
    'partners.management.body':
      'Run projects and portfolios with bookings, availability, team workflows, finance and owner reporting connected to the same property records.',
    'partners.management.cta': 'For management companies',
    'partners.developers.title': 'Developers',
    'partners.developers.body':
      'Connect project inventory, sales, rentals and post-handover owner services without building a second property model.',
    'partners.developers.cta': 'For developers',
    'partners.providers.title': 'Service providers',
    'partners.providers.body':
      'Offer vetted local services to guests, residents and owners through the connected marketplace and fulfillment workflow.',
    'partners.providers.cta': 'For service providers',
    'partners.trust.title': 'One network, explicit responsibility.',
    'partners.trust.body':
      'Each partner sees only the delegated capabilities and records they are authorized to operate. Public responsibility stays visible to customers and owners.',
    'partners.trust.cta': 'How trust works',
  });

  const paths = [
    {
      href: '/management-companies',
      title: labels['partners.management.title'],
      body: labels['partners.management.body'],
      cta: labels['partners.management.cta'],
    },
    {
      href: '/developers',
      title: labels['partners.developers.title'],
      body: labels['partners.developers.body'],
      cta: labels['partners.developers.cta'],
    },
    {
      href: '/providers',
      title: labels['partners.providers.title'],
      body: labels['partners.providers.body'],
      cta: labels['partners.providers.cta'],
    },
  ];

  return (
    <main className="min-h-screen bg-surface-ivory">
      <section className="border-b border-border-line bg-surface-paper px-20 py-56 md:px-32 md:py-80">
        <div className="mx-auto max-w-content">
          <p className="text-kicker uppercase text-brand-andaman">
            {labels['partners.kicker']}
          </p>
          <h1 className="mt-12 max-w-3xl font-display text-display-xl font-semibold text-text-ink">
            {labels['partners.title']}
          </h1>
          <p className="mt-20 max-w-2xl text-body text-text-secondary md:text-subtitle">
            {labels['partners.lede']}
          </p>
        </div>
      </section>

      <section className="px-20 py-56 md:px-32 md:py-80">
        <div className="mx-auto grid max-w-content gap-16 md:grid-cols-3">
          {paths.map((path) => (
            <Link
              key={path.href}
              href={path.href}
              className="group flex min-h-[260px] flex-col justify-between rounded-lg border border-border-line bg-surface-paper p-24 transition hover:border-brand-andaman hover:shadow-card focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-andaman"
            >
              <div>
                <h2 className="font-display text-title font-semibold text-text-ink">
                  {path.title}
                </h2>
                <p className="mt-12 text-body text-text-secondary">{path.body}</p>
              </div>
              <span className="mt-24 text-small font-semibold text-brand-andaman transition-transform duration-structural group-hover:translate-x-4">
                {path.cta} →
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-y border-border-line bg-surface-paper px-20 py-56 md:px-32">
        <div className="mx-auto max-w-content md:flex md:items-end md:justify-between md:gap-32">
          <div className="max-w-2xl">
            <h2 className="font-display text-display font-semibold text-text-ink">
              {labels['partners.trust.title']}
            </h2>
            <p className="mt-12 text-body text-text-secondary">
              {labels['partners.trust.body']}
            </p>
          </div>
          <Link
            href="/trust"
            className="mt-20 inline-flex text-body font-semibold text-brand-andaman hover:underline md:mt-0"
          >
            {labels['partners.trust.cta']} →
          </Link>
        </div>
      </section>
    </main>
  );
}
