import { Metadata } from 'next';
import { AudienceLanding } from '@/components/premium/AudienceLanding';
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
    <AudienceLanding
      title={labels['audience.developers.hero_title']}
      subtitle={labels['audience.developers.hero_lede']}
      cta={{ href: '#lead-form', label: labels['audience.developers.cta'] }}
      values={points}
    >
      <div id="lead-form">
        <LeadFormSection audience="developers" />
      </div>
    </AudienceLanding>
  );
}
