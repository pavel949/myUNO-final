import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLabels, getRequestLocale } from '@/lib/i18n';
import { getPublicProjectBySlug } from '@/modules/projects';
import { listPublicServices } from '@/modules/services';
import { getConfig } from '@/modules/config';
import { t } from '@/modules/content';
import { prisma } from '@/lib/prisma';
import { SearchBar } from '@/components/SearchBar';

export const dynamic = 'force-dynamic';

/** Resolve a project content key, returning '' when the key has no copy yet. */
async function resolveKey(key: string | null | undefined): Promise<string> {
  if (!key) return '';
  try {
    const value = await t(prisma, key, undefined, getRequestLocale());
    return value && value !== key && value !== '—' ? value : '';
  } catch {
    return '';
  }
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const project = await getPublicProjectBySlug(params.slug);
  // notFound() here (not only in the page body) so the response carries a
  // real 404 status — thrown during page streaming it would soft-404 as 200.
  if (!project) notFound();
  const description = await resolveKey(project.descriptionKey);
  return {
    title: `${project.name} | myUNO`,
    description: description.slice(0, 160) || undefined,
    alternates: { canonical: `/projects/${project.slug}` },
    openGraph: {
      title: project.name,
      description: description.slice(0, 160) || undefined,
      images: project.coverUrl ? [project.coverUrl] : undefined,
    },
  };
}

