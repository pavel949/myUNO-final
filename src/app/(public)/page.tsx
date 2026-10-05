import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { getLabels, getRequestLocale } from '@/lib/i18n';
import { siteUrl, publicPageAlternates, serializeJsonLd } from '@/lib/seo';
import { TrustMark } from '@/components/TrustMark';
import { ProjectCard } from '@/components/ProjectCard';
import { ServiceCard } from '@/components/ServiceCard';
import { HomeFinder } from '@/components/home/HomeFinder';
import { HomeIntentProvider, parseHomeIntent } from '@/components/home/HomeIntentProvider';
import { HomeOffersRail, type HomeOfferItem } from '@/components/home/HomeOffersRail';
import { getPublicHomepageData } from '@/modules/home/public-homepage.service';
import { groupServicesBySituation } from '@/modules/home/home-read-model';
import { projectPresentationImage } from '@/lib/presentation-media';
import type { PlaceOption } from '@/lib/place-search';
import { getDestination } from '@/modules/destinations';
import { prisma } from '@/lib/prisma';
import { track } from '@/modules/analytics/track';

export const dynamic = 'force-dynamic';

const HOME_AREA_IMAGE_SIZES = '(max-width: 768px) 100vw, 33vw';

export async function generateMetadata(): Promise<Metadata> {
  const labels = await getLabels({
    'landing.hp.meta.title': 'myUNO | Homes, property and local services in Phuket',
    'landing.hp.meta.description': 'Holiday and long-term homes, property to buy and local services in Phuket — on one platform, with clear responsibility at every step.',
  });
  return {
    title: labels['landing.hp.meta.title'],
    description: labels['landing.hp.meta.description'],
    alternates: publicPageAlternates('/'),
  };
}

function formatThb(amount: number, locale: string): string {
  return Math.round(amount).toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US');
}

