import { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { getLabels, getRequestLocale } from '@/lib/i18n';
import { getPublicProjectBySlug } from '@/modules/projects';
import { listPublicMarketplaceServices } from '@/modules/services';
import { getConfig } from '@/modules/config';
import { t, tMany } from '@/modules/content';
import ProjectEditorialSections from '@/components/projects/ProjectEditorialSections';
import ProjectServiceMarketplace from '@/components/projects/ProjectServiceMarketplace';
import ProjectAmenitiesSection from '@/components/projects/ProjectAmenitiesSection';
import { prisma } from '@/lib/prisma';
import { SearchBar } from '@/components/SearchBar';
import { track } from '@/modules/analytics';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { publicPageAlternates, serializeJsonLd } from '@/lib/seo';

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
    alternates: publicPageAlternates(`/projects/${project.slug}`),
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

  const viewer = await getCurrentUser().catch(() => null);
  const activeStay = viewer ? await prisma.booking.findFirst({
    where: {
      guestIdentityId: viewer.identityId,
      projectId: project.id,
      status: { in: ['confirmed', 'checked_in'] },
      endDate: { gt: new Date() },
    },
    select: { id: true, unitId: true },
    orderBy: { startDate: 'asc' },
  }) : null;

  // Track analytics event
  await track(prisma, 'page_project_viewed', {
    projectId: project.id,
  }).catch(() => null);

  const serviceCategoryCatalog = await getConfig(prisma, 'catalog.service_categories')
    .catch(() => []) as Array<{ key?: string }>;
  const serviceCategoryLabels = Object.fromEntries(
    (Array.isArray(serviceCategoryCatalog) ? serviceCategoryCatalog : [])
      .filter(item => typeof item?.key === 'string')
      .map(item => [
        `services.category.${item.key}`,
        String(item.key).replace(/_/g, ' ').replace(/^./, char => char.toUpperCase()),
      ])
  );

  const labels = await getLabels({
    'project_page.availability.title': 'Check availability',
    'project_page.gallery.count': '{count} photos of the residence',
    'project_page.gallery.view_all': 'View all photos',
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
    'project_page.units.empty': 'No accommodation is currently available for online booking.',
    'project_page.owner_intake.title': 'Own or manage a home here?',
    'project_page.owner_intake.body': 'Submit your home to this existing residence. Our team verifies your authority and the listing before publication.',
    'project_page.owner_intake.cta': 'Add your home →',
    'project_page.story.title': 'About the residence',
    'project_page.amenities.title': 'Residence amenities',
    'project_page.amenities.view_all': 'View all amenities →',
    'project_page.amenities.kicker': 'Project amenities',
    'project_page.amenities.included': 'Included',
    'project_page.amenities.free': 'Free',
    'project_page.amenities.booking_required': 'Booking required',
    'project_page.services.title': 'Services available here',
    'project_page.services.view_all': 'Browse all services →',
    'project.services.eyebrow': 'myUNO services',
    'project.services.title': 'Everything around your stay',
    'project.services.body': 'Transfers, flowers, wellness, dining and other vetted services available for {project}.',
    'project.services.view_all': 'Explore all services →',
    'project.services.from': 'from ฿{price}',
    'project_page.location.title': 'Location',
    'project_page.location.open_map': 'Open in maps →',
    'project_page.handbook.title': 'Living here',
    'project_page.trust.title': 'Trust, made visible',
    'project_page.trust.property': 'Property details',
    'project_page.trust.property_body': 'Discover the published property facts, accommodation category and unit details.',
    'project_page.trust.terms': 'Check booking terms',
    'project_page.trust.terms_body': 'Availability and the applicable price are checked before a booking is accepted.',
    'project_page.trust.responsibility': 'Know who operates it',
    'project_page.trust.responsibility_body': 'Management is property-specific; a listing on myUNO does not itself mean direct management.',
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
    ...serviceCategoryLabels,
  });

  const [areaLabel, story, handbookTeaser, services, licenceLine] = await Promise.all([
    resolveKey(project.areaLabelKey),
    resolveKey(project.descriptionKey),
    resolveKey(project.handbookKey),
    listPublicMarketplaceServices(prisma, getRequestLocale(), { projectId: project.id, limit: 8 }).catch(() => []),
    resolveKey(`project.${project.slug}.licence`),
  ]);

  // Project editorial and locality are editable ContentKey records, not a
  // resort-specific React page. The same component works for condos and hotels.
  const editorialFields = [
    'eyebrow', 'headline', 'lead', 'benefits.title',
    'benefit.1.title', 'benefit.1.body',
    'benefit.2.title', 'benefit.2.body',
    'benefit.3.title', 'benefit.3.body',
    'benefit.4.title', 'benefit.4.body',
    'location.title', 'location.body', 'groups.title', 'groups.body', 'groups.cta',
  ] as const;
  const editorialPrefix = `project.${project.slug}.editorial.`;
  const locale = getRequestLocale();
  const editorialKeys = editorialFields.map(field => editorialPrefix + field);
  const categoryDescriptionKeys = project.categories.flatMap(category => [category.titleKey, category.descriptionKey]);
  const editorialCopy = await tMany(prisma, [
    ...editorialKeys,
    ...categoryDescriptionKeys,
    ...(project.areaNameKey ? [project.areaNameKey] : []),
    ...(project.areaDescriptionKey ? [project.areaDescriptionKey] : []),
  ], locale);
  const copy = (field: string) => editorialCopy[editorialPrefix + field] || '';
  const editorial = {
    eyebrow: copy('eyebrow'), headline: copy('headline'), lead: copy('lead'),
    benefitsTitle: copy('benefits.title'),
    benefits: [1, 2, 3, 4].map(index => ({
      title: copy(`benefit.${index}.title`),
      body: copy(`benefit.${index}.body`),
    })),
    locationTitle: copy('location.title'), locationBody: copy('location.body'),
    areaName: project.areaNameKey ? editorialCopy[project.areaNameKey] || '' : '',
    areaDescription: project.areaDescriptionKey ? editorialCopy[project.areaDescriptionKey] || '' : '',
    groupsTitle: copy('groups.title'), groupsBody: copy('groups.body'),
    groupsCta: copy('groups.cta'),
  };

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

  const hasVerifiedPin = Number.isFinite(project.latitude) && Number.isFinite(project.longitude) &&
    !(project.latitude === 0 && project.longitude === 0);
  const mapsUrl = hasVerifiedPin
    ? `https://www.google.com/maps/search/?api=1&query=${project.latitude},${project.longitude}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(project.address)}`;

  const trustPoints = [
    { title: labels['project_page.trust.property'], body: labels['project_page.trust.property_body'] },
    { title: labels['project_page.trust.terms'], body: labels['project_page.trust.terms_body'] },
    { title: labels['project_page.trust.responsibility'], body: labels['project_page.trust.responsibility_body'] },
  ];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': project.projectType === 'resort' || project.projectType === 'villa_estate' ? 'Resort' :
      project.projectType === 'hotel' ? 'Hotel' : 'LodgingBusiness',
    name: project.name,
    address: project.address,
    ...(hasVerifiedPin ? { geo: {
      '@type': 'GeoCoordinates',
      latitude: project.latitude,
      longitude: project.longitude,
    } } : {}),
    ...(project.coverUrl ? { image: project.coverUrl } : {}),
    ...(story ? { description: story.slice(0, 300) } : {}),
  };

  return (
    <main className="min-h-screen bg-surface-ivory">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />

      {/* Hero */}
      <section className="relative bg-gradient-to-br from-brand-andaman to-brand-andaman-dark text-surface-ivory">
        {project.coverUrl ? (
          <Image
            src={project.coverUrl}
            alt={project.name}
            fill
            priority
            className="absolute inset-0 object-cover opacity-30"
          />
        ) : null}
        <div className="relative max-w-4xl mx-auto text-center py-64 px-24">
          {areaLabel ? <p className="text-small mb-16">{areaLabel}</p> : null}
          <h1 className="font-display text-display-xl font-semibold mb-16">{project.name}</h1>
          {editorial.headline && <p className="mb-12 text-body text-surface-ivory/90">{editorial.headline}</p>}
          <p className="text-body text-surface-ivory/90">{project.address}</p>
        </div>
      </section>

      {/* Project-level editorial gallery. Unit galleries remain separate. */}
      {project.galleryUrls.length > 0 ? (
        <section className="mx-auto max-w-6xl px-24 py-24 md:py-40" aria-label={project.name}>
          <div className="grid grid-cols-2 gap-8 overflow-hidden rounded-2xl md:grid-cols-4 md:gap-12">
            {project.galleryUrls.slice(0, 5).map((url, index) => (
              <div key={url + index} className={`relative overflow-hidden bg-surface-ivory ${index === 0 ? 'col-span-2 row-span-2 min-h-[260px] md:min-h-[420px]' : 'min-h-[126px] md:min-h-[204px]'}`}>
                <Image src={url} alt={`${project.name} — photo ${index + 1}`} fill sizes={index === 0 ? '(max-width: 768px) 100vw, 50vw' : '(max-width: 768px) 50vw, 25vw'} className="object-cover" />
              </div>
            ))}
          </div>
          {project.galleryUrls.length > 5 ? <details className="mt-16 rounded-lg border border-border-line p-16"><summary className="cursor-pointer font-semibold text-brand-andaman">{labels['project_page.gallery.view_all']} · {labels['project_page.gallery.count'].replace('{count}', String(project.galleryUrls.length))}</summary><div className="mt-16 grid grid-cols-2 gap-12 md:grid-cols-3">{project.galleryUrls.map((url, index) => <div key={url + index} className="overflow-hidden rounded-lg"><Image src={url} alt={`${project.name} — photo ${index + 1}`} width={640} height={400} className="h-44 w-full object-cover" /></div>)}</div></details> : null}
        </section>
      ) : null}

      <ProjectEditorialSections editorial={editorial} projectId={project.id} />

      {/* A published Project Space may serve sales or leases without sellable Stay offers. */}
      {project.units.length > 0 && <section className="bg-surface-ivory py-40 px-24">
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
      </section>}

      {/* Three styles + villa categories (config-driven: renders only when
          the project defines a unit-categories catalog) */}
      {project.categories.length > 0 ? (
        <section className="max-w-6xl mx-auto py-64 px-24">
          {styleKeys.length > 1 ? (
            <>
              <h2 className="font-display text-display-xl font-semibold text-text-ink mb-24">
                {labels['project_page.styles.title']}
              </h2>
              <div className="flex flex-wrap gap-16 mb-40">
                {styleKeys.map((styleKey) => (
                  <span
                    key={styleKey}
                    className="bg-surface-ivory border border-border-line rounded-lg px-24 py-12 text-body text-text-ink"
                  >
                    {styleLabels[styleKey] || styleKey}
                  </span>
                ))}
              </div>
            </>
          ) : null}
          <h2 className="font-display text-display-xl font-semibold text-text-ink mb-40">
            {labels['project_page.categories.title']}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-32">
            {project.categories.map((category) => (
              <div
                key={category.key}
                className="bg-surface-paper border border-border-line rounded-lg p-24"
              >
                {category.coverUrl ? (
                  <Image src={category.coverUrl}
                    alt={categoryLabels[category.key] || category.key}
                    width={640} height={360}
                    className="mb-16 aspect-video w-full rounded-md object-cover" />
                ) : null}
                <h3 className="text-heading-3 font-bold text-text-ink mb-8">
                  {category.name}
                </h3>
                {editorialCopy[category.titleKey] && (
                  <p className="mb-8 font-medium text-brand-andaman">{editorialCopy[category.titleKey]}</p>
                )}
                {editorialCopy[category.descriptionKey] && (
                  <p className="mb-12 text-small leading-relaxed text-text-secondary">{editorialCopy[category.descriptionKey]}</p>
                )}
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
        <section className="bg-surface-ivory py-64 px-24">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="font-display text-display-xl font-semibold text-text-ink mb-16">
              {labels['project_page.longstay.title']}
            </h2>
            <p className="text-body text-text-secondary mb-24">
              {labels['project_page.longstay.body']}
            </p>
            <div className="flex flex-wrap justify-center gap-16 mb-24">
              {monthlyCategories.map((category) => (
                <div
                  key={category.key}
                  className="bg-surface-paper border border-border-line rounded-lg px-24 py-16"
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
        <h2 className="font-display text-display-xl font-semibold text-text-ink mb-40">
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
                className="bg-surface-paper border border-border-line rounded-lg overflow-hidden hover:shadow-card transition"
              >
                {unit.coverUrl ? (
                  <Image
                    src={unit.coverUrl}
                    alt={unit.name}
                    width={640}
                    height={176}
                    className="w-full h-44 object-cover"
                  />
                ) : (
                  <div className="w-full h-44 bg-surface-ivory" />
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
                      satangToThb(unit.baseNightlyThb)
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
        <div className="mt-40 flex flex-wrap items-center justify-between gap-16 rounded-xl border border-border-line bg-surface-ivory p-24">
          <div>
            <h3 className="font-display text-heading-3 font-semibold text-text-ink">{labels['project_page.owner_intake.title']}</h3>
            <p className="mt-8 max-w-2xl text-small text-text-secondary">{labels['project_page.owner_intake.body']}</p>
          </div>
          <Link href={`/property/onboard?projectId=${encodeURIComponent(project.id)}`}
            className="inline-flex min-h-44 items-center rounded-lg bg-brand-andaman px-20 py-10 text-small font-semibold text-white hover:opacity-90">
            {labels['project_page.owner_intake.cta']}
          </Link>
        </div>
      </section>

      {/* Project story */}
      {story ? (
        <section className="bg-surface-ivory py-64 px-24">
          <div className="max-w-4xl mx-auto">
            <h2 className="font-display text-display-xl font-semibold text-text-ink mb-24">
              {labels['project_page.story.title']}
            </h2>
            <p className="text-body text-text-secondary whitespace-pre-line">{story}</p>
          </div>
        </section>
      ) : null}

      {project.amenities.length > 0 ? (
        <ProjectAmenitiesSection
          projectSlug={project.slug}
          amenities={project.amenities}
          title={labels['project_page.amenities.title']}
          viewAllLabel={labels['project_page.amenities.view_all']}
          labels={{
            kicker: labels['project_page.amenities.kicker'],
            included: labels['project_page.amenities.included'],
            free: labels['project_page.amenities.free'],
            bookingRequired: labels['project_page.amenities.booking_required'],
          }}
          bookingId={activeStay?.id}
        />
      ) : project.amenityKeys.length > 0 ? (
        <section className="max-w-6xl mx-auto py-64 px-24">
          <h2 className="font-display text-display-xl font-semibold text-text-ink mb-24">
            {labels['project_page.amenities.title']}
          </h2>
          <div className="flex flex-wrap gap-16">
            {project.amenityKeys.map((key) => (
              <span key={key} className="bg-surface-ivory border border-border-line rounded-lg px-24 py-12 text-body text-text-ink">
                {amenityLabel(key)}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      <ProjectServiceMarketplace
        projectId={project.id}
        projectName={project.name}
        services={services}
        labels={labels}
        bookingId={activeStay?.id}
        unitId={activeStay?.unitId}
      />

      {/* Location */}
      <section className="max-w-4xl mx-auto py-64 px-24">
        <h2 className="font-display text-display-xl font-semibold text-text-ink mb-24">
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
        <section className="bg-surface-ivory py-64 px-24">
          <div className="max-w-4xl mx-auto">
            <h2 className="font-display text-display-xl font-semibold text-text-ink mb-24">
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
            <h2 className="font-display text-display-xl font-semibold text-text-ink">
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
              <div key={i} className="bg-surface-paper border border-border-line rounded-lg p-24">
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
        <h2 className="font-display text-display-xl font-semibold text-text-ink mb-40 text-center">
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
              <div className="text-heading-2 mb-16" aria-hidden="true">·</div>
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
