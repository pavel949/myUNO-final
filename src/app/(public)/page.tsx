import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { getLabels, getRequestLocale } from '@/lib/i18n';
import { siteUrl, publicPageAlternates, serializeJsonLd } from '@/lib/seo';
import { TrustMark } from '@/components/TrustMark';
import { ProjectCard } from '@/components/ProjectCard';
import { ServiceCard } from '@/components/ServiceCard';
import { DiscoverySearch } from '@/components/DiscoverySearch';
import { HomeIntentRail, type HomeRailItem } from '@/components/HomeIntentRail';
import { getPublicHomepageData } from '@/modules/home/public-homepage.service';
import { projectPresentationImage } from '@/lib/presentation-media';
import { GLOBAL_DESKS } from '@/modules/global-desks';
import { getDestination } from '@/modules/destinations';

const destination = getDestination();

export const metadata: Metadata = {
  title: `myUNO | Stay. Buy. Own ${destination.name}.`,
  description: `Discover stays, homes and trusted local services across ${destination.name} through one connected property network.`,
  alternates: publicPageAlternates('/'),
};

export const dynamic = 'force-dynamic';

const HOME_AREA_IMAGE_SIZES = '(max-width: 768px) 100vw, 33vw';

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
  const activeDestination = getDestination();

  const [labels, homepageData] = await Promise.all([
    getLabels({
      'landing.global_hero.kicker': 'PHUKET · STAYS · HOMES · SERVICES',
      'landing.global_hero.title': activeDestination.heroTitle,
      'landing.global_hero.subtitle': activeDestination.heroSubtitle,
      'landing.global_hero.global': 'Explore global desks',
      'landing.global_hero.areas': 'Explore Phuket areas',
      'landing.global_hero.trust': 'How trust works',
      'landing.global_hero.sell': 'Sell a property',
      'landing.global_hero.rent_out': 'Rent it out',
      'landing.global_hero.manage': 'Property management',
      'landing.global_hero.services': 'Explore Phuket services',
      'landing.search.where': 'Where',
      'landing.search.all_phuket': 'All Phuket',
      'landing.search.locations': 'Locations',
      'landing.search.projects': 'Projects',
      'landing.search.check_in': 'Check-in',
      'landing.search.check_out': 'Check-out',
      'landing.search.adults': 'Adults',
      'landing.search.children': 'Children',
      'landing.search.submit': 'Search homes',

      'landing.start.kicker': 'START HERE',
      'landing.start.title': `What brings you to ${activeDestination.name}?`,
      'landing.start.buy_body': 'Explore homes with an active, evidenced sale offering.',
      'landing.start.stay_body': 'Search verified availability for your next stay.',
      'landing.start.sell_body': 'Start a documented resale and valuation review.',
      'landing.start.rentout_body': 'Activate short-stay, monthly or long-term rental paths on one property record.',
      'landing.start.manage_body': 'Move from listing into professional operations, PMS and owner reporting.',
      'landing.start.explore': 'Explore',

      'landing.desks.kicker': 'GLOBAL DESKS',
      'landing.desks.title': 'A more global front door to Phuket.',
      'landing.desks.body': 'Market and language liaison routes into the same canonical myUNO property, booking and service platform. No duplicate inventory, pricing or property records.',
      'landing.desks.cta': 'Explore all desks',
      'landing.desks.open': 'Open desk',
      'desks.thailand.title': 'Thailand desk',
      'desks.thailand.body': 'For Thailand-based residents, owners, guests and partners.',
      'desks.thailand.languages': 'Thai · English',
      'desks.russian.title': 'Russian-speaking desk',
      'desks.russian.body': 'For Russian-speaking buyers, owners, guests and partners.',
      'desks.russian.languages': 'Russian · English',
      'desks.china.title': 'Greater China desk',
      'desks.china.body': 'For Chinese-speaking and Greater China audiences exploring Phuket.',
      'desks.china.languages': 'Chinese · English',
      'desks.middle_east.title': 'Middle East desk',
      'desks.middle_east.body': 'For Middle East buyers, families and investors exploring Phuket.',
      'desks.middle_east.languages': 'English',
      'desks.europe.title': 'Europe desk',
      'desks.europe.body': 'For European buyers, residents and owners exploring Phuket.',
      'desks.europe.languages': 'English',

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

      'landing.vacation.kicker': 'VACATION RENTALS',
      'landing.vacation.title': 'One rental product. Two sides of the same home.',
      'landing.vacation.body': 'Guests discover and book verified stays. Owners activate the same property for short stays with pricing, distribution, operations and reporting connected end to end.',
      'landing.vacation.guest_title': 'For guests',
      'landing.vacation.guest_body': 'Search verified stays, then keep booking, arrival, Home Space and services connected through the whole trip.',
      'landing.vacation.guest_cta': 'Explore vacation stays',
      'landing.vacation.owner_title': 'For owners',
      'landing.vacation.owner_body': 'Start with your property and income goal. myUNO resolves eligibility, operating model, pricing, distribution and reporting.',
      'landing.vacation.owner_cta': 'Activate my home',
      'landing.vacation.proof_property': 'One canonical property record',
      'landing.vacation.proof_eligibility': 'Verified responsibility and eligibility',
      'landing.vacation.proof_journey': 'Trip Hub, Home Space and services',
      'landing.vacation.proof_owner': 'Owner reporting and operating evidence',
      'landing.value.kicker': 'ONE CONNECTED PLATFORM',
      'landing.value.title': 'One property. One connected journey.',
      'landing.value.body': 'Discover → transact → stay → use services → own → manage. The public experience and operations stay connected to the same property record.',
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
      'landing.services.title': 'Everything around your home and stay.',
      'landing.services.body': 'Transfers, housekeeping, maintenance, wellness, food, experiences and property services — connected to the same guest or property journey.',
      'landing.services.cta': 'Explore all services',
      'landing.services.vetted': 'Vetted',
      'landing.services.from': 'From',
      'landing.services.no_photo': 'Illustrative image',
      'landing.services.empty': 'Services are being prepared for publication.',

      'landing.audience.kicker': 'PROPERTY ON MYUNO',
      'landing.audience.owner_kicker': 'OWNER',
      'landing.audience.partner_kicker': 'PARTNER',
      'landing.audience.title': 'Put your property or business on myUNO.',
      'landing.audience.owners': 'For owners',
      'landing.audience.owners_body': 'Bring your Phuket property into one connected presentation, booking, operations and reporting flow.',
      'landing.audience.management': 'Management companies',
      'landing.audience.management_body': 'Operate projects and portfolios with bookings, PMS, team workflows, finance and owner reporting in one workspace.',
      'landing.audience.developers': 'Developers',
      'landing.audience.developers_body': 'Connect project inventory, sales, rentals and owner services without creating a second property model.',
      'landing.audience.providers': 'Service providers',
      'landing.audience.providers_body': 'Offer trusted services to guests, residents and owners through the connected marketplace.',
      'landing.audience.owner_cta': 'Rent out my property',
      'landing.audience.management_cta': 'Explore management',
      'landing.audience.developer_cta': 'Developer solutions',
      'landing.audience.provider_cta': 'Join the marketplace',

      'landing.trust.kicker': 'TRUST IS IN THE DETAILS',
      'landing.trust.title': 'Designed for real stays and real property operations.',
      'landing.trust.verified': 'Verified property information',
      'landing.trust.verified_body': 'Project, unit, media and public offering facts remain connected to the same underlying property record.',
      'landing.trust.handled': 'Verified commercial status',
      'landing.trust.handled_body': 'Only eligible active offerings reach public discovery; booking prices are confirmed through the pricing flow.',
      'landing.trust.protected': 'Real operations, controlled access',
      'landing.trust.protected_body': 'Bookings connect to stay operations while guests, owners, providers and teams see only their relevant workspace.',
      'landing.trust.cta': 'How trust works',

      'home.discovery.stay': 'Stay',
      'home.discovery.monthly': 'Monthly',
      'home.discovery.buy': 'Buy',
      'home.discovery.rent_out': 'Rent Out',
      'home.discovery.properties': 'Explore properties',
      'home.discovery.hint': 'Explore canonical homes and projects through the commercial path that fits your intent.',
      'home.discovery.error': 'Choose valid arrival and departure dates.',

      'home.final.title': 'Your place in Phuket starts here.',
      'home.final.body': 'Find a stay, discover a home to own, or explore the services around it.',
      'home.final.primary': 'Explore properties',
      'landing.units.kicker': 'HOMES RIGHT NOW',
      'landing.units.title': 'One home. The right commercial path.',
      'landing.units.body': 'Stay, rent monthly or buy from the same canonical property record — without duplicate listings.',
      'landing.units.cta': 'Explore all homes',
      'landing.units.guests': '{count} guests',
      'landing.units.from': 'From ฿{price} / night',
      'landing.units.open': 'View home',
      'landing.areas.kicker': 'EXPLORE PHUKET',
      'landing.areas.title': 'Choose your part of the island.',
      'landing.areas.body': 'Browse projects by canonical location — from Layan and Bang Tao to the next areas added to myUNO.',
      'landing.areas.projects': '{count} projects',
      'landing.areas.open': 'Explore area',
      'landing.areas.cta': 'View all areas',
      'home.final.secondary': 'Browse services',
    }),
    getPublicHomepageData(locale),
  ]);

  const { projects: rawProjects, commercialHomes, services, stayUnits, areas } = homepageData;

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
  const homeRailItems: HomeRailItem[] = [
    ...stayUnits.map((unit) => {
      const media = projectPresentationImage(unit.id, unit.coverUrl);
      return {
        key: `stay:${unit.id}`,
        intent: 'stay' as const,
        name: unit.name,
        projectName: unit.project.name,
        href: `/units/${unit.id}`,
        imageSrc: media.src,
        bedrooms: unit.bedrooms,
        bathrooms: unit.bathrooms,
        guests: unit.maxGuests,
        priceLabel: labels['landing.units.from'].replace(
          '{price}',
          Math.round(unit.baseNightlyThb / 100).toLocaleString()
        ),
      };
    }),
    ...commercialHomes.flatMap((home) =>
      home.intents.map((intent) => ({
        key: `${intent}:${home.id}`,
        intent: intent === 'rent' ? ('monthly' as const) : ('buy' as const),
        name: home.name,
        projectName: home.project.name,
        href: `/homes/${encodeURIComponent(home.id)}?intent=${intent}`,
        imageSrc: home.imageUrl,
        bedrooms: home.bedrooms,
        bathrooms: home.bathrooms,
        sizeSqm: home.sizeSqm,
        priceLabel:
          home.priceThb[intent] != null
            ? intent === 'rent'
              ? `฿${home.priceThb[intent]!.toLocaleString()} / month`
              : `฿${home.priceThb[intent]!.toLocaleString()}`
            : labels['landing.homes.terms'],
      }))
    ),
  ];

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
        className="relative isolate min-h-[calc(100svh-64px)] overflow-hidden bg-surface-paper text-text-ink md:min-h-[720px] "
        aria-labelledby="home-title"
      >
        <Image
          src={heroImage.src}
          alt={heroImage.illustrative ? '' : heroProject?.name ?? ''}
          fill
          priority
          sizes={["100", "vw"].join("")}
          className="object-cover saturate-[1.08]"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-surface-paper/85 via-surface-paper/30 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-deep/20 via-transparent to-transparent" />

        <div className="relative mx-auto flex min-h-[calc(100svh-64px)] max-w-content flex-col justify-end px-20 pb-24 pt-32 md:min-h-[720px] md:px-32 md:pb-56">
          <div className="max-w-2xl">
            <p className="text-kicker uppercase text-brand-andaman">
              {labels['landing.global_hero.kicker']}
            </p>
            <h1
              id="home-title"
              className="mt-12 max-w-2xl font-display text-display-hero font-semibold text-text-ink md:text-display-hero-lg"
            >
              {labels['landing.global_hero.title']}
            </h1>
            <p className="mt-40 max-w-xl text-body text-text-ink md:text-subtitle">
              {labels['landing.global_hero.subtitle']}
            </p>
          </div>

          <div className="mt-32 max-w-content">
            <DiscoverySearch
              locale={locale}
              projects={projects.map((project) => ({ id: project.id, name: project.name }))}
              areas={areas.map((area) => ({ slug: area.slug, name: area.displayName }))}
              labels={{
                stay: labels['home.discovery.stay'],
                monthly: labels['home.discovery.monthly'],
                buy: labels['home.discovery.buy'],
                where: labels['landing.search.where'],
                allPhuket: labels['landing.search.all_phuket'],
                locations: labels['landing.search.locations'],
                projects: labels['landing.search.projects'],
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
            <div className="mt-12 flex flex-wrap items-center gap-x-16 gap-y-8 px-4 text-small">
              <Link href="/services" className="font-semibold text-brand-andaman hover:underline">
                {labels['landing.global_hero.services']} →
              </Link>
              <span aria-hidden="true" className="hidden text-border-line-2 sm:inline">·</span>
              <Link href="/sell" className="font-semibold text-text-ink hover:text-brand-andaman">
                {labels['landing.global_hero.sell']} →
              </Link>
              <Link href="/rent-out" className="font-semibold text-text-ink hover:text-brand-andaman">
                {labels['landing.global_hero.rent_out']} →
              </Link>
              <Link href="/manage" className="font-semibold text-text-ink hover:text-brand-andaman">
                {labels['landing.global_hero.manage']} →
              </Link>
            </div>
          </div>
        </div>
      </section>


      <section className="bg-surface-paper py-56 md:py-96" aria-labelledby="collection-heading">
        <div className="mx-auto max-w-content px-20 md:px-32">
          <div className="mb-32 flex flex-col justify-between gap-16 md:mb-40 md:flex-row md:items-end">
            <div className="max-w-2xl">
              <p className="text-kicker uppercase text-brand-andaman">
                {labels['landing.collection.kicker']}
              </p>
              <h2 id="collection-heading" className="mt-8 font-display text-display-xl font-semibold text-text-ink">
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
            <div className="grid grid-cols-1 gap-12 sm:grid-cols-2 md:grid-cols-3 md:auto-rows-[250px] md:gap-16">
              {featuredProjects.map((project, index) => (
                <div
                  key={project.id}
                  className={
                    index === 0
                      ? 'min-w-0 sm:col-span-2 md:col-span-2 md:row-span-2'
                      : index === 4
                        ? 'min-w-0 sm:col-span-2 md:col-span-2'
                        : 'min-w-0 col-span-1'
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
            <div className="rounded-lg border border-border-line bg-surface-ivory p-32 text-text-secondary">
              {labels['landing.collection.empty']}
            </div>
          )}
        </div>
      </section>

      {homeRailItems.length ? (
        <section className="bg-surface-ivory py-56 md:py-96" aria-labelledby="units-heading">
          <div className="mx-auto max-w-content px-20 md:px-32">
            <div className="mb-32 flex flex-col justify-between gap-16 md:mb-40 md:flex-row md:items-end">
              <div className="max-w-2xl">
                <p className="text-kicker uppercase text-brand-andaman">{labels['landing.units.kicker']}</p>
                <h2 id="units-heading" className="mt-8 font-display text-display-xl font-semibold text-text-ink">
                  {labels['landing.units.title']}
                </h2>
                <p className="mt-12 max-w-xl text-body text-text-secondary">{labels['landing.units.body']}</p>
              </div>
              <Link href="/homes" className="shrink-0 text-body font-semibold text-brand-andaman hover:underline">
                {labels['landing.units.cta']} →
              </Link>
            </div>

            <HomeIntentRail
              items={homeRailItems}
              labels={{
                stay: labels['home.discovery.stay'],
                monthly: labels['home.discovery.monthly'],
                buy: labels['home.discovery.buy'],
                bedrooms: labels['landing.homes.bedrooms'],
                bathrooms: labels['landing.homes.bathrooms'],
                sqm: labels['landing.homes.area'],
                guests: labels['landing.units.guests'],
                open: labels['landing.units.open'],
                empty: labels['landing.homes.terms'],
              }}
            />
          </div>
        </section>
      ) : null}

      <section className="border-y border-border-line bg-surface-paper py-56 md:py-96" aria-labelledby="vacation-rental-heading">
        <div className="mx-auto max-w-content px-20 md:px-32">
          <div className="grid gap-24 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)] lg:items-start">
            <div>
              <p className="text-kicker uppercase text-brand-andaman">
                {labels['landing.vacation.kicker']}
              </p>
              <h2 id="vacation-rental-heading" className="mt-8 max-w-3xl font-display text-display-xl font-semibold text-text-ink">
                {labels['landing.vacation.title']}
              </h2>
              <p className="mt-12 max-w-2xl text-body text-text-secondary">
                {labels['landing.vacation.body']}
              </p>

              <div className="mt-44 grid gap-12 md:grid-cols-2">
                <div className="rounded-lg border border-border-line bg-surface-ivory p-20 md:p-24">
                  <p className="text-kicker uppercase text-brand-andaman">{labels['landing.vacation.guest_title']}</p>
                  <p className="mt-8 text-body text-text-secondary">{labels['landing.vacation.guest_body']}</p>
                  <Link href="/search" className="mt-40 inline-flex min-h-44 items-center font-semibold text-brand-andaman hover:underline">
                    {labels['landing.vacation.guest_cta']} →
                  </Link>
                </div>
                <div className="rounded-lg border border-border-line bg-surface-ivory p-20 md:p-24">
                  <p className="text-kicker uppercase text-brand-andaman">{labels['landing.vacation.owner_title']}</p>
                  <p className="mt-8 text-body text-text-secondary">{labels['landing.vacation.owner_body']}</p>
                  <Link href="/rent-out" className="mt-40 inline-flex min-h-44 items-center font-semibold text-brand-andaman hover:underline">
                    {labels['landing.vacation.owner_cta']} →
                  </Link>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-brand-deep p-24 text-surface-ivory md:p-32">
              <p className="font-display text-title font-semibold">{labels['landing.vacation.kicker']}</p>
              <div className="mt-40 space-y-12">
                {[
                  labels['landing.vacation.proof_property'],
                  labels['landing.vacation.proof_eligibility'],
                  labels['landing.vacation.proof_journey'],
                  labels['landing.vacation.proof_owner'],
                ].map((item) => (
                  <div key={item} className="flex gap-12 border-b border-white/10 pb-12 last:border-0 last:pb-0">
                    <TrustMark size={18} filled className="mt-4 shrink-0 text-brand-sun" />
                    <span className="text-body text-surface-ivory">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>


      <section className="bg-surface-ivory py-56 md:py-96" aria-labelledby="value-heading">
        <div className="mx-auto max-w-content px-20 md:px-32">
          <div className="max-w-3xl">
            <p className="text-kicker uppercase text-brand-andaman">
              {labels['landing.value.kicker']}
            </p>
            <h2 id="value-heading" className="mt-8 font-display text-display-xl font-semibold text-text-ink">
              {labels['landing.value.title']}
            </h2>
            <p className="mt-12 max-w-2xl text-body text-text-secondary">
              {labels['landing.value.body']}
            </p>
          </div>

          <div className="mt-32 grid grid-cols-2 gap-12 md:mt-40 md:grid-cols-4 md:gap-16">
            {valueCards.map((item) => (
              <Link
                key={item.title}
                href={item.href}
                className="group rounded-lg border border-border-line bg-surface-paper p-20 transition-shadow duration-structural hover:shadow-card md:p-24"
              >
                <TrustMark size={20} filled className="text-brand-andaman" />
                <h3 className="mt-44 font-display text-title font-semibold text-text-ink">{item.title}</h3>
                <p className="mt-8 text-small leading-relaxed text-text-secondary">{item.body}</p>
                <span className="mt-40 inline-block text-small font-semibold text-brand-andaman">{labels['landing.start.explore']} →</span>
              </Link>
            ))}
          </div>

          <Link href="/about" className="mt-32 inline-block font-semibold text-brand-andaman hover:underline">
            {labels['landing.value.cta']} →
          </Link>
        </div>
      </section>


      <section className="bg-surface-ivory py-56 md:py-96" aria-labelledby="services-heading">
        <div className="mx-auto max-w-content px-20 md:px-32">
          <div className="mb-32 flex flex-col justify-between gap-16 md:mb-40 md:flex-row md:items-end">
            <div className="max-w-2xl">
              <p className="text-kicker uppercase text-brand-andaman">
                {labels['landing.services.kicker']}
              </p>
              <h2 id="services-heading" className="mt-8 font-display text-display-xl font-semibold text-text-ink">
                {labels['landing.services.title']}
              </h2>
              <p className="mt-12 text-body text-text-secondary">{labels['landing.services.body']}</p>
            </div>
            <Link href="/services" className="shrink-0 font-semibold text-brand-andaman hover:underline">
              {labels['landing.services.cta']} →
            </Link>
          </div>

          {services.length ? (
            <div className="grid grid-cols-1 gap-16 sm:grid-cols-2 lg:grid-cols-3 lg:gap-20">
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
            <div className="rounded-lg border border-border-line p-32 text-text-secondary">
              {labels['landing.services.empty']}
            </div>
          )}
        </div>
      </section>

      {areas.length ? (
        <section className="bg-surface-paper py-56 md:py-96" aria-labelledby="areas-heading">
          <div className="mx-auto max-w-content px-20 md:px-32">
            <div className="mb-32 flex flex-col justify-between gap-16 md:mb-40 md:flex-row md:items-end">
              <div className="max-w-2xl">
                <p className="text-kicker uppercase text-brand-andaman">
                  {labels['landing.areas.kicker']}
                </p>
                <h2 id="areas-heading" className="mt-8 font-display text-display-xl font-semibold text-text-ink">
                  {labels['landing.areas.title']}
                </h2>
                <p className="mt-12 max-w-xl text-body text-text-secondary">
                  {labels['landing.areas.body']}
                </p>
              </div>
              <Link href="/areas" className="shrink-0 text-body font-semibold text-brand-andaman hover:underline">
                {labels['landing.areas.cta']} →
              </Link>
            </div>

            <div className="grid gap-16 md:grid-cols-3">
              {areas.slice(0, 3).map((area) => {
                const media = projectPresentationImage(area.id, area.coverUrl);
                return (
                  <Link
                    key={area.id}
                    href={`/areas/${area.slug}`}
                    className="group relative isolate min-h-[320px] overflow-hidden rounded-lg bg-brand-deep"
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
                        {labels['landing.areas.projects'].replace('{count}', String(area.projectCount))}
                      </p>
                      <h3 className="mt-4 font-display text-display font-semibold">{area.displayName}</h3>
                      {area.description ? (
                        <p className="mt-8 line-clamp-2 text-small text-surface-ivory/80">{area.description}</p>
                      ) : null}
                      <span className="mt-16 inline-block text-small font-semibold">
                        {labels['landing.areas.open']} →
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      <section className="py-56 md:py-96" aria-labelledby="audience-heading">
        <div className="mx-auto max-w-content px-20 md:px-32">
          <p className="text-kicker uppercase text-brand-andaman">
            {labels['landing.audience.kicker']}
          </p>
          <h2 id="audience-heading" className="mt-8 max-w-3xl font-display text-display-xl font-semibold text-text-ink">
            {labels['landing.audience.title']}
          </h2>

          <div className="mt-32 grid gap-16 md:grid-cols-2">
            {[
              {
                href: '/rent-out',
                kicker: labels['landing.audience.owner_kicker'],
                title: labels['landing.audience.owners'],
                body: labels['landing.audience.owners_body'],
                cta: labels['landing.audience.owner_cta'],
                accent: false,
              },
              {
                href: '/management-companies',
                kicker: labels['landing.audience.partner_kicker'],
                title: labels['landing.audience.management'],
                body: labels['landing.audience.management_body'],
                cta: labels['landing.audience.management_cta'],
                accent: true,
              },
              {
                href: '/developers',
                kicker: labels['landing.audience.partner_kicker'],
                title: labels['landing.audience.developers'],
                body: labels['landing.audience.developers_body'],
                cta: labels['landing.audience.developer_cta'],
                accent: false,
              },
              {
                href: '/providers',
                kicker: labels['landing.audience.partner_kicker'],
                title: labels['landing.audience.providers'],
                body: labels['landing.audience.providers_body'],
                cta: labels['landing.audience.provider_cta'],
                accent: false,
              },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex min-h-[220px] flex-col justify-between rounded-lg p-24 transition-shadow duration-structural hover:shadow-card md:p-32 ${
                  item.accent
                    ? 'bg-brand-andaman text-surface-ivory'
                    : 'border border-border-line bg-surface-paper text-text-ink'
                }`}
              >
                <div>
                  <p className={`text-kicker uppercase ${item.accent ? 'text-brand-sun-soft' : 'text-brand-andaman'}`}>
                    {item.kicker}
                  </p>
                  <h3 className="mt-12 font-display text-display font-semibold">{item.title}</h3>
                  <p className={`mt-12 max-w-md text-body ${item.accent ? 'text-surface-ivory/75' : 'text-text-secondary'}`}>
                    {item.body}
                  </p>
                </div>
                <span className={`mt-32 font-semibold ${item.accent ? 'text-surface-ivory' : 'text-brand-andaman'}`}>
                  {item.cta} →
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-border-line bg-gradient-to-r from-surface-ivory via-surface-paper to-surface-ivory py-44 md:py-56" aria-labelledby="global-desks-heading">
        <div className="mx-auto max-w-content px-20 md:px-32">
          <div className="flex flex-col justify-between gap-16 md:flex-row md:items-end">
            <div className="max-w-2xl">
              <p className="text-kicker uppercase tracking-[0.18em] text-brand-andaman">{labels['landing.desks.kicker']}</p>
              <h2 id="global-desks-heading" className="mt-8 font-display text-display font-semibold tracking-[-0.02em] text-text-ink md:text-display-xl">
                {labels['landing.desks.title']}
              </h2>
              <p className="mt-12 text-body text-text-secondary">{labels['landing.desks.body']}</p>
            </div>
            <Link href="/desks" className="shrink-0 text-body font-semibold text-brand-andaman hover:underline">
              {labels['landing.desks.cta']} →
            </Link>
          </div>

          <div className="-mx-20 mt-44 flex snap-x gap-12 overflow-x-auto px-20 pb-4 md:mx-0 md:grid md:grid-cols-5 md:overflow-visible md:px-0">
            {GLOBAL_DESKS.map((desk) => (
              <Link
                key={desk.slug}
                href={`/desks/${desk.slug}`}
                className="group w-[220px] shrink-0 snap-start rounded-lg border border-border-line bg-surface-paper/92 p-20 shadow-card backdrop-blur transition-all duration-structural hover:-translate-y-[1px] hover:shadow-card focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-andaman md:w-auto"
              >
                <div className="flex h-40 w-40 items-center justify-center rounded-full bg-brand-andaman/10 font-display text-small font-semibold tracking-[0.08em] text-brand-andaman">
                  {desk.code}
                </div>
                <h3 className="mt-16 font-display text-title font-semibold text-text-ink">{labels[desk.titleKey]}</h3>
                <p className="mt-8 line-clamp-2 text-small leading-relaxed text-text-secondary">{labels[desk.bodyKey]}</p>
                <p className="mt-12 text-small font-semibold text-brand-andaman">{labels[desk.languagesKey]}</p>
                <span className="mt-16 inline-block text-small font-semibold text-brand-andaman transition-transform group-hover:translate-x-4">
                  {labels['landing.desks.open']} →
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-border-line bg-surface-paper py-56 md:py-80" aria-labelledby="trust-heading">
        <div className="mx-auto max-w-content px-20 md:px-32">
          <p className="text-kicker uppercase text-brand-andaman">
            {labels['landing.trust.kicker']}
          </p>
          <h2 id="trust-heading" className="mt-8 max-w-3xl font-display text-display-xl font-semibold text-text-ink">
            {labels['landing.trust.title']}
          </h2>

          <div className="mt-32 grid gap-0 md:grid-cols-3">
            {(['verified', 'handled', 'protected'] as const).map((key, index) => (
              <Link
                key={key}
                href="/trust"
                className={`group block border-t border-border-line py-24 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-andaman md:border-t-0 md:py-0 ${
                  index > 0 ? 'md:border-l md:pl-24' : ''
                } ${index < 2 ? 'md:pr-24' : ''}`}
              >
                <TrustMark size={22} filled className="text-brand-andaman" />
                <h3 className="mt-16 font-display text-title font-semibold text-text-ink">
                  {labels[`landing.trust.${key}`]}
                </h3>
                <p className="mt-8 text-body text-text-secondary">
                  {labels[`landing.trust.${key}_body`]}
                </p>
                <span className="mt-12 inline-block text-small font-semibold text-brand-andaman group-hover:underline">
                  {labels['landing.trust.cta']} →
                </span>
              </Link>
            ))}
          </div>

          <Link href="/trust" className="mt-32 inline-block font-semibold text-brand-andaman hover:underline">
            {labels['landing.trust.cta']} →
          </Link>
        </div>
      </section>

      <section className="bg-brand-andaman py-56 text-surface-ivory md:py-80">
        <div className="mx-auto max-w-4xl px-20 text-center md:px-32">
          <h2 className="font-display text-display-xl font-semibold">
            {labels['home.final.title']}
          </h2>
          <p className="mx-auto mt-12 max-w-2xl text-body text-surface-ivory/75">
            {labels['home.final.body']}
          </p>
          <div className="mt-32 flex flex-col justify-center gap-12 sm:flex-row">
            <Link
              href="/projects"
              className="inline-flex min-h-48 items-center justify-center rounded-lg bg-surface-paper px-24 font-semibold text-brand-deep transition-opacity hover:opacity-90"
            >
              {labels['home.final.primary']} →
            </Link>
            <Link
              href="/services"
              className="inline-flex min-h-48 items-center justify-center rounded-lg border border-white/30 px-24 font-semibold text-surface-ivory transition-colors hover:bg-surface-ivory/10"
            >
              {labels['home.final.secondary']}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