export default async function LandingPage({
  searchParams,
}: {
  searchParams?: { intent?: string };
}) {
  const locale = getRequestLocale();
  const activeDestination = getDestination();
  const initialIntent = parseHomeIntent(searchParams?.intent);

  await track(prisma, 'page_landing_viewed', {
    locale,
    destination: activeDestination.key,
  }).catch(() => null);

  const [labels, homepageData] = await Promise.all([
    getLabels({
      'landing.search.check_in': 'Check-in',
      'landing.search.check_out': 'Check-out',
      'landing.search.adults': 'Adults',
      'landing.search.children': 'Children',
      'home.discovery.error': 'Choose valid arrival and departure dates.',
      'landing.services.vetted': 'Vetted',
      'landing.services.from': 'From',
      'landing.services.no_photo': 'Illustrative image',
      'landing.hp.meta.title': 'myUNO | Homes, property and local services in Phuket',
      'landing.hp.meta.description': 'Holiday and long-term homes, property to buy and local services in Phuket — on one platform, with clear responsibility at every step.',
      'landing.hp.hero.title': 'Your home and your life in Phuket.',
      'landing.hp.hero.subtitle': 'Holiday and long-term homes, property to buy and local services — on one platform.',
      'landing.hp.hero.no_dates': 'Browse the catalogue without dates',
      'landing.hp.hero.dates_note': 'Prices and availability are confirmed once you choose dates.',
      'landing.hp.owner.question': 'Own a property?',
      'landing.hp.owner.sell': 'Sell',
      'landing.hp.owner.rent': 'Rent out',
      'landing.hp.owner.manage': 'Hand over to management',
      'landing.hp.finder.aria': 'Find a home',
      'landing.hp.finder.mode.stay': 'Holiday',
      'landing.hp.finder.mode.monthly': 'Long-term',
      'landing.hp.finder.mode.buy': 'Buy',
      'landing.hp.finder.place.label': 'Area or complex',
      'landing.hp.finder.place.placeholder': 'Start typing a name',
      'landing.hp.finder.place.all': 'All Phuket',
      'landing.hp.finder.place.areas': 'Areas',
      'landing.hp.finder.place.complexes': 'Complexes',
      'landing.hp.finder.place.empty': 'Nothing found. Try another name or search all Phuket.',
      'landing.hp.finder.place.clear': 'Clear place',
      'landing.hp.finder.cta.stay': 'Find a stay',
      'landing.hp.finder.cta.monthly': 'Find a home to live in',
      'landing.hp.finder.cta.buy': 'Find property',
      'landing.hp.finder.filters.more': 'More filters',
      'landing.hp.finder.filters.type': 'Property type',
      'landing.hp.finder.filters.any': 'Any',
      'landing.hp.finder.filters.villa': 'Villa',
      'landing.hp.finder.filters.condo': 'Condo',
      'landing.hp.finder.filters.bedrooms': 'Bedrooms',
      'landing.hp.finder.filters.budget_stay': 'Budget up to, ฿ / night',
      'landing.hp.finder.filters.budget_monthly': 'Budget up to, ฿ / month',
      'landing.hp.finder.filters.budget_buy': 'Purchase budget up to, ฿',
      'landing.hp.finder.picker.previous': 'Previous month',
      'landing.hp.finder.picker.next': 'Next month',
      'landing.hp.finder.picker.done': 'Done',
      'landing.hp.finder.picker.clear': 'Clear',
      'landing.hp.complexes.kicker': 'Complexes and residences',
      'landing.hp.complexes.title': 'Choose the place you want to live',
      'landing.hp.complexes.body': 'Open a complex to see its description, shared areas, location, current offers and services.',
      'landing.hp.complexes.cta': 'All complexes',
      'landing.hp.complexes.homes': '{count} homes',
      'landing.hp.complexes.no_photo': 'Illustrative image',
      'landing.hp.complexes.view': 'Open complex',
      'landing.hp.complexes.empty': 'Complexes are being prepared for publication.',
      'landing.hp.offers.kicker': 'Find your home',
      'landing.hp.offers.title.stay': 'Homes for your holiday',
      'landing.hp.offers.title.monthly': 'Homes for long-term living',
      'landing.hp.offers.title.buy': 'Property for sale',
      'landing.hp.offers.body.stay': 'Pick dates in the search to see the total price for your stay.',
      'landing.hp.offers.body.monthly': 'Monthly rent and terms are shown on each home.',
      'landing.hp.offers.body.buy': 'Each listing opens with its terms and a way to request a viewing.',
      'landing.hp.offers.cta.stay': 'All holiday homes',
      'landing.hp.offers.cta.monthly': 'All long-term homes',
      'landing.hp.offers.cta.buy': 'All property for sale',
      'landing.hp.offers.empty': 'No published offers in this mode yet. Try another mode or browse the catalogue.',
      'landing.hp.offers.price.base_nightly': 'Base rate from ฿{price} / night',
      'landing.hp.offers.price.base_note': 'Total price is calculated for your dates',
      'landing.hp.offers.price.monthly': '฿{price} / month',
      'landing.hp.offers.price.sale': '฿{price}',
      'landing.hp.offers.price.on_request': 'Terms on request',
      'landing.hp.offers.bedrooms': 'bedrooms',
      'landing.hp.offers.bathrooms': 'bathrooms',
      'landing.hp.offers.sqm': 'sqm',
      'landing.hp.offers.guests': '{count} guests',
      'landing.hp.offers.open': 'View',
      'landing.hp.offers.no_photo': 'Illustrative image',
      'landing.hp.offers.tablist': 'Choose what you are looking for',
      'landing.hp.services.kicker': 'Services',
      'landing.hp.services.title': 'Everything for arrival and living',
      'landing.hp.services.body': 'Order a service on its own — a stay is not required. Each offer shows the provider, price and how it is confirmed.',
      'landing.hp.services.cta': 'All services',
      'landing.hp.services.group.arrival': 'For arrival',
      'landing.hp.services.group.leisure': 'During your stay',
      'landing.hp.services.group.home': 'For the home',
      'landing.hp.services.empty': 'Services are being prepared for publication.',
      'landing.hp.areas.kicker': 'Areas',
      'landing.hp.areas.title': 'Choose your part of the island',
      'landing.hp.areas.body': 'A short introduction to each area, with the complexes and homes in it.',
      'landing.hp.areas.cta': 'All areas',
      'landing.hp.areas.projects': '{count} complexes',
      'landing.hp.areas.open': 'Open area',
      'landing.hp.owners.kicker': 'For owners',
      'landing.hp.owners.title': 'Your property, under control',
      'landing.hp.owners.body': 'Choose your goal. Each one has its own path and its own request — publishing a home and managing it are different decisions.',
      'landing.hp.owners.sell.title': 'Sell',
      'landing.hp.owners.sell.body': 'Valuation and support through the sale. Start with a short request.',
      'landing.hp.owners.sell.cta': 'Request a valuation',
      'landing.hp.owners.rent.title': 'Rent out',
      'landing.hp.owners.rent.body': 'Find holiday or long-term tenants. Then choose who looks after the home.',
      'landing.hp.owners.rent.cta': 'Start renting out',
      'landing.hp.owners.self.title': 'List it yourself',
      'landing.hp.owners.self.body': 'Keep your own team and terms. Add the property, we check it, then it is published.',
      'landing.hp.owners.self.cta': 'Add a property',
      'landing.hp.owners.manage.title': 'Hand over to management',
      'landing.hp.owners.manage.body': 'Operations, costs and reporting handled for you. Start with an assessment of the property.',
      'landing.hp.owners.manage.cta': 'Request an assessment',
      'landing.hp.owners.existing': 'Already a client?',
      'landing.hp.owners.existing_cta': 'Open the owner workspace',
      'landing.hp.partners.title': 'For partners',
      'landing.hp.partners.developers': 'Developers',
      'landing.hp.partners.management': 'Management companies',
      'landing.hp.partners.providers': 'Service providers',
      'landing.hp.partners.all': 'All partner paths',
      'landing.hp.after.kicker': 'After you choose',
      'landing.hp.after.title': 'My UNO keeps everything in one place',
      'landing.hp.after.body': 'Trips, requests, messages, service orders and owner reporting live in one account. One person can be a guest, a buyer and an owner at the same time.',
      'landing.hp.after.trips': 'My trips',
      'landing.hp.after.messages': 'Messages',
      'landing.hp.after.requests': 'Requests',
      'landing.hp.after.orders': 'Service orders',
      'landing.hp.after.owner': 'Owner workspace',
      'landing.hp.after.cta': 'Open My UNO',
      'landing.hp.help.title': 'Questions? We will answer in your language.',
      'landing.hp.help.body': 'See who is responsible, how information is verified and how to reach a team.',
      'landing.hp.help.help': 'Help centre',
      'landing.hp.help.desks': 'Language desks',
      'landing.hp.help.trust': 'How we verify information',
    }),
    getPublicHomepageData(locale),
  ]);

  const { projects, commercialHomes, services, stayUnits, areas, placeAreas } = homepageData;
  const L = (key: string): string => (labels as Record<string, string>)[key] ?? key;

  const heroProject = projects.find((project) => Boolean(project.coverUrl)) ?? projects[0] ?? null;
  const heroImage = heroProject
    ? projectPresentationImage(heroProject.id, heroProject.coverUrl)
    : projectPresentationImage('homepage', null);

  const organizationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'myUNO',
    legalName: 'Ignatev Estate Co., Ltd',
    url: siteUrl(),
    areaServed: `${activeDestination.name}, Thailand`,
  };

  const places: PlaceOption[] = [
    ...placeAreas.map((area) => ({
      kind: 'area' as const,
      id: area.id,
      slug: area.slug,
      name: area.displayName,
    })),
    ...projects.map((project) => ({
      kind: 'project' as const,
      id: project.id,
      name: project.name,
      areaName: project.areaName,
    })),
  ];

  const offers: HomeOfferItem[] = [
    ...stayUnits.map((unit): HomeOfferItem => {
      const media = projectPresentationImage(unit.id, unit.coverUrl);
      return {
        key: `stay:${unit.id}`,
        intent: 'stay',
        name: unit.name,
        projectName: unit.project.name,
        projectId: unit.project.id,
        areaSlug: unit.project.areaSlug,
        href: `/units/${unit.id}`,
        imageSrc: media.src,
        imageIllustrative: media.illustrative,
        bedrooms: unit.bedrooms,
        bathrooms: unit.bathrooms,
        guests: unit.maxGuests,
        // The base rate is indicative: it is never presented as a total.
        priceMode: 'base_nightly',
        priceText: L('landing.hp.offers.price.base_nightly').replace(
          '{price}',
          formatThb(unit.baseNightlyThb / 100, locale)
        ),
        priceNote: L('landing.hp.offers.price.base_note'),
      };
    }),
    ...commercialHomes.flatMap((home) =>
      home.intents.map((intent): HomeOfferItem => {
        const media = projectPresentationImage(home.id, home.imageUrl);
        const price = home.priceThb[intent];
        const monthly = intent === 'rent';
        return {
          key: `${intent}:${home.id}`,
          intent: monthly ? 'monthly' : 'buy',
          name: home.name,
          projectName: home.project.name,
          projectId: home.project.id,
          areaSlug: home.project.areaSlug,
          href: `/homes/${encodeURIComponent(home.id)}?intent=${intent}`,
          imageSrc: media.src,
          imageIllustrative: media.illustrative,
          bedrooms: home.bedrooms,
          bathrooms: home.bathrooms,
          sizeSqm: home.sizeSqm,
          priceMode: price == null ? 'on_request' : monthly ? 'monthly' : 'sale',
          priceText:
            price == null
              ? L('landing.hp.offers.price.on_request')
              : L(monthly ? 'landing.hp.offers.price.monthly' : 'landing.hp.offers.price.sale').replace(
                  '{price}',
                  formatThb(price, locale)
                ),
        };
      })
    ),
  ];

  const featuredProjects = projects.slice(0, 5);
  const serviceGroups = groupServicesBySituation(services, 2);
  const intents = ['stay', 'monthly', 'buy'] as const;
  const perIntent = <T,>(build: (intent: (typeof intents)[number]) => T) =>
    ({ stay: build('stay'), monthly: build('monthly'), buy: build('buy') }) as Record<(typeof intents)[number], T>;

  const ownerGoals = [
    { href: '/sell', key: 'sell' },
    { href: '/rent-out', key: 'rent' },
    { href: '/property/onboard?kind=home', key: 'self' },
    { href: '/manage', key: 'manage' },
  ] as const;

  const sectionHead = 'mb-32 flex flex-col justify-between gap-16 md:mb-40 md:flex-row md:items-end';
  const linkMore = 'shrink-0 text-body font-semibold text-brand-andaman hover:underline';

  return (
    <main className="min-h-screen bg-surface-ivory">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(organizationJsonLd) }}
      />

      <HomeIntentProvider initialIntent={initialIntent}>
        <section
          className="relative isolate min-h-[calc(100svh-64px)] overflow-hidden bg-surface-paper text-text-ink md:min-h-[720px]"
          aria-labelledby="home-title"
        >
          <Image
            src={heroImage.src}
            alt={heroImage.illustrative ? '' : heroProject?.name ?? ''}
            fill
            priority
            sizes={['100', 'vw'].join('')}
            className="object-cover saturate-[1.08]"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-surface-paper/85 via-surface-paper/30 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-brand-deep/20 via-transparent to-transparent" />

          <div className="relative mx-auto flex min-h-[calc(100svh-64px)] max-w-content flex-col justify-end px-20 pb-24 pt-32 md:min-h-[720px] md:px-32 md:pb-56">
            <div className="max-w-2xl">
              <h1
                id="home-title"
                className="max-w-2xl font-display text-display-hero font-semibold text-text-ink md:text-display-hero-lg"
              >
                {labels['landing.hp.hero.title']}
              </h1>
              <p className="mt-16 max-w-xl text-body text-text-ink md:text-subtitle">
                {labels['landing.hp.hero.subtitle']}
              </p>
            </div>

            <div className="mt-32 max-w-content">
              <HomeFinder
                locale={locale}
                places={places}
                labels={{
                  aria: labels['landing.hp.finder.aria'],
                  mode: {
                    stay: labels['landing.hp.finder.mode.stay'],
                    monthly: labels['landing.hp.finder.mode.monthly'],
                    buy: labels['landing.hp.finder.mode.buy'],
                  },
                  cta: {
                    stay: labels['landing.hp.finder.cta.stay'],
                    monthly: labels['landing.hp.finder.cta.monthly'],
                    buy: labels['landing.hp.finder.cta.buy'],
                  },
                  place: {
                    label: labels['landing.hp.finder.place.label'],
                    placeholder: labels['landing.hp.finder.place.placeholder'],
                    all: labels['landing.hp.finder.place.all'],
                    areas: labels['landing.hp.finder.place.areas'],
                    complexes: labels['landing.hp.finder.place.complexes'],
                    empty: labels['landing.hp.finder.place.empty'],
                    clear: labels['landing.hp.finder.place.clear'],
                  },
                  checkIn: labels['landing.search.check_in'],
                  checkOut: labels['landing.search.check_out'],
                  adults: labels['landing.search.adults'],
                  children: labels['landing.search.children'],
                  datesError: labels['home.discovery.error'],
                  filters: {
                    more: labels['landing.hp.finder.filters.more'],
                    type: labels['landing.hp.finder.filters.type'],
                    any: labels['landing.hp.finder.filters.any'],
                    villa: labels['landing.hp.finder.filters.villa'],
                    condo: labels['landing.hp.finder.filters.condo'],
                    bedrooms: labels['landing.hp.finder.filters.bedrooms'],
                    budget: {
                      stay: labels['landing.hp.finder.filters.budget_stay'],
                      monthly: labels['landing.hp.finder.filters.budget_monthly'],
                      buy: labels['landing.hp.finder.filters.budget_buy'],
                    },
                  },
                  picker: {
                    previous: labels['landing.hp.finder.picker.previous'],
                    next: labels['landing.hp.finder.picker.next'],
                    close: labels['landing.hp.finder.picker.done'],
                    clear: labels['landing.hp.finder.picker.clear'],
                  },
                }}
              />
              <p className="mt-12 px-4 text-small text-text-ink">
                {labels['landing.hp.hero.dates_note']}{' '}
                <Link href="/projects" className="font-semibold text-brand-andaman hover:underline">
                  {labels['landing.hp.hero.no_dates']} →
                </Link>
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-x-16 gap-y-8 px-4 text-small">
                <span className="text-text-ink">{labels['landing.hp.owner.question']}</span>
                <Link href="/sell" className="font-semibold text-brand-andaman hover:underline">
                  {labels['landing.hp.owner.sell']}
                </Link>
                <Link href="/rent-out" className="font-semibold text-brand-andaman hover:underline">
                  {labels['landing.hp.owner.rent']}
                </Link>
                <Link href="/manage" className="font-semibold text-brand-andaman hover:underline">
                  {labels['landing.hp.owner.manage']}
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-surface-paper py-56 md:py-96" aria-labelledby="complexes-heading">
          <div className="mx-auto max-w-content px-20 md:px-32">
            <div className={sectionHead}>
              <div className="max-w-2xl">
                <p className="text-kicker uppercase text-brand-andaman">{labels['landing.hp.complexes.kicker']}</p>
                <h2 id="complexes-heading" className="mt-8 font-display text-display-xl font-semibold text-text-ink">
                  {labels['landing.hp.complexes.title']}
                </h2>
                <p className="mt-12 max-w-xl text-body text-text-secondary">{labels['landing.hp.complexes.body']}</p>
              </div>
              <Link href="/projects" className={linkMore}>
                {labels['landing.hp.complexes.cta']} →
              </Link>
            </div>

            {featuredProjects.length ? (
              <div className="grid grid-cols-1 gap-12 sm:grid-cols-2 md:auto-rows-[250px] md:grid-cols-3 md:gap-16">
                {featuredProjects.map((project, index) => (
                  <div
                    key={project.id}
                    className={
                      index === 0
                        ? 'min-w-0 sm:col-span-2 md:col-span-2 md:row-span-2'
                        : index === 4
                          ? 'min-w-0 sm:col-span-2 md:col-span-2'
                          : 'col-span-1 min-w-0'
                    }
                  >
                    <ProjectCard
                      project={project}
                      featured={index === 0}
                      labels={{
                        homes: labels['landing.hp.complexes.homes'],
                        noPhoto: labels['landing.hp.complexes.no_photo'],
                        view: labels['landing.hp.complexes.view'],
                      }}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-border-line bg-surface-ivory p-32 text-text-secondary">
                {labels['landing.hp.complexes.empty']}
              </div>
            )}
          </div>
        </section>

        <section className="bg-surface-ivory py-56 md:py-96" aria-labelledby="offers-heading">
          <div className="mx-auto max-w-content px-20 md:px-32">
            <p className="text-kicker uppercase text-brand-andaman">{labels['landing.hp.offers.kicker']}</p>
            <HomeOffersRail
              items={offers}
              labels={{
                tablist: labels['landing.hp.offers.tablist'],
                mode: perIntent((i) => L(`landing.hp.finder.mode.${i}`)),
                title: perIntent((i) => L(`landing.hp.offers.title.${i}`)),
                body: perIntent((i) => L(`landing.hp.offers.body.${i}`)),
                cta: perIntent((i) => L(`landing.hp.offers.cta.${i}`)),
                empty: labels['landing.hp.offers.empty'],
                bedrooms: labels['landing.hp.offers.bedrooms'],
                bathrooms: labels['landing.hp.offers.bathrooms'],
                sqm: labels['landing.hp.offers.sqm'],
                guests: labels['landing.hp.offers.guests'],
                open: labels['landing.hp.offers.open'],
                noPhoto: labels['landing.hp.offers.no_photo'],
              }}
            />
          </div>
        </section>
      </HomeIntentProvider>

      <section className="bg-surface-paper py-56 md:py-96" aria-labelledby="services-heading">
        <div className="mx-auto max-w-content px-20 md:px-32">
          <div className={sectionHead}>
            <div className="max-w-2xl">
              <p className="text-kicker uppercase text-brand-andaman">{labels['landing.hp.services.kicker']}</p>
              <h2 id="services-heading" className="mt-8 font-display text-display-xl font-semibold text-text-ink">
                {labels['landing.hp.services.title']}
              </h2>
              <p className="mt-12 text-body text-text-secondary">{labels['landing.hp.services.body']}</p>
            </div>
            <Link href="/services" className={linkMore}>
              {labels['landing.hp.services.cta']} →
            </Link>
          </div>

          {serviceGroups.length ? (
            <div className="grid gap-32">
              {serviceGroups.map((group) => (
                <div key={group.key}>
                  <h3 className="mb-16 font-display text-title font-semibold text-text-ink">
                    {L(`landing.hp.services.group.${group.key}`)}
                  </h3>
                  <div className="grid grid-cols-1 gap-16 sm:grid-cols-2 lg:grid-cols-3 lg:gap-20">
                    {group.items.map((service) => (
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
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-border-line p-32 text-text-secondary">
              {labels['landing.hp.services.empty']}
            </div>
          )}
        </div>
      </section>

      {areas.length ? (
        <section className="bg-surface-ivory py-56 md:py-96" aria-labelledby="areas-heading">
          <div className="mx-auto max-w-content px-20 md:px-32">
            <div className={sectionHead}>
              <div className="max-w-2xl">
                <p className="text-kicker uppercase text-brand-andaman">{labels['landing.hp.areas.kicker']}</p>
                <h2 id="areas-heading" className="mt-8 font-display text-display-xl font-semibold text-text-ink">
                  {labels['landing.hp.areas.title']}
                </h2>
                <p className="mt-12 max-w-xl text-body text-text-secondary">{labels['landing.hp.areas.body']}</p>
              </div>
              <Link href="/areas" className={linkMore}>
                {labels['landing.hp.areas.cta']} →
              </Link>
            </div>

            <div className="grid gap-16 md:grid-cols-3">
              {areas.slice(0, 3).map((area) => {
                const media = projectPresentationImage(area.id, area.coverUrl);
                return (
                  <Link
                    key={area.id}
                    href={`/areas/${area.slug}`}
                    className="group relative isolate min-h-[320px] overflow-hidden rounded-2xl bg-brand-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-andaman"
                  >
                    <Image
                      src={media.src}
                      alt={media.illustrative ? '' : area.displayName}
                      fill
                      sizes={HOME_AREA_IMAGE_SIZES}
                      className="object-cover transition-transform duration-structural group-hover:scale-[1.02]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-brand-deep/90 via-brand-deep/20 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-24 text-surface-ivory">
                      <p className="text-small text-surface-ivory/80">
                        {labels['landing.hp.areas.projects'].replace('{count}', String(area.projectCount))}
                      </p>
                      <h3 className="mt-4 font-display text-display font-semibold">{area.displayName}</h3>
                      {area.description ? (
                        <p className="mt-8 line-clamp-2 text-small text-surface-ivory/80">{area.description}</p>
                      ) : null}
                      <span className="mt-16 inline-block text-small font-semibold">
                        {labels['landing.hp.areas.open']} →
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      <section className="bg-surface-paper py-56 md:py-96" aria-labelledby="owners-heading">
        <div className="mx-auto max-w-content px-20 md:px-32">
          <p className="text-kicker uppercase text-brand-andaman">{labels['landing.hp.owners.kicker']}</p>
          <h2 id="owners-heading" className="mt-8 max-w-3xl font-display text-display-xl font-semibold text-text-ink">
            {labels['landing.hp.owners.title']}
          </h2>
          <p className="mt-12 max-w-2xl text-body text-text-secondary">{labels['landing.hp.owners.body']}</p>

          <div className="mt-32 grid gap-16 md:grid-cols-2 lg:grid-cols-4">
            {ownerGoals.map((goal, index) => (
              <Link
                key={goal.key}
                href={goal.href}
                className={`group flex min-h-[240px] flex-col justify-between rounded-2xl p-24 transition-shadow duration-structural hover:shadow-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-andaman ${
                  index === 3
                    ? 'bg-brand-andaman text-surface-ivory'
                    : 'border border-border-line bg-surface-ivory text-text-ink'
                }`}
              >
                <div>
                  <h3 className="font-display text-title font-semibold">{L(`landing.hp.owners.${goal.key}.title`)}</h3>
                  <p className={`mt-12 text-body ${index === 3 ? 'text-surface-ivory/80' : 'text-text-secondary'}`}>
                    {L(`landing.hp.owners.${goal.key}.body`)}
                  </p>
                </div>
                <span className={`mt-24 font-semibold ${index === 3 ? 'text-surface-ivory' : 'text-brand-andaman'}`}>
                  {L(`landing.hp.owners.${goal.key}.cta`)} →
                </span>
              </Link>
            ))}
          </div>

          <div className="mt-32 grid gap-24 border-t border-border-line pt-24 md:grid-cols-2">
            <p className="text-body text-text-secondary">
              {labels['landing.hp.owners.existing']}{' '}
              <Link href="/app" className="font-semibold text-brand-andaman hover:underline">
                {labels['landing.hp.owners.existing_cta']} →
              </Link>
            </p>
            <div className="flex flex-wrap items-center gap-x-16 gap-y-8 text-body">
              <span className="font-semibold text-text-ink">{labels['landing.hp.partners.title']}</span>
              <Link href="/developers" className="text-brand-andaman hover:underline">{labels['landing.hp.partners.developers']}</Link>
              <Link href="/management-companies" className="text-brand-andaman hover:underline">{labels['landing.hp.partners.management']}</Link>
              <Link href="/providers" className="text-brand-andaman hover:underline">{labels['landing.hp.partners.providers']}</Link>
              <Link href="/partners" className="font-semibold text-brand-andaman hover:underline">{labels['landing.hp.partners.all']} →</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-brand-deep py-56 text-surface-ivory md:py-80" aria-labelledby="after-heading">
        <div className="mx-auto max-w-content px-20 md:px-32">
          <div className="grid gap-32 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)] lg:items-center">
            <div>
              <p className="text-kicker uppercase text-brand-sun-soft">{labels['landing.hp.after.kicker']}</p>
              <h2 id="after-heading" className="mt-8 font-display text-display-xl font-semibold">
                {labels['landing.hp.after.title']}
              </h2>
              <p className="mt-12 max-w-xl text-body text-surface-ivory/80">{labels['landing.hp.after.body']}</p>
              <Link
                href="/app"
                className="mt-32 inline-flex min-h-48 items-center justify-center rounded-lg bg-surface-paper px-24 font-semibold text-brand-deep transition-opacity hover:opacity-90"
              >
                {labels['landing.hp.after.cta']} →
              </Link>
            </div>
            <ul className="grid gap-12">
              {[
                { href: '/trips', key: 'trips' },
                { href: '/messages', key: 'messages' },
                { href: '/tickets', key: 'requests' },
                { href: '/services/orders', key: 'orders' },
                { href: '/app', key: 'owner' },
              ].map((item) => (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    className="flex min-h-44 items-center gap-12 border-b border-surface-ivory/10 pb-12 text-body text-surface-ivory hover:text-brand-sun-soft"
                  >
                    <TrustMark size={18} filled className="shrink-0 text-brand-sun" />
                    {L(`landing.hp.after.${item.key}`)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="bg-surface-ivory py-44 md:py-56" aria-labelledby="help-heading">
        <div className="mx-auto flex max-w-content flex-col justify-between gap-24 px-20 md:flex-row md:items-center md:px-32">
          <div className="max-w-xl">
            <h2 id="help-heading" className="font-display text-display font-semibold text-text-ink">
              {labels['landing.hp.help.title']}
            </h2>
            <p className="mt-8 text-body text-text-secondary">{labels['landing.hp.help.body']}</p>
          </div>
          <div className="flex flex-wrap gap-x-24 gap-y-12 text-body font-semibold text-brand-andaman">
            <Link href="/help" className="min-h-44 hover:underline">{labels['landing.hp.help.help']} →</Link>
            <Link href="/desks" className="min-h-44 hover:underline">{labels['landing.hp.help.desks']} →</Link>
            <Link href="/trust" className="min-h-44 hover:underline">{labels['landing.hp.help.trust']} →</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
