import { Metadata } from 'next';
import Link from 'next/link';
import { getLabels } from '@/lib/i18n';
import { SearchBar } from '@/components/SearchBar';

export const metadata: Metadata = {
  title: 'myUNO | Serviced Living in Phuket',
  description:
    'Invest with confidence. Live worry-free. One platform for owners, guests, and providers.',
};

export const dynamic = 'force-dynamic';

export default async function LandingPage() {
  const labels = await getLabels({
    'landing.hero.kicker': 'Serviced living in Phuket',
    'landing.hero.title': 'Your place.',
    'landing.hero.subtitle':
      'Stop managing. Start living. One portal for all your needs.',
    'landing.search.check_in': 'Check-in',
    'landing.search.check_out': 'Check-out',
    'landing.search.adults': 'Adults',
    'landing.search.children': 'Children',
    'landing.search.submit': 'Find your stay',
    'landing.promise.stay': 'Stay',
    'landing.promise.stay_body':
      'Find home, book in one click, pay in cash. No card fees here.',
    'landing.promise.live': 'Live',
    'landing.promise.live_body':
      'Order a service, tell your neighbours, decide together. Living becomes simpler.',
    'landing.promise.own': 'Own',
    'landing.promise.own_body':
      'Earn income. See every guest, every payment, every request. Management is fact-based.',
    'landing.doors.title': 'Who are you?',
    'audience.owners.title': 'For Owners',
    'audience.owners.subtitle': 'Invest with confidence. See results. Sleep soundly.',
    'audience.owners.cta': 'Entrust your unit →',
    'audience.guests.title': 'For Guests',
    'audience.guests.subtitle': 'Hotels unnecessary. Here: home, safety, support.',
    'audience.guests.cta': 'Search stays →',
    'audience.developers.title': 'For Developers',
    'audience.developers.subtitle':
      'Uplift your project class. Managed platform, integrated ops.',
    'audience.developers.cta': 'Talk to us →',
    'audience.buyers.title': 'For Buyers',
    'audience.buyers.subtitle':
      'Purchase already underway? Our team eases the handoff.',
    'audience.buyers.cta': 'Start the conversation →',
    'audience.mc.title': 'For Management Companies',
    'audience.mc.subtitle': 'Demanded ops. Single platform. More income.',
    'audience.mc.cta': 'Learn more →',
    'audience.providers.title': 'For Providers',
    'audience.providers.subtitle': 'Steady order flow. Direct comms. Fair pay.',
    'audience.providers.cta': 'Apply →',
    'landing.trust.title': 'Trust, made visible',
    'landing.trust.verified': 'Guests verified',
    'landing.trust.verified_body': 'Passports, backgrounds, proof of funds.',
    'landing.trust.handled': 'Compliance handled',
    'landing.trust.handled_body': 'TM30, taxes, PDPA — we file it all.',
    'landing.trust.protected': 'Data protected',
    'landing.trust.protected_body': 'Encrypted fields, access logs, retention policies.',
    'landing.trust.cta': 'Learn how →',
    'landing.services.title': 'Everything around the stay',
    'landing.services.body':
      'Cleaning, repairs, deliveries — every service vetted and led.',
    'landing.services.cta': 'Browse services',
  });

  const doors = [
    {
      href: '/owners',
      title: labels['audience.owners.title'],
      body: labels['audience.owners.subtitle'],
      cta: labels['audience.owners.cta'],
    },
    {
      href: '/guests',
      title: labels['audience.guests.title'],
      body: labels['audience.guests.subtitle'],
      cta: labels['audience.guests.cta'],
    },
    {
      href: '/developers',
      title: labels['audience.developers.title'],
      body: labels['audience.developers.subtitle'],
      cta: labels['audience.developers.cta'],
    },
    {
      href: '/buyers',
      title: labels['audience.buyers.title'],
      body: labels['audience.buyers.subtitle'],
      cta: labels['audience.buyers.cta'],
    },
    {
      href: '/management-companies',
      title: labels['audience.mc.title'],
      body: labels['audience.mc.subtitle'],
      cta: labels['audience.mc.cta'],
    },
    {
      href: '/providers',
      title: labels['audience.providers.title'],
      body: labels['audience.providers.subtitle'],
      cta: labels['audience.providers.cta'],
    },
  ];

  const trustPoints = [
    {
      title: labels['landing.trust.verified'],
      body: labels['landing.trust.verified_body'],
    },
    {
      title: labels['landing.trust.handled'],
      body: labels['landing.trust.handled_body'],
    },
    {
      title: labels['landing.trust.protected'],
      body: labels['landing.trust.protected_body'],
    },
  ];

  return (
    <main className="min-h-screen bg-white">
      {/* Hero + search */}
      <section className="bg-gradient-to-br from-brand-andaman to-brand-andaman-dark text-surface-ivory py-64 px-24">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-small mb-16">{labels['landing.hero.kicker']}</p>
          <h1 className="text-heading-1 font-bold mb-16">
            {labels['landing.hero.title']}
          </h1>
          <p className="text-body text-surface-ivory/90 mb-32">
            {labels['landing.hero.subtitle']}
          </p>
          <SearchBar
            labels={{
              checkIn: labels['landing.search.check_in'],
              checkOut: labels['landing.search.check_out'],
              adults: labels['landing.search.adults'],
              children: labels['landing.search.children'],
              submit: labels['landing.search.submit'],
            }}
          />
        </div>
      </section>

      {/* Promise Pillars */}
      <section className="max-w-6xl mx-auto py-64 px-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-40">
          {(
            [
              ['stay', 'stay_body'],
              ['live', 'live_body'],
              ['own', 'own_body'],
            ] as const
          ).map(([titleKey, bodyKey]) => (
            <div key={titleKey}>
              <h3 className="text-heading-2 font-bold text-text-ink mb-16">
                {labels[`landing.promise.${titleKey}`]}
              </h3>
              <p className="text-body text-text-secondary">
                {labels[`landing.promise.${bodyKey}`]}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Audience Doors */}
      <section className="bg-surface-background py-64 px-24">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-heading-1 font-bold text-text-ink mb-40 text-center">
            {labels['landing.doors.title']}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-32">
            {doors.map((door) => (
              <Link
                key={door.href}
                href={door.href}
                className="bg-white border border-border-line rounded-lg p-32 hover:shadow-lg transition"
              >
                <h3 className="text-heading-2 font-bold text-text-ink mb-12">{door.title}</h3>
                <p className="text-body text-text-secondary mb-24">{door.body}</p>
                <span className="text-brand-andaman font-semibold">{door.cta}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="max-w-6xl mx-auto py-64 px-24">
        <h2 className="text-heading-1 font-bold text-text-ink mb-40 text-center">
          {labels['landing.trust.title']}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-40 mb-40">
          {trustPoints.map((point) => (
            <div key={point.title} className="text-center">
              <div className="text-heading-2 mb-16">✓</div>
              <h3 className="text-heading-2 font-bold text-text-ink mb-12">{point.title}</h3>
              <p className="text-body text-text-secondary">{point.body}</p>
            </div>
          ))}
        </div>
        <div className="text-center">
          <Link href="/trust" className="text-brand-andaman font-semibold hover:underline">
            {labels['landing.trust.cta']}
          </Link>
        </div>
      </section>

      {/* Services Section */}
      <section className="bg-surface-background py-64 px-24">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-heading-1 font-bold text-text-ink mb-32">
            {labels['landing.services.title']}
          </h2>
          <p className="text-body text-text-secondary mb-40">
            {labels['landing.services.body']}
          </p>
          <Link
            href="/services"
            className="inline-flex items-center justify-center bg-brand-andaman text-surface-ivory px-32 py-16 rounded-lg font-semibold hover:bg-opacity-90"
          >
            {labels['landing.services.cta']}
          </Link>
        </div>
      </section>
    </main>
  );
}
