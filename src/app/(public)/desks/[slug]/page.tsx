import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLabels } from '@/lib/i18n';
import { getGlobalDesk } from '@/modules/global-desks';
import { getDestination } from '@/modules/destinations';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const destination = getDestination();
  const desk = getGlobalDesk(params.slug);
  if (!desk) return { title: 'Global desk | myUNO' };
  return {
    title: `${desk.code} desk | myUNO`,
    description: `A market and language liaison route into myUNO ${destination.name} property discovery, stays and services.`,
  };
}

export default async function GlobalDeskDetailPage({ params }: { params: { slug: string } }) {
  const destination = getDestination();
  const desk = getGlobalDesk(params.slug);
  if (!desk) notFound();

  const labels = await getLabels({
    'desks.detail.back': 'All global desks',
    'desks.detail.kicker': 'GLOBAL DESK',
    'desks.detail.body': 'This desk localizes market context and language into the same myUNO property, booking and service records. It does not create separate inventory, pricing or a physical office.',
    'desks.detail.discover': `Discover ${destination.name} property`,
    'desks.detail.discover_body': 'Browse the same canonical projects and homes available across myUNO.',
    'desks.detail.stay': 'Plan a stay',
    'desks.detail.stay_body': 'Search authoritative availability and continue into the standard myUNO booking flow.',
    'desks.detail.buy': 'Buy or rent',
    'desks.detail.buy_body': 'Explore active sale and long-term rental offerings on canonical homes.',
    'desks.detail.services': 'Add services',
    'desks.detail.services_body': 'Explore the service marketplace around your property or stay.',
    'desks.detail.help': 'Get help',
    'desks.detail.help_body': 'Use the Help Center for account, booking, property and trust guidance.',
    'desks.detail.open': 'Open',
    'desks.thailand.title': 'Thailand desk',
    'desks.thailand.body': 'For Thailand-based residents, owners, guests and partners navigating Phuket property and services.',
    'desks.thailand.languages': 'Thai · English',
    'desks.russian.title': 'Russian-speaking desk',
    'desks.russian.body': 'For Russian-speaking buyers, owners, guests and partners engaging with Phuket property.',
    'desks.russian.languages': 'Russian · English',
    'desks.china.title': 'Greater China desk',
    'desks.china.body': 'A market-oriented route for Chinese-speaking and Greater China audiences exploring Phuket property.',
    'desks.china.languages': 'Chinese · English',
    'desks.middle_east.title': 'Middle East desk',
    'desks.middle_east.body': 'A market-oriented route for Middle East buyers, families and investors exploring Phuket.',
    'desks.middle_east.languages': 'English',
    'desks.europe.title': 'Europe desk',
    'desks.europe.body': 'A market-oriented route for European buyers, residents and owners exploring Phuket property.',
    'desks.europe.languages': 'English',
  });

  const actions = [
    { title: labels['desks.detail.discover'], body: labels['desks.detail.discover_body'], href: '/projects' },
    { title: labels['desks.detail.stay'], body: labels['desks.detail.stay_body'], href: '/search' },
    { title: labels['desks.detail.buy'], body: labels['desks.detail.buy_body'], href: '/homes?intent=buy' },
    { title: labels['desks.detail.services'], body: labels['desks.detail.services_body'], href: '/services' },
    { title: labels['desks.detail.help'], body: labels['desks.detail.help_body'], href: '/help' },
  ];

  return (
    <main className="min-h-screen bg-surface-ivory">
      <section className="border-b border-border-line bg-gradient-to-br from-surface-ivory via-surface-paper to-surface-ivory px-20 py-56 md:px-32 md:py-80">
        <div className="mx-auto max-w-7xl">
          <Link href="/desks" className="text-small font-semibold text-brand-andaman hover:underline">
            ← {labels['desks.detail.back']}
          </Link>
          <div className="mt-24 flex h-48 w-48 items-center justify-center rounded-full bg-brand-andaman font-display text-small font-semibold tracking-[0.08em] text-white">
            {desk.code}
          </div>
          <p className="mt-20 text-kicker uppercase tracking-[0.18em] text-brand-andaman">{labels['desks.detail.kicker']}</p>
          <h1 className="mt-8 max-w-4xl font-display text-display-xl font-semibold tracking-[-0.03em] text-text-ink">
            {labels[desk.titleKey]}
          </h1>
          <p className="mt-12 max-w-2xl text-lg leading-relaxed text-text-secondary">{labels[desk.bodyKey]}</p>
          <p className="mt-12 text-small font-semibold text-brand-andaman">{labels[desk.languagesKey]}</p>
          <p className="mt-8 text-small text-text-secondary">{desk.sourceMarkets.join(' · ')}</p>
          <p className="mt-20 max-w-3xl text-small leading-relaxed text-text-secondary">{labels['desks.detail.body']}</p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-20 py-56 md:px-32 md:py-80">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-3">
          {actions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="group flex min-h-[210px] flex-col justify-between rounded-2xl border border-border-line bg-surface-paper p-24 transition-shadow hover:shadow-card focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-andaman"
            >
              <div>
                <h2 className="font-display text-title font-semibold text-text-ink">{action.title}</h2>
                <p className="mt-12 text-body text-text-secondary">{action.body}</p>
              </div>
              <span className="mt-20 text-small font-semibold text-brand-andaman">{labels['desks.detail.open']} →</span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
