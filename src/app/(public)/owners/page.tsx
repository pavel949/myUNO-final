import { Metadata } from 'next';
import Link from 'next/link';
import { getLabels } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const labels = await getLabels({
    'audience.owners.title': 'For Owners',
    'audience.owners.subtitle': 'Invest with confidence. See results. Sleep soundly.',
  });
  return {
    title: `${labels['audience.owners.title']} | myUNO`,
    description: labels['audience.owners.subtitle'],
  };
}

export default async function OwnersPage() {
  const labels = await getLabels({
    'audience.owners.title': 'For Owners',
    'audience.owners.subtitle': 'Invest with confidence. See results. Sleep soundly.',
    'audience.owners.cta': 'Entrust your unit',
    'audience.owners.how.title': 'How it works',
    'audience.owners.how.step1_title': 'List your unit',
    'audience.owners.how.step1_body':
      'Upload photos, set your rules, choose your engagement type.',
    'audience.owners.how.step2_title': 'We verify guests',
    'audience.owners.how.step2_body':
      'Passports, backgrounds, proof of funds — all confirmed before check-in.',
    'audience.owners.how.step3_title': 'Track everything',
    'audience.owners.how.step3_body':
      'See every booking, payment, and request in one dashboard. Monthly statements included.',
    'audience.owners.how.step4_title': 'Get paid on time',
    'audience.owners.how.step4_body':
      'Earnings calculated daily. Payouts to your account or card, your choice.',
    'audience.owners.why.title': 'Why owners trust us',
    'audience.owners.why.point1': 'Peace of mind: verified guests and 24/7 support',
    'audience.owners.why.point2': 'Transparency: see every guest, payment, and issue',
    'audience.owners.why.point3': 'Compliance done: TM30, taxes, PDPA all handled',
    'audience.owners.why.point4': 'NOI cap protection: earnings guaranteed to your terms',
    'audience.owners.why.point5': 'Services at hand: cleaning, repairs, maintenance all vetted',
    'audience.owners.faq.title': 'Frequently asked',
    'audience.owners.faq.q1_title': 'How much can I earn?',
    'audience.owners.faq.q1_body':
      'It depends on your unit, location, and engagement type. Our calculator shows realistic projections based on market data.',
    'audience.owners.faq.q2_title': 'What if a guest damages the unit?',
    'audience.owners.faq.q2_body':
      'Pre-arrival verification and condition reports protect you. Deposits are held by our payment provider, not us. Damage claims are handled fairly and quickly.',
    'audience.owners.faq.q3_title': 'Can I use this for my family?',
    'audience.owners.faq.q3_body':
      'Yes. Owner stays are zero-rent bookings tracked separately. You can block dates or stay whenever you like.',
  });

  const steps = ([1, 2, 3, 4] as const).map((n) => ({
    n,
    title: labels[`audience.owners.how.step${n}_title`],
    body: labels[`audience.owners.how.step${n}_body`],
  }));
  const points = ([1, 2, 3, 4, 5] as const).map((n) => labels[`audience.owners.why.point${n}`]);
  const faqs = ([1, 2, 3] as const).map((n) => ({
    q: labels[`audience.owners.faq.q${n}_title`],
    a: labels[`audience.owners.faq.q${n}_body`],
  }));

  return (
    <main className="min-h-screen bg-white">
      <section className="bg-gradient-to-br from-brand-andaman to-brand-andaman-dark text-surface-ivory py-64 px-24">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-heading-1 font-bold mb-24">{labels['audience.owners.title']}</h1>
          <p className="text-body text-surface-ivory/90 mb-32">
            {labels['audience.owners.subtitle']}
          </p>
          <Link
            href="/register"
            className="inline-flex items-center justify-center bg-surface-ivory text-brand-andaman px-32 py-16 rounded-lg font-semibold hover:bg-opacity-90"
          >
            {labels['audience.owners.cta']} →
          </Link>
        </div>
      </section>

      <section className="max-w-4xl mx-auto py-64 px-24">
        <h2 className="text-heading-2 font-bold text-text-ink mb-40">
          {labels['audience.owners.how.title']}
        </h2>
        <div className="space-y-24">
          {steps.map((step) => (
            <div key={step.n} className="flex gap-32">
              <div className="text-heading-2 font-bold text-brand-andaman min-w-16">{step.n}</div>
              <div>
                <h3 className="text-heading-2 font-bold text-text-ink mb-12">{step.title}</h3>
                <p className="text-body text-text-secondary">{step.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-surface-background py-64 px-24">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-heading-2 font-bold text-text-ink mb-40">
            {labels['audience.owners.why.title']}
          </h2>
          <ul className="space-y-16 text-body">
            {points.map((point) => (
              <li key={point} className="flex gap-20">
                <span className="text-brand-andaman font-bold">✓</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="max-w-4xl mx-auto py-64 px-24">
        <h2 className="text-heading-2 font-bold text-text-ink mb-40">
          {labels['audience.owners.faq.title']}
        </h2>
        <div className="space-y-24">
          {faqs.map((faq) => (
            <div key={faq.q}>
              <h3 className="text-heading-3 font-bold text-text-ink mb-12">{faq.q}</h3>
              <p className="text-body text-text-secondary">{faq.a}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
