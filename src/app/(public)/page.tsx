import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { getLabels, getRequestLocale } from '@/lib/i18n';
import { prisma } from '@/lib/prisma';
import { siteUrl, publicPageAlternates, serializeJsonLd } from '@/lib/seo';
import { TrustMark } from '@/components/TrustMark';
import { ProjectCard } from '@/components/ProjectCard';
import { ServiceCard } from '@/components/ServiceCard';
import { DiscoverySearch } from '@/components/DiscoverySearch';
import { listPublicProjects } from '@/modules/projects';
import { listPublicCommercialHomes } from '@/modules/projects/commercial-discovery';
import { listPublicMarketplaceServices } from '@/modules/services';
import { projectPresentationImage } from '@/lib/presentation-media';

export const metadata: Metadata = {
  title: 'myUNO | Stay. Live. Own Phuket.',
  description: 'Discover verified stays, homes and services across Phuket through one connected property platform.',
  alternates: publicPageAlternates('/'),
};

export const dynamic = 'force-dynamic';

const PROJECT_PRIORITY = [
  'Layan Tara Villas',
  'Layantara Villa Resort',
  'The Title Legendary',
  'The Title Serenity',
  'The Base',
  'Oceanstone',
] as const;

function projectRank(name: string): number {
  const index = PROJECT_PRIORITY.findIndex((item) => item.toLowerCase() === name.toLowerCase());
  return index === -1 ? 999 : index;
}

