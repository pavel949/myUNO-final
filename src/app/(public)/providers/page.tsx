import { Metadata } from 'next';
import { getLabels } from '@/lib/i18n';
import { AudienceLanding } from '@/components/premium/AudienceLanding';
import { publicPageAlternates } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const labels = await getLabels({
    'audience.providers.title': 'For Providers',
    'audience.providers.subtitle': 'Steady order flow. Direct comms. Fair pay.',
  });
  return {
    title: `${labels['audience.providers.title']} | myUNO`,
    description: labels['audience.providers.subtitle'],
    alternates: publicPageAlternates('/providers'),
  };
}

export default async function ProvidersPage() {
  const labels = await getLabels({
    'audience.providers.title': 'For Providers',
    'audience.providers.subtitle': 'Steady order flow. Direct comms. Fair pay.',
    'audience.providers.cta': 'Apply',
    'audience.providers.how.title': 'How it works',
    'audience.providers.how.step1_title': 'Apply',
    'audience.providers.how.step1_body':
      'Tell us what you do — cleaning, transfers, a chef, maintenance, wellness — and where you work.',
    'audience.providers.how.step2_title': 'Get vetted',
    'audience.providers.how.step2_body':
      'We check every provider before they go live. The vetted badge is itself a mark of reliability in a low-trust market.',
    'audience.providers.how.step3_title': 'Receive orders',
    'audience.providers.how.step3_body':
      'Guests, residents, and owners order your services from their home space. You accept, fulfil, and chat — all in your provider portal.',
    'audience.providers.how.step4_title': 'Get paid',
    'audience.providers.how.step4_body':
      'Orders and payment run through the platform, with a clear remittance report for every period.',
    'audience.providers.value.title': 'Why providers join',
    'audience.providers.value.point1':
      'A concentrated, high-spend client base — vetted guests and residents clustered in specific residences.',
    'audience.providers.value.point2':
      'Predictable, aggregated demand: plug into the guest flow instead of hunting individual bookings.',
    'audience.providers.value.point3':
      'Concentration efficiency: serve many clients in one area on one trip — several villas, one evening, one route.',
    'audience.providers.value.point4':
      'Streamlined operations: orders, scheduling, communication, and payment in one place.',
    'audience.providers.trust.body':
      'Your badge tells guests you are vetted — and the platform stands behind every order.',
    'audience.providers.trust.link': 'How we build trust →',
  });

  const steps = ([1, 2, 3, 4] as const).map((n) => ({
    title: labels[`audience.providers.how.step${n}_title`],
    body: labels[`audience.providers.how.step${n}_body`],
  }));
  const values = ([1, 2, 3, 4] as const).map(
    (n) => labels[`audience.providers.value.point${n}`]
  );

  return (
    <AudienceLanding
      title={labels['audience.providers.title']}
      subtitle={labels['audience.providers.subtitle']}
      cta={{ href: '/provider/apply', label: labels['audience.providers.cta'] }}
      stepsTitle={labels['audience.providers.how.title']}
      steps={steps}
      valuesTitle={labels['audience.providers.value.title']}
      values={values}
      trust={{ body: labels['audience.providers.trust.body'], href: '/trust', link: labels['audience.providers.trust.link'] }}
    >
    </AudienceLanding>
  );
}
