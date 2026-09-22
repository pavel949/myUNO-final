import { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { getLabels } from '@/lib/i18n';
import { siteUrl, publicPageAlternates, serializeJsonLd } from '@/lib/seo';
import { SearchBar } from '@/components/SearchBar';
import { TrustMark } from '@/components/TrustMark';
import { listPublicProjects } from '@/modules/projects';

export const metadata: Metadata = {
  title: 'myUNO | Exceptional stays, one trusted platform',
  description: 'Discover serviced homes in Phuket with live availability, transparent pricing and connected local service.',
  alternates: publicPageAlternates('/'),
};
export const dynamic = 'force-dynamic';

export default async function LandingPage() {
  const [labels, projects] = await Promise.all([
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
      'landing.collection.empty': 'Residences are being prepared for launch.',
      'landing.promise.stay': 'Stay',
      'landing.promise.stay_body': 'Search real availability, see the price and reserve the same inventory our team operates.',
      'landing.promise.live': 'Live',
      'landing.promise.live_body': 'One place for services, support and the practical details around your home.',
      'landing.promise.own': 'Own',
      'landing.promise.own_body': 'One operating record for the property, reservations, performance and owner visibility.',
    }),
    listPublicProjects(),
  ]);

  const heroProject = projects.find((project) => project.coverUrl) ?? null;
  const organizationJsonLd = {
    '@context': 'https://schema.org', '@type': 'Organization', name: 'myUNO',
    legalName: 'Ignatev Estate Co., Ltd', url: siteUrl(), areaServed: 'Phuket, Thailand',
  };

  return (
    <main className="min-h-screen bg-surface-ivory">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(organizationJsonLd) }} />

      <section className="relative min-h-[76vh] overflow-hidden bg-brand-deep text-surface-ivory">
        {heroProject?.coverUrl ? (
          <Image src={heroProject.coverUrl} alt="" fill priority className="object-cover opacity-70 scale-[1.01]" sizes={undefined} />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-brand-deep via-brand-andaman to-brand-deep opacity-95" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-brand-deep via-brand-deep/30 to-transparent" />
        <div className="relative max-w-7xl mx-auto px-24 min-h-[76vh] flex flex-col justify-end pb-48 md:pb-64">
          <div className="max-w-4xl">
            <div className="flex items-center gap-12 mb-16"><TrustMark size={28} /><p className="text-kicker uppercase tracking-[0.22em] text-brand-sun-soft">{labels['landing.hero.kicker']}</p></div>
            <h1 className="font-display text-[clamp(3.2rem,8vw,7.5rem)] leading-[0.9] tracking-[-0.04em] font-semibold max-w-4xl">
              {labels['landing.hero.title']}
            </h1>
            <p className="mt-20 text-lg md:text-xl text-surface-ivory/85 max-w-2xl">{labels['landing.hero.subtitle']}</p>
          </div>
          <div className="mt-32 max-w-5xl rounded-2xl bg-surface-paper/95 text-text-ink shadow-2xl backdrop-blur p-8 md:p-12">
            <SearchBar labels={{checkIn:labels['landing.search.check_in'],checkOut:labels['landing.search.check_out'],adults:labels['landing.search.adults'],children:labels['landing.search.children'],submit:labels['landing.search.submit']}} />
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
            {projects.slice(0,3).map((project, index) => (
              <Link key={project.id} href={`/projects/${project.slug}`} className={`group relative overflow-hidden rounded-2xl bg-brand-deep ${index === 0 ? 'md:col-span-2 md:row-span-2 min-h-[520px]' : 'min-h-[250px]'}`}>
                {project.coverUrl ? <Image src={project.coverUrl} alt={project.name} fill className="object-cover transition duration-700 group-hover:scale-[1.03]" sizes={index===0?'(min-width: 768px) 66vw':'(min-width: 768px) 33vw'} /> : <div className="absolute inset-0 bg-gradient-to-br from-brand-andaman via-brand-deep to-brand-deep" />}
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-24 text-white">
                  <p className="text-small text-white/70">{labels['landing.collection.homes'].replace('{count}', String(project.liveUnitCount))}</p>
                  <h3 className="font-display text-heading-2 font-semibold mt-4">{project.name}</h3>
                </div>
              </Link>
            ))}
          </div>
        ) : <div className="rounded-2xl border border-border-line bg-surface-paper p-32 text-text-secondary">{labels['landing.collection.empty']}</div>}
      </section>

      <section className="bg-brand-deep text-surface-ivory">
        <div className="max-w-7xl mx-auto px-24 py-64 md:py-80 grid grid-cols-1 md:grid-cols-3 gap-40">
          {([['stay','stay_body'],['live','live_body'],['own','own_body']] as const).map(([title,body],i)=>(
            <div key={title} className="border-t border-white/20 pt-20">
              <span className="text-small text-brand-sun-soft">0{i+1}</span>
              <h3 className="font-display text-display font-semibold mt-16">{labels[`landing.promise.${title}`]}</h3>
              <p className="text-body text-surface-ivory/70 mt-12">{labels[`landing.promise.${body}`]}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
