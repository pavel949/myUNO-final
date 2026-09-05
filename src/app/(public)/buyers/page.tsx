import { Metadata } from 'next';
import Link from 'next/link';
import { getLabels } from '@/lib/i18n';
import { LeadFormSection } from '@/app/(public)/lead-form-section';
import { track } from '@/modules/analytics';
import { prisma } from '@/lib/prisma';
import { publicPageAlternates } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const labels = await getLabels({
    'audience.buyers.title': 'For Buyers',
    'audience.buyers.subtitle': 'Purchase already underway? Our team eases the handoff.',
  });
  return {
    title: `${labels['audience.buyers.title']} | myUNO`,
    description: labels['audience.buyers.subtitle'],
    alternates: publicPageAlternates('/buyers'),
  };
}

export default async function BuyersPage() {
  // Track analytics event
  await track(prisma, 'page_audience_viewed', {
    audience: 'buyers',
  }).catch(() => null);

  const labels = await getLabels({
    'audience.buyers.title': 'For Buyers',
    'audience.buyers.subtitle': 'Purchase already underway? Our team eases the handoff.',
    'audience.buyers.cta': 'Start the conversation',
    'audience.buyers.how.title': 'How it works',
    'audience.buyers.how.step1_title': 'Tell us what you are looking for',
    'audience.buyers.how.step1_body':
      'Leave your contact below — a location, a budget, a unit you already have your eye on, or just the intent.',
    'audience.buyers.how.step2_title': 'See real operating data',
    'audience.buyers.how.step2_body':
      'Units in residences we operate come with something no broker holds: actual occupancy, actual revenue, actual costs.',
    'audience.buyers.how.step3_title': 'Buy with the transaction protected',
    'audience.buyers.how.step3_body':
      'Vetted selection, genuine due diligence, and transaction support in a high-fraud market — our Capital team leads the deal.',
    'audience.buyers.how.step4_title': 'Earning from day one',
    'audience.buyers.how.step4_body':
      'The unit is already managed on the platform — the day you own it, it keeps earning, and your owner dashboard is live.',
    'audience.buyers.value.title': 'Why buy through myUNO',
    'audience.buyers.value.point1':
      'Safety in a high-fraud market: a credentialed operator, clear contracts, protected payments.',
    'audience.buyers.value.point2':
      'Due diligence backed by operating data — not a brochure forecast.',
    'audience.buyers.value.point3':
      'A managed asset from day one: no scramble to find a rental manager after the purchase.',
    'audience.buyers.trust.body':
      'The same trust infrastructure that runs every stay — verification, compliance, protected data — stands behind every transaction.',
    'audience.buyers.trust.link': 'How we build trust →',
  });

  const steps = ([1, 2, 3, 4] as const).map((n) => ({
    title: labels[`audience.buyers.how.step${n}_title`],
    body: labels[`audience.buyers.how.step${n}_body`],
  }));
  const values = ([1, 2, 3] as const).map((n) => labels[`audience.buyers.value.point${n}`]);

  return (
    <main className="min-h-screen bg-surface-ivory">
      <section className="bg-gradient-to-br from-brand-andaman to-brand-andaman-dark text-surface-ivory py-64 px-24">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="font-display text-display-xl font-semibold mb-24">{labels['audience.buyers.title']}</h1>
          <p className="text-body text-surface-ivory/90 mb-32">
            {labels['audience.buyers.subtitle']}
          </p>
          <Link
            href="#lead-form"
            className="inline-flex items-center justify-center bg-surface-ivory text-brand-andaman px-32 py-16 rounded-lg font-semibold hover:bg-opacity-90"
          >
            {labels['audience.buyers.cta']} →
          </Link>
        </div>
      </section>

      <section className="max-w-4xl mx-auto py-64 px-24">
        <h2 className="font-display text-display-xl font-semibold text-text-ink mb-40">
          {labels['audience.buyers.how.title']}
        </h2>
        <ol className="space-y-32">
          {steps.map((step, i) => (
            <li key={step.title} className="flex gap-24">
              <span className="text-heading-2 font-bold text-brand-andaman">{i + 1}</span>
              <div>
                <h3 className="text-heading-3 font-bold text-text-ink mb-8">{step.title}</h3>
                <p className="text-body text-text-secondary">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="bg-surface-ivory py-64 px-24">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-display text-display-xl font-semibold text-text-ink mb-40">
            {labels['audience.buyers.value.title']}
          </h2>
          <ul className="space-y-24 text-body">
            {values.map((point) => (
              <li key={point} className="flex gap-20">
                <span className="text-brand-andaman font-bold">✓</span>
                <span className="text-text-secondary">{point}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="max-w-4xl mx-auto py-64 px-24 text-center">
        <p className="text-body text-text-secondary mb-24">
          {labels['audience.buyers.trust.body']}
        </p>
        <Link href="/trust" className="text-brand-andaman font-semibold hover:underline">
          {labels['audience.buyers.trust.link']}
        </Link>
      </section>

      <div id="lead-form">
        <LeadFormSection audience="buyers" />
      </div>
    </main>
  );
}