export default async function ProjectLandingPage({
  params,
}: {
  params: { slug: string };
}) {
  const project = await getPublicProjectBySlug(params.slug);
  if (!project) notFound();

  const labels = await getLabels({
    'project_page.availability.title': 'Check availability',
    'project_page.styles.title': 'Three styles, one resort',
    'project_page.categories.title': 'Villa categories',
    'project_page.categories.from_night': 'from ฿{price} / night',
    'project_page.categories.villas_count': '{count} villas',
    'project_page.longstay.title': 'Long stays',
    'project_page.longstay.body': 'Stay a month or a season: flat monthly rates for 28+ nights, with housekeeping and concierge included.',
    'project_page.longstay.from_month': 'from ฿{price} / month',
    'project_page.longstay.cta': 'Request a long stay →',
    'project_page.reviews.title': 'Guest reviews',
    'project_page.reviews.count': '{count} reviews',
    'project_page.units.title': 'Homes in this residence',
    'project_page.units.bedrooms': '{count} bd',
    'project_page.units.bathrooms': '{count} ba',
    'project_page.units.guests': 'up to {count} guests',
    'project_page.units.per_night': '฿{price} / night',
    'project_page.units.view': 'View home →',
    'project_page.units.empty': 'Homes here are being prepared for booking.',
    'project_page.story.title': 'About the residence',
    'project_page.amenities.title': 'Residence amenities',
    'project_page.services.title': 'Services available here',
    'project_page.services.view_all': 'Browse all services →',
    'project_page.location.title': 'Location',
    'project_page.location.open_map': 'Open in maps →',
    'project_page.handbook.title': 'Living here',
    'project_page.trust.title': 'Trust, made visible',
    'landing.trust.verified': 'Guests verified',
    'landing.trust.verified_body': 'Passports, backgrounds, proof of funds.',
    'landing.trust.handled': 'Compliance handled',
    'landing.trust.handled_body': 'TM30, taxes, PDPA — we file it all.',
    'landing.trust.protected': 'Data protected',
    'landing.trust.protected_body': 'Encrypted fields, access logs, retention policies.',
    'landing.trust.cta': 'Learn how →',
    'landing.search.check_in': 'Check-in',
    'landing.search.check_out': 'Check-out',
    'landing.search.adults': 'Adults',
    'landing.search.children': 'Children',
    'landing.search.submit': 'Find your stay',
    'catalog.amenities.wifi.label': 'Wi-Fi',
    'catalog.amenities.pool.label': 'Pool',
    'catalog.amenities.kitchen.label': 'Kitchen',
    'catalog.amenities.gym.label': 'Gym',
    'catalog.amenities.parking.label': 'Parking',
    'catalog.amenities.aircon.label': 'Air conditioning',
    'catalog.amenities.sea_view.label': 'Sea view',
    'catalog.amenities.washer.label': 'Washer',
    'catalog.amenities.workspace.label': 'Workspace',
    'catalog.amenities.kids_friendly.label': 'Kids friendly',
    'catalog.amenities.pets_allowed.label': 'Pets allowed',
    'catalog.amenities.security_24h.label': '24h security',
  });

  const [areaLabel, story, handbookTeaser, services, licenceLine] = await Promise.all([
    resolveKey(project.areaLabelKey),
    resolveKey(project.descriptionKey),
    resolveKey(project.handbookKey),
    listPublicServices(prisma, project.id).catch(() => []),
    resolveKey(`project.${project.slug}.licence`),
  ]);

  // Category & style labels resolve from the content layer (doc 05 §4)
  const categoryLabels: Record<string, string> = {};
  const styleLabels: Record<string, string> = {};
  for (const c of project.categories) {
    categoryLabels[c.key] = await resolveKey(`catalog.unit_categories.${c.key}.label`);
    if (c.styleKey && !(c.styleKey in styleLabels)) {
      styleLabels[c.styleKey] = await resolveKey(`catalog.styles.${c.styleKey}.label`);
    }
  }
  const styleKeys = [...new Set(project.categories.map((c) => c.styleKey).filter(Boolean))] as string[];
  const monthlyCategories = project.categories.filter((c) => c.monthlyFromThb !== null);
  const satangToThb = (satang: number) => Math.round(satang / 100).toLocaleString();

  // Long-stay requests go to the project's concierge WhatsApp (config);
  // without a number the CTA falls back to the guests page.
  const whatsappNumber = await getConfig(prisma, 'comms.whatsapp_number', {
    projectId: project.id,
  });
  const longStayCtaHref = whatsappNumber
    ? `https://wa.me/${whatsappNumber.replace(/[^0-9]/g, '')}`
    : '/guests';

  const amenityLabel = (key: string): string => {
    const contentKey = `catalog.amenities.${key}.label` as keyof typeof labels;
    return (labels as Record<string, string>)[contentKey] ?? key;
  };

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${project.latitude},${project.longitude}`;

  const trustPoints = [
    { title: labels['landing.trust.verified'], body: labels['landing.trust.verified_body'] },
    { title: labels['landing.trust.handled'], body: labels['landing.trust.handled_body'] },
    { title: labels['landing.trust.protected'], body: labels['landing.trust.protected_body'] },
  ];

  const jsonLd = {
    '@context': 'https://schema.org',
    // A project selling villa categories is a Resort; a plain building stays
    // the generic LodgingBusiness (Resort is its subtype).
    '@type': project.categories.length > 0 ? 'Resort' : 'LodgingBusiness',
    name: project.name,
    address: project.address,
    geo: {
      '@type': 'GeoCoordinates',
      latitude: project.latitude,
      longitude: project.longitude,
    },
    ...(project.coverUrl ? { image: project.coverUrl } : {}),
    ...(story ? { description: story.slice(0, 300) } : {}),
  };

  return (
    <main className="min-h-screen bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Hero */}
      <section className="relative bg-gradient-to-br from-brand-andaman to-brand-andaman-dark text-surface-ivory">
        {project.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={project.coverUrl}
            alt={project.name}
            className="absolute inset-0 w-full h-full object-cover opacity-30"
          />
        ) : null}
        <div className="relative max-w-4xl mx-auto text-center py-64 px-24">
          {areaLabel ? <p className="text-small mb-16">{areaLabel}</p> : null}
          <h1 className="text-heading-1 font-bold mb-16">{project.name}</h1>
          <p className="text-body text-surface-ivory/90">{project.address}</p>
        </div>
      </section>

      {/* Availability bar */}
      <section className="bg-surface-background py-40 px-24">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-heading-2 font-bold text-text-ink mb-24 text-center">
            {labels['project_page.availability.title']}
          </h2>
          <SearchBar
            projectId={project.id}
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

      {/* Three styles + villa categories (config-driven: renders only when
          the project defines a unit-categories catalog) */}
      {project.categories.length > 0 ? (
        <section className="max-w-6xl mx-auto py-64 px-24">
          {styleKeys.length > 1 ? (
            <>
              <h2 className="text-heading-1 font-bold text-text-ink mb-24">
                {labels['project_page.styles.title']}
              </h2>
              <div className="flex flex-wrap gap-16 mb-40">
                {styleKeys.map((styleKey) => (
                  <span
                    key={styleKey}
                    className="bg-surface-background border border-border-line rounded-lg px-24 py-12 text-body text-text-ink"
                  >
                    {styleLabels[styleKey] || styleKey}
                  </span>
                ))}
              </div>
            </>
          ) : null}
          <h2 className="text-heading-1 font-bold text-text-ink mb-40">
            {labels['project_page.categories.title']}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-32">
            {project.categories.map((category) => (
              <div
                key={category.key}
                className="bg-white border border-border-line rounded-lg p-24"
              >
                <h3 className="text-heading-3 font-bold text-text-ink mb-8">
                  {categoryLabels[category.key] || category.key}
                </h3>
                {category.styleKey ? (
                  <p className="text-small text-text-secondary mb-8">
                    {styleLabels[category.styleKey] || category.styleKey}
                  </p>
                ) : null}
                <p className="text-small text-text-secondary mb-12">
                  {labels['project_page.categories.villas_count'].replace(
                    '{count}',
                    String(category.unitCount)
                  )}
                </p>
                {category.fromNightlyThb !== null ? (
                  <p className="text-body text-text-ink font-semibold">
                    {labels['project_page.categories.from_night'].replace(
                      '{price}',
                      satangToThb(category.fromNightlyThb)
                    )}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Long-stay block (renders when any category sells monthly) */}
      {monthlyCategories.length > 0 ? (
        <section className="bg-surface-background py-64 px-24">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-heading-1 font-bold text-text-ink mb-16">
              {labels['project_page.longstay.title']}
            </h2>
            <p className="text-body text-text-secondary mb-24">
              {labels['project_page.longstay.body']}
            </p>
            <div className="flex flex-wrap justify-center gap-16 mb-24">
              {monthlyCategories.map((category) => (
                <div
                  key={category.key}
                  className="bg-white border border-border-line rounded-lg px-24 py-16"
                >
                  <p className="text-small text-text-secondary mb-4">
                    {categoryLabels[category.key] || category.key}
                  </p>
                  <p className="text-body text-text-ink font-semibold">
                    {labels['project_page.longstay.from_month'].replace(
                      '{price}',
                      satangToThb(category.monthlyFromThb as number)
                    )}
                  </p>
                </div>
              ))}
            </div>
            <a
              href={longStayCtaHref}
              target={whatsappNumber ? '_blank' : undefined}
              rel={whatsappNumber ? 'noopener noreferrer' : undefined}
              className="text-brand-andaman font-semibold"
            >
              {labels['project_page.longstay.cta']}
            </a>
          </div>
        </section>
      ) : null}

      {/* Units grid */}
      <section className="max-w-6xl mx-auto py-64 px-24">
        <h2 className="text-heading-1 font-bold text-text-ink mb-40">
          {labels['project_page.units.title']}
        </h2>
        {project.units.length === 0 ? (
          <p className="text-body text-text-secondary">
            {labels['project_page.units.empty']}
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-32">
            {project.units.map((unit) => (
              <Link
                key={unit.id}
                href={`/units/${unit.id}`}
                className="bg-white border border-border-line rounded-lg overflow-hidden hover:shadow-lg transition"
              >
                {unit.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={unit.coverUrl}
                    alt={unit.name}
                    className="w-full h-44 object-cover"
                  />
                ) : (
                  <div className="w-full h-44 bg-surface-background" />
                )}
                <div className="p-24">
                  <h3 className="text-heading-3 font-bold text-text-ink mb-8">{unit.name}</h3>
                  <p className="text-small text-text-secondary mb-12">
                    {labels['project_page.units.bedrooms'].replace('{count}', String(unit.bedrooms))}
                    {' · '}
                    {labels['project_page.units.bathrooms'].replace('{count}', String(unit.bathrooms))}
                    {' · '}
                    {labels['project_page.units.guests'].replace('{count}', String(unit.maxGuests))}
                  </p>
                  <p className="text-body text-text-ink font-semibold mb-12">
                    {labels['project_page.units.per_night'].replace(
                      '{price}',
                      unit.baseNightlyThb.toLocaleString()
                    )}
                  </p>
                  <span className="text-brand-andaman font-semibold text-small">
                    {labels['project_page.units.view']}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Project story */}
      {story ? (
        <section className="bg-surface-background py-64 px-24">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-heading-1 font-bold text-text-ink mb-24">
              {labels['project_page.story.title']}
            </h2>
            <p className="text-body text-text-secondary whitespace-pre-line">{story}</p>
          </div>
        </section>
      ) : null}

      {/* Amenities */}
      {project.amenityKeys.length > 0 ? (
        <section className="max-w-6xl mx-auto py-64 px-24">
          <h2 className="text-heading-1 font-bold text-text-ink mb-24">
            {labels['project_page.amenities.title']}
          </h2>
          <div className="flex flex-wrap gap-16">
            {project.amenityKeys.map((key) => (
              <span
                key={key}
                className="bg-surface-background border border-border-line rounded-lg px-24 py-12 text-body text-text-ink"
              >
                {amenityLabel(key)}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {/* Services available here */}
      {services.length > 0 ? (
        <section className="bg-surface-background py-64 px-24">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-heading-1 font-bold text-text-ink mb-24">
              {labels['project_page.services.title']}
            </h2>
            <div className="flex flex-wrap gap-16 mb-24">
              {services.slice(0, 8).map((service: { id: string; title: string }) => (
                <Link
                  key={service.id}
                  href={`/services/${service.id}`}
                  className="bg-white border border-border-line rounded-lg px-24 py-12 text-body text-text-ink hover:shadow-md transition"
                >
                  {service.title}
                </Link>
              ))}
            </div>
            <Link href="/services" className="text-brand-andaman font-semibold">
              {labels['project_page.services.view_all']}
            </Link>
          </div>
        </section>
      ) : null}

      {/* Location */}
      <section className="max-w-4xl mx-auto py-64 px-24">
        <h2 className="text-heading-1 font-bold text-text-ink mb-24">
          {labels['project_page.location.title']}
        </h2>
        <p className="text-body text-text-secondary mb-16">{project.address}</p>
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-andaman font-semibold"
        >
          {labels['project_page.location.open_map']}
        </a>
      </section>

      {/* Handbook teaser */}
      {handbookTeaser ? (
        <section className="bg-surface-background py-64 px-24">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-heading-1 font-bold text-text-ink mb-24">
              {labels['project_page.handbook.title']}
            </h2>
            <p className="text-body text-text-secondary whitespace-pre-line">
              {handbookTeaser.length > 400
                ? `${handbookTeaser.slice(0, 400)}…`
                : handbookTeaser}
            </p>
          </div>
        </section>
      ) : null}

      {/* Guest reviews (dynamic from the DB; renders only when they exist) */}
      {project.reviews.count > 0 ? (
        <section className="max-w-6xl mx-auto py-64 px-24">
          <div className="flex items-baseline gap-16 mb-40">
            <h2 className="text-heading-1 font-bold text-text-ink">
              {labels['project_page.reviews.title']}
            </h2>
            <span className="text-body text-text-secondary">
              {'★'.repeat(Math.round(project.reviews.average ?? 0))}{' '}
              {project.reviews.average}{' · '}
              {labels['project_page.reviews.count'].replace(
                '{count}',
                String(project.reviews.count)
              )}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-32">
            {project.reviews.items.map((review, i) => (
              <div key={i} className="bg-white border border-border-line rounded-lg p-24">
                <p className="text-small text-brand-andaman mb-8">
                  {'★'.repeat(review.rating)}
                </p>
                {review.comment ? (
                  <p className="text-body text-text-ink mb-12">{review.comment}</p>
                ) : null}
                <p className="text-small text-text-secondary">
                  {review.authorFirstName} ·{' '}
                  {new Date(review.createdAt).toLocaleDateString()}
                </p>
                {review.reply ? (
                  <p className="text-small text-text-secondary mt-12 pl-12 border-l-2 border-border-line">
                    {review.reply}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Trust band */}
      <section className="max-w-6xl mx-auto py-64 px-24">
        <h2 className="text-heading-1 font-bold text-text-ink mb-40 text-center">
          {labels['project_page.trust.title']}
        </h2>
        {licenceLine ? (
          <p className="text-body text-text-ink text-center font-semibold mb-40">
            {licenceLine}
          </p>
        ) : null}
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
    </main>
  );
}
