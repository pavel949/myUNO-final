import Link from 'next/link';
import type { Metadata } from 'next';
import { ProjectCard } from '@/components/ProjectCard';
import { ServiceCard } from '@/components/ServiceCard';
import { EmptyState } from '@/components/premium/PremiumPrimitives';
import { getLabels, getRequestLocale } from '@/lib/i18n';
import { publicPageAlternates } from '@/lib/seo';
import { getPublicHomepageData } from '@/modules/home/public-homepage.service';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const labels = await getLabels({
    'explore.meta.title': 'Explore Phuket on myUNO',
    'explore.meta.description':
      'Browse stays, homes, services and places on myUNO — one connected Phuket property network.',
  });
  return {
    title: labels['explore.meta.title'],
    description: labels['explore.meta.description'],
    alternates: publicPageAlternates('/explore'),
  };
}

export default async function ExplorePage() {
  const locale = getRequestLocale();
  const [labels, data] = await Promise.all([
    getLabels({
      'explore.kicker': 'EXPLORE',
      'explore.title': 'Find your way into Phuket.',
      'explore.body':
        'Stays, homes and services share one property record. Start with the path that matches what you need.',
      'explore.stays.title': 'Stays',
      'explore.stays.body': 'Search verified availability and continue into one booking flow.',
      'explore.stays.cta': 'Find a stay',
      'explore.homes.title': 'Homes',
      'explore.homes.body': 'Sale and long-term rental offerings on documented homes.',
      'explore.homes.cta': 'Browse homes',
      'explore.services.title': 'Services',
      'explore.services.body': 'Trusted local services around a stay or a standalone Phuket need.',
      'explore.services.cta': 'Browse services',
      'explore.owners.title': 'For owners',
      'explore.owners.body': 'List a home yourself, or ask myUNO to operate it.',
      'explore.owners.cta': 'Owner paths',
      'explore.partners.title': 'For partners',
      'explore.partners.body': 'Property managers, providers and developers use scoped workspaces.',
      'explore.partners.cta': 'Partner paths',
      'explore.places.kicker': 'PLACES',
      'explore.places.title': 'Projects on myUNO',
      'explore.places.cta': 'All projects',
      'explore.places.empty': 'Projects are being prepared for publication.',
      'explore.areas.kicker': 'AREAS',
      'explore.areas.title': 'Phuket by area',
      'explore.areas.cta': 'All areas',
      'explore.areas.empty': 'Area discovery is being prepared.',
      'explore.areas.projects': '{count} projects',
      'landing.collection.homes': '{count} homes',
      'landing.collection.from_price': 'From ฿{price} / night',
      'landing.collection.no_photo': 'Illustrative image',
      'landing.collection.view': 'Explore',
      'landing.services.vetted': 'Vetted',
      'landing.services.from': 'From',
      'landing.services.no_photo': 'Illustrative image',
      'landing.services.empty': 'Services are being prepared for publication.',
      'explore.services.section_cta': 'All services',
    }),
    getPublicHomepageData(locale),
  ]);

  const doors = [
    { href: '/stays', title: labels['explore.stays.title'], body: labels['explore.stays.body'], cta: labels['explore.stays.cta'] },
    { href: '/homes', title: labels['explore.homes.title'], body: labels['explore.homes.body'], cta: labels['explore.homes.cta'] },
    { href: '/services', title: labels['explore.services.title'], body: labels['explore.services.body'], cta: labels['explore.services.cta'] },
    { href: '/owners', title: labels['explore.owners.title'], body: labels['explore.owners.body'], cta: labels['explore.owners.cta'] },
    { href: '/partners', title: labels['explore.partners.title'], body: labels['explore.partners.body'], cta: labels['explore.partners.cta'] },
  ];

  return (
    <main className="min-h-screen bg-surface-ivory">
      <section className="bg-brand-deep px-20 py-56 text-surface-ivory md:px-32 md:py-80">
        <div className="mx-auto max-w-content">
          <p className="text-kicker uppercase tracking-[0.18em] text-brand-sun-soft">{labels['explore.kicker']}</p>
          <h1 className="mt-12 max-w-4xl font-display text-display-xl font-semibold tracking-[-0.02em]">
            {labels['explore.title']}
          </h1>
          <p className="mt-16 max-w-2xl text-body text-surface-ivory/72">{labels['explore.body']}</p>
        </div>
      </section>

      <section className="mx-auto max-w-content px-20 py-56 md:px-32">
        <div className="grid gap-16 md:grid-cols-2 lg:grid-cols-3">
          {doors.map((door) => (
            <Link
              key={door.href}
              href={door.href}
              className="flex min-h-[180px] flex-col justify-between rounded-2xl border border-border-line bg-surface-paper p-24 transition-shadow duration-structural hover:shadow-card"
            >
              <div>
                <h2 className="font-display text-heading-2 font-semibold text-text-ink">{door.title}</h2>
                <p className="mt-12 text-body text-text-secondary">{door.body}</p>
              </div>
              <span className="mt-24 text-small font-semibold text-brand-andaman">{door.cta} →</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="bg-surface-paper px-20 py-56 md:px-32 md:py-80">
        <div className="mx-auto max-w-content">
          <div className="mb-32 flex flex-col justify-between gap-16 md:flex-row md:items-end">
            <div>
              <p className="text-kicker uppercase text-brand-andaman">{labels['explore.places.kicker']}</p>
              <h2 className="mt-8 font-display text-display-xl font-semibold text-text-ink">
                {labels['explore.places.title']}
              </h2>
            </div>
            <Link href="/projects" className="shrink-0 font-semibold text-brand-andaman hover:underline">
              {labels['explore.places.cta']} →
            </Link>
          </div>
          {data.projects.length ? (
            <div className="grid grid-cols-1 gap-16 sm:grid-cols-2 lg:grid-cols-3">
              {data.projects.slice(0, 6).map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  labels={{
                    homes: labels['landing.collection.homes'],
                    fromPrice: labels['landing.collection.from_price'],
                    noPhoto: labels['landing.collection.no_photo'],
                    view: labels['landing.collection.view'],
                  }}
                />
              ))}
            </div>
          ) : (
            <EmptyState title={labels['explore.places.empty']} />
          )}
        </div>
      </section>

      <section className="mx-auto max-w-content px-20 py-56 md:px-32">
        <div className="mb-32 flex flex-col justify-between gap-16 md:flex-row md:items-end">
          <div>
            <p className="text-kicker uppercase text-brand-andaman">{labels['explore.areas.kicker']}</p>
            <h2 className="mt-8 font-display text-display-xl font-semibold text-text-ink">
              {labels['explore.areas.title']}
            </h2>
          </div>
          <Link href="/areas" className="shrink-0 font-semibold text-brand-andaman hover:underline">
            {labels['explore.areas.cta']} →
          </Link>
        </div>
        {data.areas.length ? (
          <div className="grid gap-16 sm:grid-cols-2 lg:grid-cols-3">
            {data.areas.map((area) => (
              <Link
                key={area.id}
                href={`/areas/${area.slug}`}
                className="flex min-h-[180px] flex-col justify-between rounded-2xl border border-border-line bg-surface-paper p-24"
              >
                <div>
                  <p className="text-small font-semibold text-brand-andaman">
                    {labels['explore.areas.projects'].replace('{count}', String(area.projectCount))}
                  </p>
                  <h3 className="mt-8 font-display text-title font-semibold text-text-ink">{area.displayName}</h3>
                  {area.description ? (
                    <p className="mt-12 line-clamp-3 text-body text-text-secondary">{area.description}</p>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState title={labels['explore.areas.empty']} />
        )}
      </section>

      <section className="bg-surface-paper px-20 py-56 md:px-32 md:py-80">
        <div className="mx-auto max-w-content">
          <div className="mb-32 flex justify-end">
            <Link href="/services" className="font-semibold text-brand-andaman hover:underline">
              {labels['explore.services.section_cta']} →
            </Link>
          </div>
          {data.services.length ? (
            <div className="grid grid-cols-1 gap-16 sm:grid-cols-2 lg:grid-cols-3">
              {data.services.slice(0, 6).map((service) => (
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
            <EmptyState title={labels['landing.services.empty']} />
          )}
        </div>
      </section>
    </main>
  );
}