export default async function LandingPage() {
  const locale = getRequestLocale();

  const [labels, rawProjects, commercialHomes, services] = await Promise.all([
    getLabels({
      'landing.hero.kicker': 'PHUKET · ONE CONNECTED EXPERIENCE',
      'landing.hero.title': 'Stay. Live. Own Phuket.',
      'landing.hero.subtitle': 'Handpicked homes, managed residences and everything around them — connected by myUNO.',
      'landing.search.where': 'Where',
      'landing.search.all_phuket': 'All Phuket',
      'landing.search.check_in': 'Check-in',
      'landing.search.check_out': 'Check-out',
      'landing.search.adults': 'Adults',
      'landing.search.children': 'Children',
      'landing.search.submit': 'Search homes',

      'landing.collection.kicker': 'THE MYUNO COLLECTION',
      'landing.collection.title': 'Explore our Phuket collection.',
      'landing.collection.body': 'Real projects, real homes and one connected property record behind every public surface.',
      'landing.collection.cta': 'View all projects',
      'landing.collection.homes': '{count} homes',
      'landing.collection.from_price': 'From ฿{price} / night',
      'landing.collection.no_photo': 'Illustrative image',
      'landing.collection.view': 'Explore',
      'landing.collection.empty': 'Projects are being prepared for publication.',

      'landing.homes.kicker': 'AVAILABLE HOMES',
      'landing.homes.title': 'Homes to buy or rent in Phuket.',
      'landing.homes.body': 'Only homes with active authority, valid commercial offerings and public media appear here.',
      'landing.homes.cta': 'View all homes',
      'landing.homes.bedrooms': 'bedrooms',
      'landing.homes.bathrooms': 'bathrooms',
      'landing.homes.area': 'sqm',
      'landing.homes.details': 'Explore home',
      'landing.homes.terms': 'Commercial terms on request',

      'landing.value.kicker': 'ONE CONNECTED PLATFORM',
      'landing.value.title': 'More than a property listing.',
      'landing.value.body': 'Discover a home, transact through the right commercial path, add services and keep the property connected after the first transaction.',
      'landing.value.stay': 'Stay',
      'landing.value.stay_body': 'Search verified availability and continue into one booking flow.',
      'landing.value.own': 'Own',
      'landing.value.own_body': 'Explore sale and long-term rental offerings on the same physical home.',
      'landing.value.experience': 'Experience',
      'landing.value.experience_body': 'Add trusted services before and during your stay.',
      'landing.value.manage': 'Manage',
      'landing.value.manage_body': 'Owners and managers operate the same property record behind the public experience.',
      'landing.value.cta': 'Discover how myUNO works',

      'landing.services.kicker': 'BEYOND YOUR STAY',
      'landing.services.title': 'Everything around your stay.',
      'landing.services.body': 'Book your home first. Add relevant services before arrival or while you are in Phuket.',
      'landing.services.cta': 'Explore all services',
      'landing.services.vetted': 'Vetted',
      'landing.services.from': 'From',
      'landing.services.no_photo': 'Illustrative image',
      'landing.services.empty': 'Services are being prepared for publication.',

      'landing.audience.kicker': 'PROPERTY ON MYUNO',
      'landing.audience.title': 'One property. Two professional entry points.',
      'landing.audience.owners': 'For owners',
      'landing.audience.owners_body': 'Bring your Phuket property into one connected presentation, booking, operations and reporting flow.',
      'landing.audience.developers': 'For developers & managers',
      'landing.audience.developers_body': 'Connect an entire project without creating a second property or inventory model.',
      'landing.audience.owner_cta': 'Manage my property',
      'landing.audience.developer_cta': 'Partner with myUNO',

      'landing.trust.kicker': 'TRUST IS IN THE DETAILS',
      'landing.trust.title': 'Designed for real stays and real property operations.',
      'landing.trust.verified': 'Verified property information',
      'landing.trust.verified_body': 'Public facts are connected to the underlying project and home records.',
      'landing.trust.handled': 'Transparent commercial terms',
      'landing.trust.handled_body': 'Booking prices are confirmed through the pricing flow before the guest accepts.',
      'landing.trust.protected': 'Controlled access',
      'landing.trust.protected_body': 'Guests, owners, providers and teams see only the workflows relevant to them.',
      'landing.trust.cta': 'How trust works',

      'home.discovery.stay': 'Stay',
      'home.discovery.monthly': 'Monthly',
      'home.discovery.buy': 'Buy',
      'home.discovery.invest': 'Invest',
      'home.discovery.properties': 'Explore properties',
      'home.discovery.hint': 'Explore canonical homes and projects through the commercial path that fits your intent.',
      'home.discovery.error': 'Choose valid arrival and departure dates.',

      'home.final.title': 'Your place in Phuket starts here.',
      'home.final.body': 'Find a stay, discover a home to own, or explore the services around it.',
      'home.final.primary': 'Explore properties',
      'home.final.secondary': 'Browse services',
    }),
    listPublicProjects(locale),
    listPublicCommercialHomes(prisma),
    listPublicMarketplaceServices(prisma, locale, { limit: 6 }).catch(() => []),
  ]);

  const projects = [...rawProjects].sort((a, b) => {
    const rankDifference = projectRank(a.name) - projectRank(b.name);
    return rankDifference || a.name.localeCompare(b.name);
  });

  const heroProject =
    projects.find((project) => /layan/i.test(project.name) && Boolean(project.coverUrl)) ??
    projects.find((project) => Boolean(project.coverUrl)) ??
    projects[0] ??
    null;

  const heroImage = heroProject
    ? projectPresentationImage(heroProject.id, heroProject.coverUrl)
    : projectPresentationImage('homepage', null);

  const organizationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'myUNO',
    legalName: 'Ignatev Estate Co., Ltd',
    url: siteUrl(),
    areaServed: 'Phuket, Thailand',
  };

  const featuredProjects = projects.slice(0, 5);
  const featuredHomes = commercialHomes.slice(0, 6);

  const valueCards = [
    {
      title: labels['landing.value.stay'],
      body: labels['landing.value.stay_body'],
      href: '/search',
    },
    {
      title: labels['landing.value.own'],
      body: labels['landing.value.own_body'],
      href: '/homes?intent=buy',
    },
    {
      title: labels['landing.value.experience'],
      body: labels['landing.value.experience_body'],
      href: '/services',
    },
    {
      title: labels['landing.value.manage'],
      body: labels['landing.value.manage_body'],
      href: '/owners',
    },
  ];

  return (
    <main className="min-h-screen bg-surface-ivory">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(organizationJsonLd) }}
      />

      <section
        className="relative isolate min-h-[calc(100vh-64px)] overflow-hidden bg-brand-deep text-surface-ivory md:min-h-[720px] md:max-h-[860px]"
        aria-labelledby="home-title"
      >
        <Image
          src={heroImage.src}
          alt={heroImage.illustrative ? '' : heroProject?.name ?? ''}
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-brand-deep/95 via-brand-deep/62 to-brand-deep/18" />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-deep/75 via-transparent to-brand-deep/10" />

        <div className="relative mx-auto flex min-h-[calc(100vh-64px)] max-w-7xl flex-col justify-end px-20 pb-28 pt-48 md:min-h-[720px] md:px-32 md:pb-56">
          <div className="max-w-4xl">
            <p className="text-kicker uppercase tracking-[0.18em] text-brand-sun-soft">
              {labels['landing.hero.kicker']}
            </p>
            <h1
              id="home-title"
              className="mt-12 max-w-4xl font-display text-[clamp(3rem,6vw,5.75rem)] font-semibold leading-[0.96] tracking-[-0.04em]"
            >
              {labels['landing.hero.title']}
            </h1>
            <p className="mt-20 max-w-2xl text-lg leading-relaxed text-surface-ivory/88 md:text-xl">
              {labels['landing.hero.subtitle']}
            </p>
          </div>

          <div className="mt-28 max-w-[1180px]">
            <DiscoverySearch
              projects={projects.map((project) => ({ id: project.id, name: project.name }))}
              labels={{
                stay: labels['home.discovery.stay'],
                monthly: labels['home.discovery.monthly'],
                buy: labels['home.discovery.buy'],
                invest: labels['home.discovery.invest'],
                where: labels['landing.search.where'],
                allPhuket: labels['landing.search.all_phuket'],
                checkIn: labels['landing.search.check_in'],
                checkOut: labels['landing.search.check_out'],
                adults: labels['landing.search.adults'],
                children: labels['landing.search.children'],
                explore: labels['landing.search.submit'],
                properties: labels['home.discovery.properties'],
                hint: labels['home.discovery.hint'],
                error: labels['home.discovery.error'],
              }}
            />
          </div>
        </div>
      </section>

      <section className="bg-surface-paper py-56 md:py-96" aria-labelledby="collection-heading">
        <div className="mx-auto max-w-7xl px-20 md:px-32">
          <div className="mb-28 flex flex-col justify-between gap-16 md:mb-40 md:flex-row md:items-end">
            <div className="max-w-2xl">
              <p className="text-kicker uppercase tracking-[0.18em] text-brand-andaman">
                {labels['landing.collection.kicker']}
              </p>
              <h2 id="collection-heading" className="mt-8 font-display text-display-xl font-semibold tracking-[-0.02em] text-text-ink md:text-[52px] md:leading-[58px]">
                {labels['landing.collection.title']}
              </h2>
              <p className="mt-12 max-w-xl text-body text-text-secondary">
                {labels['landing.collection.body']}
              </p>
            </div>
            <Link href="/projects" className="shrink-0 text-body font-semibold text-brand-andaman hover:underline">
              {labels['landing.collection.cta']} →
            </Link>
          </div>

          {featuredProjects.length ? (
            <div className="grid grid-cols-2 gap-12 md:grid-cols-3 md:auto-rows-[250px] md:gap-16">
              {featuredProjects.map((project, index) => (
                <div
                  key={project.id}
                  className={
                    index === 0
                      ? 'col-span-2 md:col-span-2 md:row-span-2'
                      : index === 4
                        ? 'col-span-2 md:col-span-2'
                        : 'col-span-1'
                  }
                >
                  <ProjectCard
                    project={project}
                    featured={index === 0}
                    labels={{
                      homes: labels['landing.collection.homes'],
                      fromPrice: labels['landing.collection.from_price'],
                      noPhoto: labels['landing.collection.no_photo'],
                      view: labels['landing.collection.view'],
                    }}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-border-line bg-surface-ivory p-32 text-text-secondary">
              {labels['landing.collection.empty']}
            </div>
          )}
        </div>
      </section>

      {featuredHomes.length ? (
        <section className="py-56 md:py-96" aria-labelledby="available-homes-heading">
          <div className="mx-auto max-w-7xl px-20 md:px-32">
            <div className="mb-28 flex flex-col justify-between gap-16 md:mb-40 md:flex-row md:items-end">
              <div className="max-w-2xl">
                <p className="text-kicker uppercase tracking-[0.18em] text-brand-andaman">
                  {labels['landing.homes.kicker']}
                </p>
                <h2 id="available-homes-heading" className="mt-8 font-display text-display-xl font-semibold tracking-[-0.02em] text-text-ink">
                  {labels['landing.homes.title']}
                </h2>
                <p className="mt-12 text-body text-text-secondary">
                  {labels['landing.homes.body']}
                </p>
              </div>
              <Link href="/homes?intent=buy" className="shrink-0 text-body font-semibold text-brand-andaman hover:underline">
                {labels['landing.homes.cta']} →
              </Link>
            </div>

            <div className="-mx-20 flex snap-x gap-16 overflow-x-auto px-20 pb-8 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0 lg:grid-cols-4">
              {featuredHomes.slice(0, 4).map((home) => {
                const primaryIntent = home.intents.includes('buy') ? 'buy' : 'rent';
                return (
                  <Link
                    key={home.id}
                    href={`/homes/${encodeURIComponent(home.id)}?intent=${primaryIntent}`}
                    className="group w-[280px] shrink-0 snap-start overflow-hidden rounded-2xl border border-border-line bg-surface-paper transition-shadow duration-structural hover:shadow-card md:w-auto"
                  >
                    {home.imageUrl ? (
                      <Image
                        src={home.imageUrl}
                        alt={home.name}
                        width={720}
                        height={540}
                        className="aspect-[4/3] w-full object-cover transition duration-700 group-hover:scale-[1.02]"
                      />
                    ) : (
                      <div className="aspect-[4/3] bg-surface-paper" />
                    )}
                    <div className="p-20">
                      <p className="text-small font-medium text-brand-andaman">{home.project.name}</p>
                      <h3 className="mt-4 font-display text-title font-semibold text-text-ink">{home.name}</h3>
                      <p className="mt-8 text-small text-text-secondary">
                        {home.bedrooms} {labels['landing.homes.bedrooms']} · {home.bathrooms} {labels['landing.homes.bathrooms']}
                        {home.sizeSqm ? ` · ${home.sizeSqm} ${labels['landing.homes.area']}` : ''}
                      </p>
                      <p className="mt-16 text-small text-text-secondary">{labels['landing.homes.terms']}</p>
                      <span className="mt-12 inline-block text-small font-semibold text-brand-andaman">
                        {labels['landing.homes.details']} →
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      <section className="bg-brand-deep py-56 text-surface-ivory md:py-96" aria-labelledby="value-heading">
        <div className="mx-auto max-w-7xl px-20 md:px-32">
          <div className="max-w-3xl">
            <p className="text-kicker uppercase tracking-[0.18em] text-brand-sun-soft">
              {labels['landing.value.kicker']}
            </p>
            <h2 id="value-heading" className="mt-8 font-display text-display-xl font-semibold tracking-[-0.02em]">
              {labels['landing.value.title']}
            </h2>
            <p className="mt-12 max-w-2xl text-body text-surface-ivory/70">
              {labels['landing.value.body']}
            </p>
          </div>

          <div className="mt-32 grid grid-cols-2 gap-12 md:mt-40 md:grid-cols-4 md:gap-16">
            {valueCards.map((item) => (
              <Link
                key={item.title}
                href={item.href}
                className="group rounded-2xl border border-white/15 bg-white/[0.04] p-20 transition-colors duration-structural hover:bg-white/[0.08] md:p-24"
              >
                <TrustMark size={20} filled className="text-brand-sun-soft" />
                <h3 className="mt-24 font-display text-title font-semibold">{item.title}</h3>
                <p className="mt-8 text-small leading-relaxed text-surface-ivory/68">{item.body}</p>
                <span className="mt-20 inline-block text-small font-semibold text-surface-ivory">Explore →</span>
              </Link>
            ))}
          </div>

          <Link href="/about" className="mt-28 inline-block font-semibold text-brand-sun-soft hover:underline">
            {labels['landing.value.cta']} →
          </Link>
        </div>
      </section>

      <section className="bg-surface-paper py-56 md:py-96" aria-labelledby="services-heading">
        <div className="mx-auto max-w-7xl px-20 md:px-32">
          <div className="mb-28 flex flex-col justify-between gap-16 md:mb-40 md:flex-row md:items-end">
            <div className="max-w-2xl">
              <p className="text-kicker uppercase tracking-[0.18em] text-brand-andaman">
                {labels['landing.services.kicker']}
              </p>
              <h2 id="services-heading" className="mt-8 font-display text-display-xl font-semibold tracking-[-0.02em] text-text-ink">
                {labels['landing.services.title']}
              </h2>
              <p className="mt-12 text-body text-text-secondary">{labels['landing.services.body']}</p>
            </div>
            <Link href="/services" className="shrink-0 font-semibold text-brand-andaman hover:underline">
              {labels['landing.services.cta']} →
            </Link>
          </div>

          {services.length ? (
            <div className="grid grid-cols-2 gap-12 md:grid-cols-3 md:gap-20">
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
            <div className="rounded-2xl border border-border-line p-32 text-text-secondary">
              {labels['landing.services.empty']}
            </div>
          )}
        </div>
      </section>

      <section className="py-56 md:py-96" aria-labelledby="audience-heading">
        <div className="mx-auto max-w-7xl px-20 md:px-32">
          <p className="text-kicker uppercase tracking-[0.18em] text-brand-andaman">
            {labels['landing.audience.kicker']}
          </p>
          <h2 id="audience-heading" className="mt-8 max-w-3xl font-display text-display-xl font-semibold tracking-[-0.02em] text-text-ink">
            {labels['landing.audience.title']}
          </h2>

          <div className="mt-32 grid gap-16 md:grid-cols-2">
            <Link
              href="/owners"
              className="group flex min-h-[300px] flex-col justify-between rounded-2xl border border-border-line bg-surface-paper p-28 transition-shadow duration-structural hover:shadow-card md:p-32"
            >
              <div>
                <p className="text-kicker uppercase tracking-[0.18em] text-brand-andaman">OWNER</p>
                <h3 className="mt-12 font-display text-display font-semibold text-text-ink">
                  {labels['landing.audience.owners']}
                </h3>
                <p className="mt-12 max-w-md text-body text-text-secondary">
                  {labels['landing.audience.owners_body']}
                </p>
              </div>
              <span className="mt-32 font-semibold text-brand-andaman">
                {labels['landing.audience.owner_cta']} →
              </span>
            </Link>

            <Link
              href="/developers"
              className="group flex min-h-[300px] flex-col justify-between rounded-2xl bg-brand-andaman p-28 text-surface-ivory transition-opacity duration-structural hover:opacity-95 md:p-32"
            >
              <div>
                <p className="text-kicker uppercase tracking-[0.18em] text-brand-sun-soft">PARTNER</p>
                <h3 className="mt-12 font-display text-display font-semibold">
                  {labels['landing.audience.developers']}
                </h3>
                <p className="mt-12 max-w-md text-body text-surface-ivory/75">
                  {labels['landing.audience.developers_body']}
                </p>
              </div>
              <span className="mt-32 font-semibold text-surface-ivory">
                {labels['landing.audience.developer_cta']} →
              </span>
            </Link>
          </div>
        </div>
      </section>

      <section className="border-y border-border-line bg-surface-paper py-56 md:py-80" aria-labelledby="trust-heading">
        <div className="mx-auto max-w-7xl px-20 md:px-32">
          <p className="text-kicker uppercase tracking-[0.18em] text-brand-andaman">
            {labels['landing.trust.kicker']}
          </p>
          <h2 id="trust-heading" className="mt-8 max-w-3xl font-display text-display-xl font-semibold tracking-[-0.02em] text-text-ink">
            {labels['landing.trust.title']}
          </h2>

          <div className="mt-32 grid gap-0 md:grid-cols-3">
            {(['verified', 'handled', 'protected'] as const).map((key, index) => (
              <div
                key={key}
                className={`border-t border-border-line py-24 md:border-t-0 md:py-0 ${
                  index > 0 ? 'md:border-l md:pl-28' : ''
                } ${index < 2 ? 'md:pr-28' : ''}`}
              >
                <TrustMark size={22} filled className="text-brand-andaman" />
                <h3 className="mt-16 font-display text-title font-semibold text-text-ink">
                  {labels[`landing.trust.${key}`]}
                </h3>
                <p className="mt-8 text-body text-text-secondary">
                  {labels[`landing.trust.${key}_body`]}
                </p>
              </div>
            ))}
          </div>

          <Link href="/trust" className="mt-28 inline-block font-semibold text-brand-andaman hover:underline">
            {labels['landing.trust.cta']} →
          </Link>
        </div>
      </section>

      <section className="bg-brand-andaman py-56 text-surface-ivory md:py-80">
        <div className="mx-auto max-w-4xl px-20 text-center md:px-32">
          <h2 className="font-display text-display-xl font-semibold tracking-[-0.02em]">
            {labels['home.final.title']}
          </h2>
          <p className="mx-auto mt-12 max-w-2xl text-body text-surface-ivory/75">
            {labels['home.final.body']}
          </p>
          <div className="mt-28 flex flex-col justify-center gap-12 sm:flex-row">
            <Link
              href="/projects"
              className="inline-flex min-h-52 items-center justify-center rounded-lg bg-surface-paper px-28 font-semibold text-brand-deep transition-opacity hover:opacity-90"
            >
              {labels['home.final.primary']} →
            </Link>
            <Link
              href="/services"
              className="inline-flex min-h-52 items-center justify-center rounded-lg border border-white/30 px-28 font-semibold text-surface-ivory transition-colors hover:bg-white/10"
            >
              {labels['home.final.secondary']}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
