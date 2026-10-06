import { Metadata } from 'next';
import { getLabels } from '@/lib/i18n';
import { AudienceLanding } from '@/components/premium/AudienceLanding';
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
    <AudienceLanding
      title={labels['audience.guests.title']}
      subtitle={labels['audience.guests.subtitle']}
      cta={{ href: '/search', label: labels['audience.guests.cta'] }}
      stepsTitle={labels['audience.guests.how.title']}
      steps={steps}
      valuesTitle={labels['audience.guests.value.title']}
      values={values}
      trust={{ body: labels['audience.guests.trust.body'], href: '/trust', link: labels['audience.guests.trust.link'] }}
    >
    </AudienceLanding>
  );
}
