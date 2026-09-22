import { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { getLabels, getRequestLocale } from '@/lib/i18n';
import { prisma } from '@/lib/prisma';
import { siteUrl, publicPageAlternates, serializeJsonLd } from '@/lib/seo';
import { SearchBar } from '@/components/SearchBar';
import { TrustMark } from '@/components/TrustMark';
import { ProjectCard } from '@/components/ProjectCard';
import { ServiceCard } from '@/components/ServiceCard';
import { listPublicProjects } from '@/modules/projects';
import { listPublicMarketplaceServices } from '@/modules/services';
import { projectPresentationImage } from '@/lib/presentation-media';

export const metadata: Metadata = {
  title: 'myUNO | Exceptional stays, one trusted platform',
  description: 'Discover serviced homes in Phuket with live availability, transparent pricing and connected local service.',
  alternates: publicPageAlternates('/'),
};
export const dynamic = 'force-dynamic';

export default async function LandingPage() {
  const locale = getRequestLocale();
  const [labels, projects, services] = await Promise.all([
    getLabels({
      'landing.hero.kicker': 'Phuket · Stay beautifully',
      'landing.hero.title': 'A better way to stay.',
      'landing.hero.subtitle': 'Private homes, trusted operations and everything around your stay — connected in one place.',
      'landing.search.check_in': 'Check-in',
      'landing.search.check_out': 'Check-out',
      'landing.search.adults': 'Adults',
      'landing.search.children': 'Children',
      'landing.search.submit': 'Explore stays',
      'landing.collection.kicker': 'The myUNO collection',
      'landing.collection.title': 'Homes worth arriving for',
      'landing.collection.body': 'Every live home comes from the same inventory, pricing and availability system used by our operations team.',
      'landing.collection.cta': 'View all residences',
      'landing.collection.homes': '{count} homes',
      'landing.collection.from_price': 'From ฿{price} / night',
      'landing.collection.no_photo': 'Illustrative image',
      'landing.collection.empty': 'Residences are being prepared for launch.',
      'landing.services.kicker': 'Everything around your stay',
      'landing.services.title': 'One stay. One place for the details.',
      'landing.services.body': 'Book services from the same vetted marketplace used throughout myUNO.',
      'landing.services.cta': 'Explore all services',
      'landing.services.vetted': 'Vetted',
      'landing.services.from': 'From',
      'landing.services.no_photo': 'Illustrative image',
      'landing.services.empty': 'Services are being prepared for launch.',
      'landing.promise.stay': 'Stay',
      'landing.promise.stay_body': 'Search real availability, see the price and reserve the same inventory our team operates.',
      'landing.promise.live': 'Live',
      'landing.promise.live_body': 'One place for services, support and the practical details around your home.',
      'landing.promise.own': 'Own',
      'landing.promise.own_body': 'One operating record for the property, reservations, performance and owner visibility.',
      'landing.trust.kicker': 'Trust, made visible',
      'landing.trust.title': 'The operating standard behind every stay.',
      'landing.trust.verified': 'Verified people',
      'landing.trust.verified_body': 'Identity and role controls connect each person to the right property and workflow.',
      'landing.trust.handled': 'Operations on record',
      'landing.trust.handled_body': 'Requests, reservations and services stay connected instead of disappearing into separate chats.',
      'landing.trust.protected': 'Controlled access',
      'landing.trust.protected_body': 'Role-based access keeps owner, guest, provider and operations surfaces appropriately separated.',
      'landing.trust.cta': 'How trust works',
      'landing.audience.kicker': 'Property on myUNO',
      'landing.audience.title': 'One operating platform from property to guest.',
      'landing.audience.body': 'Owners and developers can connect inventory, operations, distribution and visibility without creating a parallel record of the property.',
      'landing.audience.owners': 'For owners',
      'landing.audience.owners_body': 'See the operating record around your home, reservations and services.',
      'landing.audience.developers': 'For developers',
      'landing.audience.developers_body': 'Bring projects into the same property, commercial and operating model used by myUNO.',
      'landing.audience.owner_cta': 'Owner experience',
      'landing.audience.developer_cta': 'Developer partnerships',
    }),
    listPublicProjects(),
    listPublicMarketplaceServices(prisma, locale, { limit: 3 }).catch(() => []),
  ]);

  const heroProject = projects[0] ?? null;
  const heroImage = heroProject ? projectPresentationImage(heroProject.id, heroProject.coverUrl) : projectPresentationImage('homepage', null);
  const organizationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'myUNO',
    legalName: 'Ignatev Estate Co., Ltd',
    url: siteUrl(),
    areaServed: 'Phuket, Thailand',
  };

  const trustPoints = [
    ['verified', 'verified_body'],
    ['handled', 'handled_body'],
    ['protected', 'protected_body'],
  ] as const;

  return (
    <main className="min-h-screen bg-surface-ivory">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(organizationJsonLd) }} />

      <section className="relative min-h-[76vh] overflow-hidden bg-brand-deep text-surface-ivory">
        <Image src={heroImage.src} alt={heroImage.illustrative ? '' : heroProject?.name ?? ''} fill priority className="object-cover opacity-70 scale-[1.01]" />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-deep via-brand-deep/30 to-transparent" />
        <div className="relative max-w-7xl mx-auto px-24 min-h-[76vh] flex flex-col justify-end pb-48 md:pb-64">
          <div className="max-w-4xl">
            <p className="text-kicker uppercase tracking-[0.22em] text-brand-sun-soft mb-16">{labels['landing.hero.kicker']}</p>
            <h1 className="font-display text-[clamp(3.2rem,8vw,7.5rem)] leading-[0.9] tracking-[-0.04em] font-semibold max-w-4xl">
              {labels['landing.hero.title']}
            </h1>
            <p className="mt-20 text-lg md:text-xl text-surface-ivory/85 max-w-2xl">{labels['landing.hero.subtitle']}</p>
          </div>
          <div className="mt-32 max-w-5xl rounded-2xl bg-surface-paper/95 text-text-ink shadow-2xl backdrop-blur p-8 md:p-12">
            <SearchBar labels={{ checkIn: labels['landing.search.check_in'], checkOut: labels['landing.search.check_out'], adults: labels['landing.search.adults'], children: labels['landing.search.children'], submit: labels['landing.search.submit'] }} />
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-24 py-64 md:py-80">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-20 mb-32">
          <div className="max-w-2xl">
            <p className="text-kicker uppercase tracking-[0.18em] text-brand-andaman">{labels['landing.collection.kicker']}</p>
            <h2 className="font-display text-display-xl font-semibold text-text-ink mt-8">{labels['landing.collection.title']}</h2>
            <p className="text-body text-text-secondary mt-12">{labels['landing.collection.body']}</p>
          </div>
          <Link href="/projects" className="font-semibold text-brand-andaman">{labels['landing.collection.cta']} →</Link>
        </div>
        {projects.length ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-20">
            {projects.slice(0, 3).map((project, index) => (
              <ProjectCard
                key={project.id}
                project={project}
                featured={index === 0}
                labels={{
                  homes: labels['landing.collection.homes'],
                  fromPrice: labels['landing.collection.from_price'],
                  noPhoto: labels['landing.collection.no_photo'],
                }}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-border-line bg-surface-paper p-32 text-text-secondary">
            {labels['landing.collection.empty']}
          </div>
        )}
      </section>

      <section className="bg-surface-paper border-y border-border-line">
        <div className="max-w-7xl mx-auto px-24 py-64 md:py-80">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-20 mb-32">
            <div className="max-w-2xl">
              <p className="text-kicker uppercase tracking-[0.18em] text-brand-andaman">{labels['landing.services.kicker']}</p>
              <h2 className="font-display text-display-xl font-semibold text-text-ink mt-8">{labels['landing.services.title']}</h2>
              <p className="text-body text-text-secondary mt-12">{labels['landing.services.body']}</p>
            </div>
            <Link href="/services" className="font-semibold text-brand-andaman">{labels['landing.services.cta']} →</Link>
          </div>
          {services.length ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-20">
              {services.map((service) => (
                <ServiceCard
                  key={service.id}
                  service={service}
                  href={`/services/${service.id}`}
                  labels={{
                    vetted: labels['landing.services.vetted'],
                    from: labels['landing.services.from'],
                    noPhoto: labels['landing.services.no_photo'],
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-border-line bg-surface-ivory p-32 text-text-secondary">
              {labels['landing.services.empty']}
            </div>
          )}
        </div>
      </section>

      <section className="bg-brand-deep text-surface-ivory">
        <div className="max-w-7xl mx-auto px-24 py-64 md:py-80 grid grid-cols-1 md:grid-cols-3 gap-40">
          {([['stay', 'stay_body'], ['live', 'live_body'], ['own', 'own_body']] as const).map(([title, body], index) => (
            <div key={title} className="border-t border-white/20 pt-20">
              <div className="flex items-center gap-8 text-brand-sun-soft">
                <TrustMark size={18} filled />
                <span className="text-small">0{index + 1}</span>
              </div>
              <h3 className="font-display text-display font-semibold mt-16">{labels[`landing.promise.${title}`]}</h3>
              <p className="text-body text-surface-ivory/70 mt-12">{labels[`landing.promise.${body}`]}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-24 py-64 md:py-80">
        <div className="max-w-2xl mb-40">
          <p className="text-kicker uppercase tracking-[0.18em] text-brand-andaman">{labels['landing.trust.kicker']}</p>
          <h2 className="font-display text-display-xl font-semibold text-text-ink mt-8">{labels['landing.trust.title']}</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-32">
          {trustPoints.map(([title, body]) => (
            <div key={title} className="border-t border-border-line pt-20">
              <TrustMark size={24} filled className="text-brand-andaman" />
              <h3 className="font-display text-title text-text-ink mt-16">{labels[`landing.trust.${title}`]}</h3>
              <p className="text-body text-text-secondary mt-12">{labels[`landing.trust.${body}`]}</p>
            </div>
          ))}
        </div>
        <Link href="/trust" className="inline-block mt-32 font-semibold text-brand-andaman">{labels['landing.trust.cta']} →</Link>
      </section>

      <section className="bg-brand-andaman text-surface-ivory">
        <div className="max-w-7xl mx-auto px-24 py-64 md:py-80">
          <div className="max-w-3xl">
            <p className="text-kicker uppercase tracking-[0.18em] text-brand-sun-soft">{labels['landing.audience.kicker']}</p>
            <h2 className="font-display text-display-xl font-semibold mt-8">{labels['landing.audience.title']}</h2>
            <p className="text-body text-surface-ivory/75 mt-12">{labels['landing.audience.body']}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-20 mt-40">
            <Link href="/owners" className="group rounded-2xl border border-white/20 bg-surface-paper/5 p-28 transition hover:bg-surface-paper/10">
              <h3 className="font-display text-display font-semibold">{labels['landing.audience.owners']}</h3>
              <p className="text-body text-surface-ivory/70 mt-12">{labels['landing.audience.owners_body']}</p>
              <p className="mt-24 font-semibold text-brand-sun-soft">{labels['landing.audience.owner_cta']} →</p>
            </Link>
            <Link href="/developers" className="group rounded-2xl border border-white/20 bg-surface-paper/5 p-28 transition hover:bg-surface-paper/10">
              <h3 className="font-display text-display font-semibold">{labels['landing.audience.developers']}</h3>
              <p className="text-body text-surface-ivory/70 mt-12">{labels['landing.audience.developers_body']}</p>
              <p className="mt-24 font-semibold text-brand-sun-soft">{labels['landing.audience.developer_cta']} →</p>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
