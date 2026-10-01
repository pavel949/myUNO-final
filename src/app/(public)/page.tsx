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
import { listPublicMarketplaceServices } from '@/modules/services';
import { projectPresentationImage } from '@/lib/presentation-media';

export const metadata: Metadata = {
  title: 'myUNO | Stay. Own. Experience Phuket.',
  description: 'Discover serviced stays, residences, property ownership and connected services across Phuket.',
  alternates: publicPageAlternates('/'),
};
export const dynamic = 'force-dynamic';

const pathways = [
  { href: '/search', number: '01', key: 'stay' },
  { href: '/projects', number: '02', key: 'own' },
  { href: '/services', number: '03', key: 'experience' },
] as const;
const ecosystem = [
  { href: '/search', key: 'stay' },
  { href: '/services', key: 'experience' },
  { href: '/owners', key: 'own' },
  { href: '/developers', key: 'connect' },
] as const;
const destinations = [
  { key: 'bang_tao', href: '/search?areaSlug=bang-tao' },
  { key: 'layan', href: '/search?areaSlug=layan' },
  { key: 'cherng_talay', href: '/search?areaSlug=cherng-talay' },
  { key: 'nai_yang', href: '/search?areaSlug=nai-yang' },
] as const;

export default async function LandingPage() {
  const locale = getRequestLocale();
  const [labels, projects, services] = await Promise.all([
    getLabels({
      'landing.hero.kicker': 'PHUKET · ONE CONNECTED EXPERIENCE',
      'landing.hero.title': 'Your Phuket. Your way.',
      'landing.hero.subtitle': 'Exceptional places to stay, own and experience. Connected by myUNO.',
      'landing.search.check_in': 'Check-in',
      'landing.search.check_out': 'Check-out',
      'landing.search.adults': 'Adults',
      'landing.search.children': 'Children',
      'landing.search.submit': 'Explore stays',
      'landing.collection.kicker': 'THE MYUNO COLLECTION',
      'landing.collection.title': 'Places worth discovering.',
      'landing.collection.body': 'Explore real residences and the homes within them, with one connected property record.',
      'landing.collection.cta': 'Explore all projects',
      'landing.collection.homes': '{count} homes',
      'landing.collection.from_price': 'From ฿{price} / night',
      'landing.collection.no_photo': 'Illustrative image',
      'landing.collection.empty': 'Residences are being prepared for launch.',
      'landing.services.kicker': 'BEYOND YOUR STAY',
      'landing.services.title': 'Your Phuket, handled.',
      'landing.services.body': 'Discover services around your home and stay, connected to the myUNO marketplace.',
      'landing.services.cta': 'Explore services',
      'landing.services.vetted': 'Vetted',
      'landing.services.from': 'From',
      'landing.services.no_photo': 'Illustrative image',
      'landing.services.empty': 'Services are being prepared for launch.',
      'landing.trust.kicker': 'TRUST IS IN THE DETAILS',
      'landing.trust.title': 'The operations behind the experience.',
      'landing.trust.verified': 'Connected identities',
      'landing.trust.verified_body': 'People and roles connect to the relevant property and workflow.',
      'landing.trust.handled': 'One operating record',
      'landing.trust.handled_body': 'Property, reservations and services share a connected operational model.',
      'landing.trust.protected': 'Controlled access',
      'landing.trust.protected_body': 'Guest, owner, provider and operations views follow their access permissions.',
      'landing.trust.cta': 'How trust works',
      'landing.audience.kicker': 'PROPERTY ON MYUNO',
      'landing.audience.title': 'One home. A connected world around it.',
      'landing.audience.body': 'For property owners and developers, the same property record connects presentation, availability, operations and visibility.',
      'landing.audience.owners': 'For owners',
      'landing.audience.owners_body': 'Your property, reservations, operations and statements in one personal space.',
      'landing.audience.developers': 'For developers',
      'landing.audience.developers_body': 'Present your project and connect residences to a unified property ecosystem.',
      'landing.audience.owner_cta': 'Explore Owner Hub',
      'landing.audience.developer_cta': 'Explore developer solutions',
      'home.discovery.stay': 'Stay',
      'home.discovery.monthly': 'Monthly',
      'home.discovery.buy': 'Buy',
      'home.discovery.invest': 'Invest',
      'home.discovery.properties': 'Explore projects',
      'home.discovery.hint': 'Discover our projects, then explore available homes and their offers.',
      'home.discovery.error': 'Choose valid arrival and departure dates.',
      'home.pathways.kicker': 'Discover your UNO',
      'home.destinations.kicker': 'The island',
      'home.destinations.note': 'Explore the collection to see current project locations and availability.',
      'home.guided.kicker': 'Guided discovery',
      'home.guided.prompt': 'Start with a simple question',
      'home.guided.stay': 'Find a home for my trip',
      'home.guided.projects': 'Explore residences in Phuket',
      'home.guided.owner': 'I own a property',
      'home.ecosystem.kicker': 'One connected ecosystem',
      'home.common.explore': 'Explore',
      'home.pathways.title': 'One island. Many ways to live it.',
      'home.destinations.title': 'Discover Phuket.',
      'home.destinations.subtitle': 'Begin with the neighbourhood that fits your way of life.',
      'home.guided.title': 'Not sure where to begin?',
      'home.guided.body': 'Find your place by dates, discover a project, or ask our guest team for help with a tailored request.',
      'home.guided.cta': 'Talk to our team',
      'home.ecosystem.title': 'Everything connects.',
      'home.ecosystem.body': 'Discover a home. Book a stay. Use local services. Manage your property. One myUNO account connects your experience.',
      'home.ecosystem.cta': 'Discover myUNO',
      'home.audience.cta': 'Discover the property ecosystem',
      'home.final.title': 'Your place in Phuket starts here.',
      'home.final.cta': 'Explore the collection',
      'home.pathways.stay.title': 'Stay',
      'home.pathways.stay.detail': 'Find a home for your next Phuket stay.',
      'home.pathways.own.title': 'Own',
      'home.pathways.own.detail': 'Explore residences and property opportunities.',
      'home.pathways.experience.title': 'Experience',
      'home.pathways.experience.detail': 'Everything around your time on the island.',
      'home.destinations.bang_tao.name': 'Bang Tao',
      'home.destinations.bang_tao.subtitle': 'Coastal living',
      'home.destinations.layan.name': 'Layan',
      'home.destinations.layan.subtitle': 'Privacy & nature',
      'home.destinations.cherng_talay.name': 'Cherng Talay',
      'home.destinations.cherng_talay.subtitle': 'Connected island life',
      'home.destinations.nai_yang.name': 'Nai Yang',
      'home.destinations.nai_yang.subtitle': 'A slower pace',
      'home.ecosystem.stay.title': 'Stay',
      'home.ecosystem.stay.body': 'Discover and reserve.',
      'home.ecosystem.experience.title': 'Experience',
      'home.ecosystem.experience.body': 'Services around your stay.',
      'home.ecosystem.own.title': 'Own',
      'home.ecosystem.own.body': 'Your property and visibility.',
      'home.ecosystem.connect.title': 'Connect',
      'home.ecosystem.connect.body': 'Projects and partners.',
    }),
    listPublicProjects(),
    listPublicMarketplaceServices(prisma, locale, { limit: 3 }).catch(() => []),
  ]);
  const heroProject = projects.find(p => !!p.coverUrl) ?? projects[0] ?? null;
  const heroImage = heroProject ? projectPresentationImage(heroProject.id, heroProject.coverUrl) : projectPresentationImage('homepage', null);
  const organizationJsonLd = { '@context': 'https://schema.org', '@type': 'Organization', name: 'myUNO', legalName: 'Ignatev Estate Co., Ltd', url: siteUrl(), areaServed: 'Phuket, Thailand' };
  return (
    <main className="min-h-screen bg-surface-ivory">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(organizationJsonLd) }} />
      <section className="relative min-h-[82vh] overflow-hidden bg-brand-deep text-surface-ivory" aria-labelledby="home-title">
        <Image src={heroImage.src} alt={heroImage.illustrative ? '' : heroProject?.name ?? ''} fill priority className="object-cover opacity-75" />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-deep via-brand-deep/45 to-brand-deep/10" />
        <div className="relative mx-auto flex min-h-[82vh] max-w-7xl flex-col justify-end px-20 pb-32 pt-56 md:px-32 md:pb-64">
          <div className="max-w-4xl">
            <p className="text-kicker uppercase tracking-[0.18em] text-brand-sun-soft">{labels['landing.hero.kicker']}</p>
            <h1 id="home-title" className="mt-12 max-w-4xl font-display text-[clamp(3.1rem,7.4vw,7.5rem)] font-semibold leading-[0.96] tracking-[-0.04em]">{labels['landing.hero.title']}</h1>
            <p className="mt-20 max-w-2xl text-lg text-surface-ivory/90 md:text-xl">{labels['landing.hero.subtitle']}</p>
          </div>
          <div className="mt-32 max-w-6xl">
            <DiscoverySearch labels={{
              stay: labels['home.discovery.stay'], monthly: labels['home.discovery.monthly'],
              buy: labels['home.discovery.buy'], invest: labels['home.discovery.invest'],
              checkIn: labels['landing.search.check_in'], checkOut: labels['landing.search.check_out'],
              adults: labels['landing.search.adults'], children: labels['landing.search.children'],
              explore: labels['landing.search.submit'], properties: labels['home.discovery.properties'],
              hint: labels['home.discovery.hint'], error: labels['home.discovery.error'],
            }} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-20 py-56 md:px-32 md:py-80" aria-labelledby="pathways-heading">
        <p className="text-kicker uppercase tracking-[0.18em] text-brand-andaman">{labels['home.pathways.kicker']}</p>
        <h2 id="pathways-heading" className="mt-8 font-display text-display-xl font-semibold text-text-ink">{labels['home.pathways.title']}</h2>
        <div className="mt-32 grid gap-12 md:grid-cols-3">
          {pathways.map(item => <Link key={item.href} href={item.href} className="group rounded-2xl border border-border-line bg-surface-paper p-24 transition hover:-translate-y-4 hover:shadow-card focus-visible:outline-2 focus-visible:outline-brand-andaman">
            <span className="text-small text-brand-andaman">{item.number}</span>
            <div className="mt-32 flex items-center justify-between"><h3 className="font-display text-display font-semibold text-text-ink">{labels[`home.pathways.${item.key}.title`]}</h3><span aria-hidden="true" className="text-xl text-brand-andaman transition group-hover:translate-x-4">↗</span></div>
            <p className="mt-8 text-body text-text-secondary">{labels[`home.pathways.${item.key}.detail`]}</p>
          </Link>)}
        </div>
      </section>

      <section className="bg-surface-paper py-56 md:py-80" aria-labelledby="collection-heading">
        <div className="mx-auto max-w-7xl px-20 md:px-32">
          <div className="mb-32 flex flex-col justify-between gap-16 md:flex-row md:items-end">
            <div className="max-w-2xl"><p className="text-kicker uppercase tracking-[0.18em] text-brand-andaman">{labels['landing.collection.kicker']}</p><h2 id="collection-heading" className="mt-8 font-display text-display-xl font-semibold text-text-ink">{labels['landing.collection.title']}</h2><p className="mt-12 text-body text-text-secondary">{labels['landing.collection.body']}</p></div>
            <Link href="/projects" className="font-semibold text-brand-andaman hover:underline">{labels['landing.collection.cta']} →</Link>
          </div>
          {projects.length ? <div className="grid grid-cols-1 gap-16 md:grid-cols-3 md:auto-rows-[250px]">
            {projects.slice(0, 3).map((project, index) => <ProjectCard key={project.id} project={project} featured={index === 0} labels={{ homes: labels['landing.collection.homes'], fromPrice: labels['landing.collection.from_price'], noPhoto: labels['landing.collection.no_photo'] }}/>)}
          </div> : <div className="rounded-2xl border border-border-line bg-surface-ivory p-32 text-text-secondary">{labels['landing.collection.empty']}</div>}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-20 py-56 md:px-32 md:py-80" aria-labelledby="destination-heading">
        <p className="text-kicker uppercase tracking-[0.18em] text-brand-andaman">{labels['home.destinations.kicker']}</p><h2 id="destination-heading" className="mt-8 font-display text-display-xl font-semibold text-text-ink">{labels['home.destinations.title']}</h2>
        <p className="mt-12 text-body text-text-secondary">{labels['home.destinations.subtitle']}</p>
        <div className="mt-32 grid grid-cols-2 gap-12 md:grid-cols-4">
          {destinations.map((area) => <Link key={area.key} href={area.href} className="group relative flex min-h-[190px] flex-col justify-end overflow-hidden rounded-2xl bg-brand-andaman p-20 text-white md:min-h-[290px]">
            <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-br from-brand-andaman via-brand-deep to-brand-andaman-dark transition duration-700 group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent" />
            <div className="relative"><h3 className="font-display text-heading-2 font-semibold">{labels[`home.destinations.${area.key}.name`]}</h3><p className="mt-4 text-small text-white/80">{labels[`home.destinations.${area.key}.subtitle`]}</p></div>
          </Link>)}
        </div>
        <p className="mt-12 text-small text-text-secondary">{labels['home.destinations.note']}</p>
      </section>

      <section className="bg-brand-deep py-56 text-surface-ivory md:py-80" aria-labelledby="guided-heading">
        <div className="mx-auto grid max-w-7xl gap-32 px-20 md:grid-cols-2 md:items-center md:px-32">
          <div><p className="text-kicker tracking-[0.18em] text-brand-sun-soft">{labels['home.guided.kicker']}</p><h2 id="guided-heading" className="mt-8 font-display text-display-xl font-semibold">{labels['home.guided.title']}</h2><p className="mt-16 max-w-xl text-body text-surface-ivory/75">{labels['home.guided.body']}</p><Link href="/guests" className="mt-24 inline-flex rounded-lg bg-surface-paper px-24 py-12 font-semibold text-brand-deep hover:opacity-90">{labels['home.guided.cta']} →</Link></div>
          <div className="rounded-2xl border border-white/20 bg-surface-paper/10 p-24 backdrop-blur-sm"><p className="text-small text-brand-sun-soft">{labels['home.guided.prompt']}</p><div className="mt-20 space-y-12">
            <Link href="/search" className="block rounded-xl bg-surface-paper/10 p-16 hover:bg-surface-paper/20">{labels['home.guided.stay']} ↗</Link>
            <Link href="/projects" className="block rounded-xl bg-surface-paper/10 p-16 hover:bg-surface-paper/20">{labels['home.guided.projects']} ↗</Link>
            <Link href="/owners" className="block rounded-xl bg-surface-paper/10 p-16 hover:bg-surface-paper/20">{labels['home.guided.owner']} ↗</Link>
          </div></div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-20 py-56 md:px-32 md:py-80" aria-labelledby="ecosystem-heading">
        <p className="text-kicker tracking-[0.18em] text-brand-andaman">{labels['home.ecosystem.kicker']}</p><h2 id="ecosystem-heading" className="mt-8 font-display text-display-xl font-semibold text-text-ink">{labels['home.ecosystem.title']}</h2><p className="mt-12 max-w-3xl text-body text-text-secondary">{labels['home.ecosystem.body']}</p>
        <div className="mt-32 grid gap-12 md:grid-cols-4">
          {ecosystem.map(item=><Link key={item.key} href={item.href} className="rounded-2xl border border-border-line bg-surface-paper p-24 hover:shadow-card"><TrustMark size={20} filled className="text-brand-andaman"/><h3 className="mt-24 font-display text-heading-2 font-semibold text-text-ink">{labels[`home.ecosystem.${item.key}.title`]}</h3><p className="mt-8 text-small text-text-secondary">{labels[`home.ecosystem.${item.key}.body`]}</p><span className="mt-20 inline-block font-semibold text-brand-andaman">{labels['home.common.explore']} →</span></Link>)}
        </div>
        <Link href="/about" className="mt-24 inline-block font-semibold text-brand-andaman hover:underline">{labels['home.ecosystem.cta']} →</Link>
      </section>

      <section className="bg-surface-paper py-56 md:py-80" aria-labelledby="audience-heading">
        <div className="mx-auto max-w-7xl px-20 md:px-32">
          <p className="text-kicker tracking-[0.18em] text-brand-andaman">{labels['landing.audience.kicker']}</p><h2 id="audience-heading" className="mt-8 max-w-3xl font-display text-display-xl font-semibold text-text-ink">{labels['landing.audience.title']}</h2><p className="mt-12 max-w-3xl text-body text-text-secondary">{labels['landing.audience.body']}</p>
          <div className="mt-32 grid gap-16 md:grid-cols-2">
            {([{href:'/owners',title:labels['landing.audience.owners'],body:labels['landing.audience.owners_body'],cta:labels['landing.audience.owner_cta']},{href:'/developers',title:labels['landing.audience.developers'],body:labels['landing.audience.developers_body'],cta:labels['landing.audience.developer_cta']}] as const).map(item=><Link href={item.href} key={item.href} className="group rounded-2xl border border-border-line bg-surface-ivory p-24 transition hover:shadow-card"><h3 className="font-display text-display font-semibold text-text-ink">{item.title}</h3><p className="mt-12 max-w-md text-body text-text-secondary">{item.body}</p><p className="mt-32 font-semibold text-brand-andaman">{item.cta} ↗</p></Link>)}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-20 py-56 md:px-32 md:py-80" aria-labelledby="services-heading">
        <div className="mb-32 flex flex-col justify-between gap-16 md:flex-row md:items-end"><div><p className="text-kicker tracking-[0.18em] text-brand-andaman">{labels['landing.services.kicker']}</p><h2 id="services-heading" className="mt-8 font-display text-display-xl font-semibold text-text-ink">{labels['landing.services.title']}</h2><p className="mt-12 text-body text-text-secondary">{labels['landing.services.body']}</p></div><Link href="/services" className="font-semibold text-brand-andaman">{labels['landing.services.cta']} →</Link></div>
        {services.length ? <div className="grid grid-cols-1 gap-20 md:grid-cols-3">{services.map(service=><ServiceCard key={service.id} service={service} href={`/services/${service.id}`} labels={{vetted:labels['landing.services.vetted'],from:labels['landing.services.from'],noPhoto:labels['landing.services.no_photo']}} />)}</div> : <div className="rounded-2xl border border-border-line p-32 text-text-secondary">{labels['landing.services.empty']}</div>}
      </section>

      <section className="border-y border-border-line bg-surface-paper py-56 md:py-80" aria-labelledby="trust-heading"><div className="mx-auto max-w-7xl px-20 md:px-32"><p className="text-kicker tracking-[0.18em] text-brand-andaman">{labels['landing.trust.kicker']}</p><h2 id="trust-heading" className="mt-8 font-display text-display-xl font-semibold text-text-ink">{labels['landing.trust.title']}</h2><div className="mt-32 grid gap-24 md:grid-cols-3">{(['verified','handled','protected'] as const).map(key=><div key={key} className="border-t border-border-line pt-20"><TrustMark size={22} filled className="text-brand-andaman"/><h3 className="mt-12 font-display text-title font-semibold text-text-ink">{labels[`landing.trust.${key}`]}</h3><p className="mt-8 text-body text-text-secondary">{labels[`landing.trust.${key}_body`]}</p></div>)}</div><Link href="/trust" className="mt-32 inline-block font-semibold text-brand-andaman">{labels['landing.trust.cta']} →</Link></div></section>

      <section className="bg-brand-andaman py-56 text-center text-surface-ivory md:py-80"><div className="mx-auto max-w-3xl px-20"><h2 className="font-display text-display-xl font-semibold">{labels['home.final.title']}</h2><Link href="/projects" className="mt-24 inline-block rounded-lg bg-surface-paper px-24 py-12 font-semibold text-brand-deep">{labels['home.final.cta']} →</Link></div></section>
    </main>
  );
}
