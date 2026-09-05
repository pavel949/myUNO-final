import { Metadata } from 'next';
import Link from 'next/link';
import { getLabels } from '@/lib/i18n';
import { publicPageAlternates } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const labels = await getLabels({
    'audience.guests.title': 'For Guests',
    'audience.guests.subtitle': 'Hotels unnecessary. Here: home, safety, support.',
  });
  return {
    title: `${labels['audience.guests.title']} | myUNO`,
    description: labels['audience.guests.subtitle'],
    alternates: publicPageAlternates('/guests'),
  };
}

export default async function GuestsPage() {
  const labels = await getLabels({
    'audience.guests.title': 'For Guests',
    'audience.guests.subtitle': 'Hotels unnecessary. Here: home, safety, support.',
    'audience.guests.cta': 'Search stays',
    'audience.guests.how.title': 'How it works',
    'audience.guests.how.step1_title': 'Find your home',
    'audience.guests.how.step1_body':
      'Choose dates and browse real homes in residences we operate — villas and apartments, not hotel rooms.',
    'audience.guests.how.step2_title': 'Book and pay your way',
    'audience.guests.how.step2_body':
      'Instant booking or a request to the host. Pay in cash on arrival or by card — clear terms, clear cancellation policy.',
    'audience.guests.how.step3_title': 'Arrive to a run residence',
    'audience.guests.how.step3_body':
      'Professional check-in, immigration filing handled for you, a host on chat, and help when anything comes up.',
    'audience.guests.how.step4_title': 'Everything around the stay',
    'audience.guests.how.step4_body':
      'Transfers, cleaning, a chef, a car — vetted services ordered from your in-stay home space in a couple of taps.',
    'audience.guests.value.title': 'Why guests choose myUNO',
    'audience.guests.value.point1':
      'Hotel-grade service in a private home: check-in, housekeeping, support — in a villa or apartment.',
    'audience.guests.value.point2':
      'One-stop shop: everything around the stay booked in one place, vetted and dependable.',
    'audience.guests.value.point3':
      'Trust and safety: in a market full of scams — a credentialed operator, secure payment, clear terms.',
    'audience.guests.value.point4':
      'A seamless digital experience: booking, check-in, host chat, services, and extensions — all on your phone.',
    'audience.guests.value.point5':
      'Continuity: we recognize you when you return — and if you ever want to buy here, there is a path.',
    'audience.guests.trust.body':
      'Verified guests, TM30 immigration compliance, and protected personal data — trust is infrastructure here, not a promise.',
    'audience.guests.trust.link': 'How we build trust →',
  });

  const steps = ([1, 2, 3, 4] as const).map((n) => ({
    title: labels[`audience.guests.how.step${n}_title`],
    body: labels[`audience.guests.how.step${n}_body`],
  }));
  const values = ([1, 2, 3, 4, 5] as const).map(
    (n) => labels[`audience.guests.value.point${n}`]
  );

  return (
    <main className="min-h-screen bg-surface-ivory">
      <section className="bg-gradient-to-br from-brand-andaman to-brand-andaman-dark text-surface-ivory py-64 px-24">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="font-display text-display-xl font-semibold mb-24">{labels['audience.guests.title']}</h1>
          <p className="text-body text-surface-ivory/90 mb-32">
            {labels['audience.guests.subtitle']}
          </p>
          <Link
            href="/search"
            className="inline-flex items-center justify-center bg-surface-ivory text-brand-andaman px-32 py-16 rounded-lg font-semibold hover:bg-opacity-90"
          >
            {labels['audience.guests.cta']} →
          </Link>
        </div>
      </section>

      <section className="max-w-4xl mx-auto py-64 px-24">
        <h2 className="font-display text-display-xl font-semibold text-text-ink mb-40">
          {labels['audience.guests.how.title']}
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
            {labels['audience.guests.value.title']}
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
          {labels['audience.guests.trust.body']}
        </p>
        <Link href="/trust" className="text-brand-andaman font-semibold hover:underline">
          {labels['audience.guests.trust.link']}
        </Link>
      </section>

      <section className="bg-surface-ivory py-64 px-24 text-center">
        <Link
          href="/search"
          className="inline-flex items-center justify-center bg-brand-andaman text-surface-ivory px-32 py-16 rounded-lg font-semibold hover:bg-opacity-90"
        >
          {labels['audience.guests.cta']} →
        </Link>
      </section>
    </main>
  );
}
