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
    'audience.developers.title': 'For Developers',
    'audience.developers.hero_lede': 'Your brand shouldn’t end at handover.',
  });
  return {
    title: `${labels['audience.developers.title']} | myUNO`,
    description: labels['audience.developers.hero_lede'],
    alternates: publicPageAlternates('/developers'),
  };
}

export default async function DevelopersPage() {
  // Track analytics event
  await track(prisma, 'page_audience_viewed', {
    audience: 'developers',
  }).catch(() => null);

  const labels = await getLabels({
    'audience.developers.hero_title':
      'The rental promise sells the unit. Make sure it stays yours.',
    'audience.developers.hero_lede': 'Your brand shouldn’t end at handover.',
    'audience.developers.cta': 'Talk to us',
    'audience.developers.point1':
      'The income story closes your sales. But once the keys change hands, that promise runs on someone else’s operation — and your name carries the risk if it falls short.',
    'audience.developers.point2':
      'Keep the owner, the data, and the standard under your brand — for the life of the project, not just until move-in.',
    'audience.developers.point3':
      'One system from first sale to every future re-sale, instead of a CRM stitched to a rental manager stitched to three booking sites.',
  });

  const points = ([1, 2, 3] as const).map((n) => labels[`audience.developers.point${n}`]);

  return (
    <main className="min-h-screen bg-surface-ivory">
      <section className="bg-gradient-to-br from-brand-andaman to-brand-andaman-dark text-surface-ivory py-64 px-24">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="font-display text-display-xl font-semibold mb-24">
            {labels['audience.developers.hero_title']}
          </h1>
          <p className="text-body text-surface-ivory/90 mb-32">
            {labels['audience.developers.hero_lede']}
          </p>
          <Link
            href="#lead-form"
            className="inline-flex items-center justify-center bg-surface-ivory text-brand-andaman px-32 py-16 rounded-lg font-semibold hover:bg-opacity-90"
          >
            {labels['audience.developers.cta']} →
          </Link>
        </div>
      </section>

      <section className="max-w-4xl mx-auto py-64 px-24">
        <ul className="space-y-24 text-body">
          {points.map((point) => (
            <li key={point} className="flex gap-20">
              <span className="text-brand-andaman font-bold">✓</span>
              <span>{point}</span>
            </li>
          ))}
        </ul>
      </section>

      <div id="lead-form">
        <LeadFormSection audience="developers" />
      </div>
    </main>
  );
}
