import { Metadata } from 'next';
import Link from 'next/link';
import { getLabels } from '@/lib/i18n';
import { siteUrl, publicPageAlternates, serializeJsonLd } from '@/lib/seo';
import { SearchBar } from '@/components/SearchBar';
import { TrustMark } from '@/components/TrustMark';
import { listPublicProjects } from '@/modules/projects/public.service';

export const metadata: Metadata = {
  title: 'myUNO | Stays, homes and services in Phuket',
  description:
    'Find places to stay in Phuket, manage your trip, access trusted local services, and manage or list a property with myUNO.',
  alternates: publicPageAlternates('/'),
};

export const dynamic = 'force-dynamic';

export default async function LandingPage() {
  const projects = await listPublicProjects();
  const heroCover = projects.find((project) => project.coverUrl)?.coverUrl ?? null;

  const labels = await getLabels({
    'landing.hero.kicker': 'Phuket, Thailand',
    'landing.hero.title': 'Phuket, better connected.',
    'landing.hero.subtitle':
      'Stay in places we know. Manage your trip. Get trusted local services.',
    'landing.search.check_in': 'Check-in',
    'landing.search.check_out': 'Check-out',
    'landing.search.adults': 'Adults',
    'landing.search.children': 'Children',
    'landing.search.submit': 'Find your stay',
    'landing.promise.stay': 'Places on myUNO',
    'landing.promise.stay_body':
      'Private villas, managed residences and homes connected to one operating network.',
    'landing.promise.live': 'Your Phuket, handled',
    'landing.promise.live_body':
      'Transfers, cars, chefs, wellness and property services before arrival or whenever you need them.',
    'landing.promise.own': 'One trip, one place',
    'landing.promise.own_body':
      'Arrival, services, messages, requests and checkout stay connected in My myUNO.',
    'audience.owners.title': 'Own a property?',
    'audience.owners.subtitle':
      'Ask myUNO to manage it, or submit your unit and operate it yourself where your setup allows.',
    'audience.owners.cta': 'For owners →',
    'audience.mc.title': 'Manage properties?',
    'audience.mc.subtitle':
      'Bring your managed inventory, team and operating scope onto one shared platform.',
    'audience.mc.cta': 'For property managers →',
    'audience.providers.title': 'Provide services in Phuket?',
    'audience.providers.subtitle':
      'Join the network, receive qualified orders and build a verified fulfilment record.',
    'audience.providers.cta': 'For providers →',
    'landing.trust.title': 'Responsibility made visible',
    'landing.trust.verified': 'Know who is responsible',
    'landing.trust.verified_body':
      'Every stay, home and service shows the role myUNO or a partner actually performs.',
    'landing.trust.handled': 'Work leaves a record',
    'landing.trust.handled_body':
      'Bookings, requests, service orders and operational evidence stay connected to the right context.',
    'landing.trust.protected': 'One relationship, scoped access',
    'landing.trust.protected_body':
      'Your identity can span trips and ownership while each operator sees only what they are allowed to see.',
    'landing.trust.cta': 'How myUNO works →',
    'landing.services.title': 'Find services across Phuket',
    'landing.services.body':
      'Book for an upcoming stay, for your own home, or simply because you need something in Phuket.',
    'landing.services.cta': 'Explore services',
  });

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

  const organizationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'myUNO',
    legalName: 'Ignatev Estate Co., Ltd',
    url: siteUrl(),
    email: 'pavel@ignatevestate.com',
    areaServed: 'Phuket, Thailand',
  };

  return (
    <main className="min-h-screen bg-surface-ivory">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(organizationJsonLd) }}
      />

      <section
        className="relative min-h-screen bg-brand-deep bg-cover bg-center text-on-dark-text flex items-end"
        style={heroCover ? { backgroundImage: `url(${heroCover})` } : undefined}
      >
        <div className="absolute inset-0 bg-brand-deep/60" aria-hidden="true" />
        <div className="relative w-full max-w-6xl mx-auto px-24 pb-56 pt-80">
          <div className="max-w-3xl mb-40">
            <p className="font-display text-kicker uppercase tracking-widest text-brand-sun-soft mb-16">
              {labels['landing.hero.kicker']}
            </p>
            <h1 className="font-display text-display-xl font-semibold mb-20">
              {labels['landing.hero.title']}
            </h1>
            <p className="text-body text-on-dark-text/90 max-w-2xl">
              {labels['landing.hero.subtitle']}
            </p>
          </div>

          <div className="max-w-5xl">
            <SearchBar
              labels={{
                checkIn: labels['landing.search.check_in'],
                checkOut: labels['landing.search.check_out'],
                adults: labels['landing.search.adults'],
                children: labels['landing.search.children'],
                submit: labels['landing.search.submit'],
              }}
            />
            <Link
              href="/services"
              className="inline-flex mt-20 text-small font-semibold text-on-dark-text underline underline-offset-4"
            >
              {labels['landing.services.cta']}
            </Link>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto py-80 px-24">
        <div className="max-w-2xl mb-40">
          <p className="font-display text-kicker uppercase text-brand-sun mb-12">
            {labels['landing.hero.kicker']}
          </p>
          <h2 className="font-display text-display-xl font-semibold text-text-ink mb-16">
            {labels['landing.promise.stay']}
          </h2>
          <p className="text-body text-text-stone">
            {labels['landing.promise.stay_body']}
          </p>
        </div>

        {projects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-24">
            {projects.slice(0, 6).map((project, index) => (
              <Link
                key={project.id}
                href={`/projects/${project.slug}`}
                className={
                  index === 0
                    ? 'group relative min-h-96 md:col-span-2 overflow-hidden rounded-lg bg-brand-deep'
                    : 'group relative min-h-72 overflow-hidden rounded-lg bg-brand-deep'
                }
                style={
                  project.coverUrl
                    ? { backgroundImage: `url(${project.coverUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                    : undefined
                }
              >
                <span className="absolute inset-0 bg-brand-deep/45 group-hover:bg-brand-deep/35 transition-colors" aria-hidden="true" />
                <span className="absolute inset-x-0 bottom-0 p-24 md:p-32 text-on-dark-text">
                  <span className="block font-display text-display font-semibold mb-8">
                    {project.name}
                  </span>
                  <span className="block text-small text-on-dark-text/80">
                    {labels['landing.search.submit']}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="border border-border-line rounded-lg bg-surface-paper p-32">
            <p className="text-body text-text-stone">{labels['landing.promise.stay_body']}</p>
          </div>
        )}
      </section>

      <section className="bg-surface-paper border-y border-border-line">
        <div className="max-w-6xl mx-auto py-80 px-24 grid grid-cols-1 lg:grid-cols-2 gap-56 items-center">
          <div>
            <p className="font-display text-kicker uppercase text-brand-sun mb-12">
              {labels['landing.promise.live']}
            </p>
            <h2 className="font-display text-display-xl font-semibold text-text-ink mb-20">
              {labels['landing.services.title']}
            </h2>
            <p className="text-body text-text-stone mb-28 max-w-xl">
              {labels['landing.services.body']}
            </p>
            <Link
              href="/services"
              className="inline-flex items-center justify-center bg-brand-andaman text-surface-ivory px-32 py-16 rounded-lg font-semibold"
            >
              {labels['landing.services.cta']}
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-16">
            {[
              labels['landing.promise.live_body'],
              labels['landing.promise.own_body'],
              labels['audience.owners.subtitle'],
              labels['audience.providers.subtitle'],
            ].map((copy) => (
              <div key={copy} className="min-h-40 rounded-lg border border-border-line bg-surface-ivory p-20 flex items-end">
                <p className="text-small text-text-ink">{copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto py-80 px-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-24">
          <Link href="/owners" className="border-t border-border-line-2 pt-24 group">
            <h3 className="font-display text-title text-text-ink mb-12">
              {labels['audience.owners.title']}
            </h3>
            <p className="text-body text-text-stone mb-20">
              {labels['audience.owners.subtitle']}
            </p>
            <span className="text-brand-andaman font-semibold">
              {labels['audience.owners.cta']}
            </span>
          </Link>

          <Link href="/management-companies" className="border-t border-border-line-2 pt-24 group">
            <h3 className="font-display text-title text-text-ink mb-12">
              {labels['audience.mc.title']}
            </h3>
            <p className="text-body text-text-stone mb-20">
              {labels['audience.mc.subtitle']}
            </p>
            <span className="text-brand-andaman font-semibold">
              {labels['audience.mc.cta']}
            </span>
          </Link>

          <Link href="/providers" className="border-t border-border-line-2 pt-24 group">
            <h3 className="font-display text-title text-text-ink mb-12">
              {labels['audience.providers.title']}
            </h3>
            <p className="text-body text-text-stone mb-20">
              {labels['audience.providers.subtitle']}
            </p>
            <span className="text-brand-andaman font-semibold">
              {labels['audience.providers.cta']}
            </span>
          </Link>
        </div>
      </section>

      <section className="bg-brand-deep text-on-dark-text">
        <div className="max-w-6xl mx-auto py-80 px-24">
          <h2 className="font-display text-display-xl font-semibold mb-40">
            {labels['landing.trust.title']}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-32 mb-40">
            {trustPoints.map((point) => (
              <div key={point.title} className="border-t border-on-dark-muted/40 pt-20">
                <div className="mb-16 text-brand-sun-soft">
                  <TrustMark size={32} filled />
                </div>
                <h3 className="font-display text-title mb-12">{point.title}</h3>
                <p className="text-body text-on-dark-muted">{point.body}</p>
              </div>
            ))}
          </div>
          <Link href="/trust" className="text-brand-sun-soft font-semibold">
            {labels['landing.trust.cta']}
          </Link>
        </div>
      </section>
    </main>
  );
}
