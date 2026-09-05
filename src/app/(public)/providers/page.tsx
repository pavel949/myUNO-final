import { Metadata } from 'next';
import Link from 'next/link';
import { getLabels } from '@/lib/i18n';
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
    <main className="min-h-screen bg-surface-ivory">
      <section className="bg-gradient-to-br from-brand-andaman to-brand-andaman-dark text-surface-ivory py-64 px-24">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="font-display text-display-xl font-semibold mb-24">
            {labels['audience.providers.title']}
          </h1>
          <p className="text-body text-surface-ivory/90 mb-32">
            {labels['audience.providers.subtitle']}
          </p>
          <Link
            href="/provider/apply"
            className="inline-flex items-center justify-center bg-surface-ivory text-brand-andaman px-32 py-16 rounded-lg font-semibold hover:bg-opacity-90"
          >
            {labels['audience.providers.cta']} →
          </Link>
        </div>
      </section>

      <section className="max-w-4xl mx-auto py-64 px-24">
        <h2 className="font-display text-display-xl font-semibold text-text-ink mb-40">
          {labels['audience.providers.how.title']}
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
            {labels['audience.providers.value.title']}
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
          {labels['audience.providers.trust.body']}
        </p>
        <Link href="/trust" className="text-brand-andaman font-semibold hover:underline">
          {labels['audience.providers.trust.link']}
        </Link>
      </section>

      <section className="bg-surface-ivory py-64 px-24 text-center">
        <Link
          href="/provider/apply"
          className="inline-flex items-center justify-center bg-brand-andaman text-surface-ivory px-32 py-16 rounded-lg font-semibold hover:bg-opacity-90"
        >
          {labels['audience.providers.cta']} →
        </Link>
      </section>
    </main>
  );
}
