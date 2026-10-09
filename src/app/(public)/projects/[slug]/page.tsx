import { discoveryCopy } from '@/components/DiscoveryHomes';
import { discoveryContext } from '@/lib/discovery-navigation';
import { UI_LOCALE } from '@/lib/format';
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
import ProjectNearbySection from '@/components/projects/ProjectNearbySection';
import ProjectPortalNav from '@/components/projects/ProjectPortalNav';
import { LeadFormSection } from '@/app/(public)/lead-form-section';
import { prisma } from '@/lib/prisma';
import { SearchBar } from '@/components/SearchBar';
import { track } from '@/modules/analytics';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { publicPageAlternates, serializeJsonLd } from '@/lib/seo';
import { listPublicCommercialHomes } from '@/modules/projects/commercial-discovery';
import { LocalDate } from '@/components/LocalDate';
import { getDestination } from '@/modules/destinations';

const HERO_IMAGE_SIZES = '(max-width: 1080px) 100vw, 1080px';

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
  const project = await getPublicProjectBySlug(params.slug, getRequestLocale());
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
  params, searchParams = {},
}: {
  params: { slug: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const project = await getPublicProjectBySlug(params.slug, getRequestLocale());
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

  // Track both the legacy page-view event and the conversion-funnel open.
  const projectEventDimensions = {
    projectId: project.id,
    destination: getDestination().key,
    locale: getRequestLocale(),
    source: 'project_portal',
  };
  await Promise.all([
    track(prisma, 'page_project_viewed', projectEventDimensions),
    track(prisma, 'project_opened', projectEventDimensions),
  ]).catch(() => null);

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
    'project_page.styles.generic_title': 'Property styles',
    'project_page.categories.generic_title': 'Accommodation categories',
    'project_page.categories.from_night': 'from ฿{price} / night',
    'project_page.categories.homes_count': '{count} homes',
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
    'project_page.units.inquiry': 'Ask about this home →',
    'project_page.units.details_pending': 'Details and booking terms are being completed. You can already ask about this home.',
    'project_page.units.representative_media': 'Representative room-type photos',
    'project_page.units.empty': 'No homes have been published in this residence yet.',
    'project_page.commercial.title': 'Ways to own or live here',
    'project_page.commercial.body': 'Verified homes appear here only when the relevant listing authority and property media are ready.',
    'project_page.commercial.buy': 'Homes for sale',
    'project_page.commercial.rent': 'Long-term rentals',
    'project_page.commercial.count': '{count} available',
    'project_page.commercial.view': 'View available homes →',
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
    'project_page.nearby.kicker': 'Around the project',
    'project_page.nearby.title': 'What is nearby',
    'project_page.nearby.body': 'Useful places around the residence, with distance and travel estimates where available.',
    'project_page.nearby.distance': '{distance} away',
    'project_page.nearby.walk': '{minutes} min walk',
    'project_page.nearby.drive': '{minutes} min drive',
    'project_page.nearby.open_map': 'Open map →',
    'project_page.nav.stay': 'Stay',
    'project_page.nav.homes': 'Homes',
    'project_page.nav.amenities': 'Amenities',
    'project_page.nav.services': 'Services',
    'project_page.nav.nearby': 'Nearby',
    'project_page.nav.location': 'Location',
    'project_page.nav.contact': 'Ask us',
    'project_page.rules.title': 'House rules',
    'project_page.shuttle.title': 'Shuttle & transport',
    'project_page.handbook.title': 'Living here',
    'project_page.trust.title': 'Trust, made visible',
    'project_page.trust.property': 'Property details',
    'project_page.trust.property_body': 'Discover the published property facts, accommodation category and unit details.',
    'project_page.trust.terms': 'Check booking terms',
    'project_page.trust.terms_body': 'Availability and the applicable price are checked before a booking is accepted.',
    'project_page.trust.responsibility': 'Know who operates it',
    'project_page.trust.responsibility_body': 'Management is property-specific; a listing on myUNO does not itself mean direct management.',
    'project_page.trust.passport': 'View public Project Passport',
    'project_page.trust.passport_body': 'See the evidence currently documented in myUNO, including regulatory, organization, commercial and unit-compliance coverage.',
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

  const [areaLabel, story, handbookTeaser, houseRules, shuttleSchedule, services, licenceLine, allCommercialHomes] = await Promise.all([
    resolveKey(project.areaLabelKey),
    resolveKey(project.descriptionKey),
    resolveKey(project.handbookKey),
    resolveKey(`project.${project.slug}.house_rules`),
    resolveKey(`project.${project.slug}.shuttle_schedule`),
    listPublicMarketplaceServices(prisma, getRequestLocale(), { projectId: project.id, limit: 8 }).catch(() => []),
    resolveKey(`project.${project.slug}.licence`),
    listPublicCommercialHomes(prisma, undefined, undefined, project.id).catch(() => []),
  ]);
  const projectCommercialHomes = allCommercialHomes;
  const buyHomeCount = projectCommercialHomes.filter((home) => home.intents.includes('buy')).length;
  const rentHomeCount = projectCommercialHomes.filter((home) => home.intents.includes('rent')).length;
  const context = discoveryContext(searchParams, { projectId: project.id });
  const bookableStayCount = project.units.filter((unit) => unit.bookable).length;

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
  const discovery = await discoveryCopy(locale);
  const editorialKeys = editorialFields.map(field => editorialPrefix + field);
  const categoryDescriptionKeys = project.categories.flatMap(category => [category.titleKey, category.descriptionKey]);
  const unitEditorialKeys = project.units.flatMap(unit =>
    [unit.titleKey, unit.descriptionKey].filter((key): key is string => Boolean(key))
  );
  const unitFactKeys = project.units.flatMap(unit => [
    ...unit.views.map(view => `catalog.views.${view}.label`),
    ...unit.unitFeatures
      .filter(feature => /^[a-z0-9_]+$/.test(feature))
      .map(feature => `catalog.unit_features.${feature}.label`),
  ]);
  const editorialCopy = await tMany(prisma, [
    ...editorialKeys,
    ...categoryDescriptionKeys,
    ...unitEditorialKeys,
    ...unitFactKeys,
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
  const satangToThb = (satang: number) => Math.round(satang / 100).toLocaleString(UI_LOCALE);

  // Keep the project and long-stay intent in the canonical, consented lead
  // flow. The rental opportunity and staff thread are created by /api/leads.
  const longStayInquiry = searchParams.inquiry === 'long_stay';
  const longStayCtaHref = `/projects/${encodeURIComponent(project.slug)}?inquiry=long_stay#lead-form`;

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
      project.projectType === 'hotel' ? 'Hotel' :
        project.projectType === 'condominium' ? 'ApartmentComplex' : 'Place',
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

  const projectInquiryAudience: 'renters' = 'renters';
  const portalNavItems = [
    ...(bookableStayCount > 0 ? [{ href: '#availability', label: labels['project_page.nav.stay'] }] : []),
    ...(project.categories.length > 0 ? [{ href: '#categories', label: labels['project_page.categories.generic_title'] }] : []),
    ...(project.units.length > 0 || buyHomeCount > 0 || rentHomeCount > 0 ? [{ href: '#homes', label: labels['project_page.nav.homes'] }] : []),
    ...(project.amenities.length > 0 ? [{ href: '#amenities', label: labels['project_page.nav.amenities'] }] : []),
    ...(services.length > 0 ? [{ href: '#services', label: labels['project_page.nav.services'] }] : []),
    ...(project.nearbyPlaces.length > 0 ? [{ href: '#nearby', label: labels['project_page.nav.nearby'] }] : []),
    { href: '#location', label: labels['project_page.nav.location'] },
    { href: '#lead-form', label: labels['project_page.nav.contact'] },
  ];

  return (
    <main className="stitch-workspace">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />

      {/* Hero */}
      <section className="mx-auto max-w-content px-20 pt-24 md:px-32 md:pt-40">
        <div className="relative isolate overflow-hidden rounded-lg bg-brand-deep shadow-float">
          {project.coverUrl ? (
            <Image
              src={project.coverUrl}
              alt={project.name}
              fill
              priority
              sizes={HERO_IMAGE_SIZES}
              className="absolute inset-0 -z-10 object-cover"
            />
          ) : null}
          <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />
          <div className="flex min-h-[320px] flex-col justify-end p-24 text-white md:min-h-[440px] md:p-40">
            <div className="flex flex-wrap gap-8">
              {areaLabel ? (
                <span className="rounded-full bg-surface-paper/20 px-12 py-4 text-small font-semibold text-surface-paper backdrop-blur">{areaLabel}</span>
              ) : null}
              {editorial.eyebrow ? (
                <span className="rounded-full bg-brand-sun px-12 py-4 text-small font-semibold text-brand-deep">{editorial.eyebrow}</span>
              ) : null}
            </div>
            <h1 className="mt-12 max-w-4xl font-display text-display-xl font-semibold tracking-[-0.03em] text-white md:text-display-hero-lg">{project.name}</h1>
            {editorial.headline && <p className="mt-12 max-w-3xl text-body text-white/90">{editorial.headline}</p>}
            <p className="mt-8 text-small text-white/75">{project.address}</p>
          </div>
        </div>
      </section>

      {/* Project-level editorial gallery. Unit galleries remain separate. */}
      {project.galleryUrls.length > 0 ? (
        <section className="mx-auto max-w-content px-20 py-24 md:px-32 md:py-40" aria-label={project.name}>
          <div className="grid grid-cols-2 gap-8 overflow-hidden rounded-lg bg-surface-sand p-8 shadow-card md:grid-cols-4 md:gap-12">
            {project.galleryUrls.slice(0, 5).map((url, index) => (
              <div key={url + index} className={`relative overflow-hidden rounded-md bg-surface-ivory ${index === 0 ? 'col-span-2 row-span-2 min-h-[260px] md:min-h-[420px]' : 'min-h-[126px] md:min-h-[204px]'}`}>
                <Image src={url} alt={`${project.name} — photo ${index + 1}`} fill sizes={index === 0 ? '(max-width: 768px) 100vw, 50vw' : '(max-width: 768px) 50vw, 25vw'} className="object-cover" />
              </div>
            ))}
          </div>
          {project.galleryUrls.length > 5 ? <details className="mt-16 rounded-lg border border-border-line p-16"><summary className="cursor-pointer font-semibold text-brand-andaman">{labels['project_page.gallery.view_all']} · {labels['project_page.gallery.count'].replace('{count}', String(project.galleryUrls.length))}</summary><div className="mt-16 grid grid-cols-2 gap-12 md:grid-cols-3">{project.galleryUrls.map((url, index) => <div key={url + index} className="overflow-hidden rounded-lg"><Image src={url} alt={`${project.name} — photo ${index + 1}`} width={640} height={400} className="h-44 w-full object-cover" /></div>)}</div></details> : null}
        </section>
      ) : null}

      <ProjectPortalNav items={portalNavItems} />

      <ProjectEditorialSections editorial={editorial} projectId={project.id} />

      {/* A published Project Space may serve sales or leases without sellable Stay offers. */}
      {bookableStayCount > 0 && <section id="availability" className="px-20 py-40 md:px-32">
        <div className="mx-auto max-w-content rounded-lg border border-border-line bg-surface-paper p-20 shadow-card md:p-32">
          <h2 className="mb-24 font-display text-heading-2 font-semibold text-text-ink">
            {labels['project_page.availability.title']}
          </h2>
          <SearchBar
            projectId={project.id}
            initialStartDate={typeof searchParams.startDate === 'string' ? searchParams.startDate : ''}
            initialEndDate={typeof searchParams.endDate === 'string' ? searchParams.endDate : ''}
            initialAdults={Number(searchParams.adults) || 2}
            initialChildren={Number(searchParams.children) || 0}
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

      {(buyHomeCount > 0 || rentHomeCount > 0) ? (
        <section id="homes" className="mx-auto max-w-content px-20 py-40 md:px-32">
          <div className="rounded-lg border border-border-line bg-surface-paper p-24 shadow-card md:p-32">
            <h2 className="font-display text-heading-2 font-semibold text-text-ink">
              {labels['project_page.commercial.title']}
            </h2>
            <p className="mt-8 max-w-3xl text-body text-text-secondary">
              {labels['project_page.commercial.body']}
            </p>
            <div className="mt-24 grid gap-16 md:grid-cols-2">
              {buyHomeCount > 0 ? (
                <Link
                  href={`/homes?intent=buy&projectId=${encodeURIComponent(project.id)}`}
                  className="rounded-lg border border-border-line bg-surface-ivory p-20 shadow-card transition hover:shadow-float"
                >
                  <p className="font-display text-heading-3 font-semibold text-text-ink">
                    {labels['project_page.commercial.buy']}
                  </p>
                  <p className="mt-8 text-small text-text-secondary">
                    {labels['project_page.commercial.count'].replace('{count}', String(buyHomeCount))}
                  </p>
                  <p className="mt-12 text-small font-semibold text-brand-andaman">
                    {labels['project_page.commercial.view']}
                  </p>
                </Link>
              ) : null}
              {rentHomeCount > 0 ? (
                <Link
                  href={`/homes?intent=rent&projectId=${encodeURIComponent(project.id)}`}
                  className="rounded-lg border border-border-line bg-surface-ivory p-20 shadow-card transition hover:shadow-float"
                >
                  <p className="font-display text-heading-3 font-semibold text-text-ink">
                    {labels['project_page.commercial.rent']}
                  </p>
                  <p className="mt-8 text-small text-text-secondary">
                    {labels['project_page.commercial.count'].replace('{count}', String(rentHomeCount))}
                  </p>
                  <p className="mt-12 text-small font-semibold text-brand-andaman">
                    {labels['project_page.commercial.view']}
                  </p>
                </Link>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {/* Three styles + villa categories (config-driven: renders only when
          the project defines a unit-categories catalog) */}
      {project.categories.length > 0 ? (
        <section id="categories" className="mx-auto max-w-content px-20 py-64 md:px-32">
          {styleKeys.length > 1 ? (
            <>
              <h2 className="font-display text-display-xl font-semibold text-text-ink mb-24">
                {labels['project_page.styles.generic_title']}
              </h2>
              <div className="flex flex-wrap gap-16 mb-40">
                {styleKeys.map((styleKey) => (
                  <span
                    key={styleKey}
                    className="rounded-full border border-border-line bg-surface-paper px-20 py-8 text-small font-semibold text-text-ink"
                  >
                    {styleLabels[styleKey] || styleKey}
                  </span>
                ))}
              </div>
            </>
          ) : null}
          <h2 className="font-display text-display-xl font-semibold text-text-ink mb-40">
            {labels['project_page.categories.generic_title']}
          </h2>
          <div className="grid grid-cols-1 gap-24 md:grid-cols-2 lg:grid-cols-3">
            {project.categories.map((category) => (
              <Link
                key={category.key}
                href={`/projects/${project.slug}/categories/${encodeURIComponent(category.key)}?${context}`}
                className="block overflow-hidden rounded-lg border border-border-line bg-surface-paper p-16 shadow-card transition hover:shadow-float"
              >
                {category.coverUrl ? (
                  <Image src={category.coverUrl}
                    alt={categoryLabels[category.key] || category.key}
                    width={640} height={480}
                    className="mb-16 aspect-[4/3] w-full rounded-md object-cover" />
                ) : null}
                <h3 className="mb-8 font-display text-heading-3 font-semibold text-text-ink">
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
                  {labels['project_page.categories.homes_count'].replace(
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
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* Long-stay block (renders when any category sells monthly) */}
      {monthlyCategories.length > 0 ? (
        <section className="bg-surface-sand px-20 py-64 md:px-32">
          <div className="mx-auto max-w-4xl text-center">
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
                  className="rounded-lg border border-border-line bg-surface-paper px-24 py-16 shadow-card"
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
            <Link
              href={longStayCtaHref}
              className="inline-flex min-h-44 items-center rounded-md bg-brand-andaman px-24 text-small font-semibold text-white hover:bg-brand-deep"
            >
              {labels['project_page.longstay.cta']}
            </Link>
          </div>
        </section>
      ) : null}

      {/* Units grid */}
      <section id={(buyHomeCount > 0 || rentHomeCount > 0) ? undefined : 'homes'} className="mx-auto max-w-content px-20 py-64 md:px-32">
        <h2 className="mb-40 font-display text-display-xl font-semibold text-text-ink">
          {labels['project_page.units.title']}
        </h2>
        {project.units.length === 0 ? (
          <p className="text-body text-text-secondary">
            {labels['project_page.units.empty']}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-24 md:grid-cols-2 lg:grid-cols-3">
            {project.units.map((unit) => (
              <Link
                key={unit.id}
                href={`/units/${unit.id}?${context}`}
                className="group flex flex-col overflow-hidden rounded-lg border border-border-line bg-surface-paper shadow-card transition-shadow hover:shadow-float"
              >
                {unit.coverUrl ? (
                  <Image
                    src={unit.coverUrl}
                    alt={unit.name}
                    width={640}
                    height={480}
                    className="aspect-[4/3] w-full object-cover"
                  />
                ) : (
                  <div className="flex aspect-[4/3] items-center justify-center bg-surface-sand px-16 text-center text-small text-text-secondary">
                    {discovery.pending}
                  </div>
                )}
                <div className="flex flex-1 flex-col p-20">
                  {unit.photoScope === 'room_type' ? (
                    <p className="mb-8 text-small font-medium text-brand-andaman">
                      {labels['project_page.units.representative_media']}
                    </p>
                  ) : null}
                  <h3 className="mb-4 font-display text-heading-3 font-semibold text-text-ink">{unit.name}</h3>
                  {unit.titleKey && editorialCopy[unit.titleKey] ? (
                    <p className="mb-8 text-small font-semibold text-brand-andaman">
                      {editorialCopy[unit.titleKey]}
                    </p>
                  ) : null}
                  {unit.descriptionKey && editorialCopy[unit.descriptionKey] ? (
                    <p className="mb-12 line-clamp-3 text-small leading-relaxed text-text-secondary">
                      {editorialCopy[unit.descriptionKey]}
                    </p>
                  ) : null}
                  {(unit.bedrooms > 0 || unit.bathrooms > 0 || unit.maxGuests > 0 || unit.grossAreaSqm || unit.sizeSqm) ? (
                    <p className="text-small text-text-secondary mb-12">
                      {[
                        unit.bedrooms > 0 ? labels['project_page.units.bedrooms'].replace('{count}', String(unit.bedrooms)) : null,
                        unit.bathrooms > 0 ? labels['project_page.units.bathrooms'].replace('{count}', String(unit.bathrooms)) : null,
                        unit.maxGuests > 0 ? labels['project_page.units.guests'].replace('{count}', String(unit.maxGuests)) : null,
                        unit.grossAreaSqm ? `${unit.grossAreaSqm.toLocaleString(UI_LOCALE)} m²` : unit.sizeSqm ? `${unit.sizeSqm.toLocaleString(UI_LOCALE)} m²` : null,
                      ].filter(Boolean).join(' · ')}
                    </p>
                  ) : null}
                  {(unit.views.length > 0 || unit.unitFeatures.some(feature => /^[a-z0-9_]+$/.test(feature))) ? (
                    <div className="mb-12 flex flex-wrap gap-8">
                      {[
                        ...unit.views.map(view => ({
                          key: `view:${view}`,
                          label: editorialCopy[`catalog.views.${view}.label`],
                        })),
                        ...unit.unitFeatures
                          .filter(feature => /^[a-z0-9_]+$/.test(feature))
                          .map(feature => ({
                            key: `feature:${feature}`,
                            label: editorialCopy[`catalog.unit_features.${feature}.label`],
                          })),
                      ]
                        .filter((fact): fact is { key: string; label: string } => Boolean(fact.label))
                        .slice(0, 4)
                        .map((fact) => (
                          <span key={fact.key} className="rounded-full bg-surface-sand px-12 py-4 text-[12px] text-text-secondary">
                            {fact.label}
                          </span>
                        ))}
                    </div>
                  ) : null}
                  {unit.bookable && unit.baseNightlyThb > 0 ? (
                    <p className="text-body text-text-ink font-semibold mb-12">
                      {labels['project_page.units.per_night'].replace(
                        '{price}',
                        satangToThb(unit.baseNightlyThb)
                      )}
                    </p>
                  ) : (
                    <p className="mb-12 text-small text-text-secondary">
                      {discovery.pending}
                    </p>
                  )}
                  <span className="mt-auto inline-flex min-h-44 items-center justify-center rounded-md bg-brand-andaman px-20 text-small font-semibold text-white transition group-hover:bg-brand-deep">
                    {discovery.open} →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
        <div className="mt-40 flex flex-wrap items-center justify-between gap-16 rounded-lg border border-border-line bg-surface-sand p-24">
          <div>
            <h3 className="font-display text-heading-3 font-semibold text-text-ink">{labels['project_page.owner_intake.title']}</h3>
            <p className="mt-8 max-w-2xl text-small text-text-secondary">{labels['project_page.owner_intake.body']}</p>
          </div>
          <Link href={`/property/onboard?projectId=${encodeURIComponent(project.id)}`}
            className="inline-flex min-h-44 items-center rounded-md bg-brand-andaman px-20 py-12 text-small font-semibold text-white hover:bg-brand-deep">
            {labels['project_page.owner_intake.cta']}
          </Link>
        </div>
      </section>

      {/* Project story */}
      {story ? (
        <section className="bg-surface-sand px-20 py-64 md:px-32">
          <div className="mx-auto max-w-4xl">
            <h2 className="font-display text-display-xl font-semibold text-text-ink mb-24">
              {labels['project_page.story.title']}
            </h2>
            <p className="text-body text-text-secondary whitespace-pre-line">{story}</p>
          </div>
        </section>
      ) : null}

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

      <ProjectServiceMarketplace
        projectId={project.id}
        projectName={project.name}
        services={services}
        labels={labels}
        bookingId={activeStay?.id}
        unitId={activeStay?.unitId}
      />

      {(houseRules || shuttleSchedule) ? (
        <section className="mx-auto grid max-w-content gap-16 px-20 py-48 md:grid-cols-2 md:px-32 md:py-64">
          {houseRules ? (
            <article className="rounded-md border border-border-line bg-surface-paper p-24">
              <h2 className="font-display text-heading-2 font-semibold text-text-ink">
                {labels['project_page.rules.title']}
              </h2>
              <p className="mt-12 whitespace-pre-line text-body text-text-secondary">{houseRules}</p>
            </article>
          ) : null}
          {shuttleSchedule ? (
            <article className="rounded-md border border-border-line bg-surface-paper p-24">
              <h2 className="font-display text-heading-2 font-semibold text-text-ink">
                {labels['project_page.shuttle.title']}
              </h2>
              <p className="mt-12 whitespace-pre-line text-body text-text-secondary">{shuttleSchedule}</p>
            </article>
          ) : null}
        </section>
      ) : null}

      {/* Location */}
      <section id="location" className="mx-auto max-w-4xl px-20 py-64 md:px-32">
        <h2 className="font-display text-display-xl font-semibold text-text-ink mb-24">
          {labels['project_page.location.title']}
        </h2>
        <p className="text-body text-text-secondary mb-16">{project.address}</p>
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-44 items-center rounded-md border border-border-line bg-surface-paper px-20 text-small font-semibold text-brand-andaman shadow-card hover:shadow-float"
        >
          {labels['project_page.location.open_map']}
        </a>
      </section>

      <ProjectNearbySection
        places={project.nearbyPlaces}
        labels={{
          kicker: labels['project_page.nearby.kicker'],
          title: labels['project_page.nearby.title'],
          body: labels['project_page.nearby.body'],
          distance: labels['project_page.nearby.distance'],
          walk: labels['project_page.nearby.walk'],
          drive: labels['project_page.nearby.drive'],
          openMap: labels['project_page.nearby.open_map'],
        }}
      />

      <LeadFormSection
        audience={projectInquiryAudience}
        projectId={project.id}
        initialMessage={longStayInquiry
          ? `${labels['project_page.longstay.title']} · ${project.name}`
          : undefined}
        sourceMedium={longStayInquiry ? 'project_long_stay' : undefined}
      />

      {/* Handbook teaser */}
      {handbookTeaser ? (
        <section className="bg-surface-sand px-20 py-64 md:px-32">
          <div className="mx-auto max-w-4xl">
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
        <section className="mx-auto max-w-content px-20 py-64 md:px-32">
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
          <div className="grid grid-cols-1 gap-24 md:grid-cols-2 lg:grid-cols-3">
            {project.reviews.items.map((review, i) => (
              <div key={i} className="rounded-lg border border-border-line bg-surface-paper p-24 shadow-card">
                <p className="text-small text-brand-andaman mb-8">
                  {'★'.repeat(review.rating)}
                </p>
                {review.comment ? (
                  <p className="text-body text-text-ink mb-12">{review.comment}</p>
                ) : null}
                <p className="text-small text-text-secondary">
                  {review.authorFirstName} ·{' '}
                  <LocalDate value={review.createdAt} />
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
      <section className="mx-auto max-w-content px-20 py-64 md:px-32">
        <h2 className="font-display text-display-xl font-semibold text-text-ink mb-40 text-center">
          {labels['project_page.trust.title']}
        </h2>
        {licenceLine ? (
          <p className="text-body text-text-ink text-center font-semibold mb-40">
            {licenceLine}
          </p>
        ) : null}
        <div className="grid grid-cols-1 gap-24 md:grid-cols-3 mb-40">
          {trustPoints.map((point) => (
            <div key={point.title} className="rounded-lg border border-border-line bg-surface-paper p-24 text-center shadow-card">
              <div className="text-heading-2 mb-16" aria-hidden="true">·</div>
              <h3 className="mb-12 font-display text-heading-3 font-semibold text-text-ink">{point.title}</h3>
              <p className="text-body text-text-secondary">{point.body}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-col items-center justify-center gap-12 text-center sm:flex-row">
          <Link
            href={`/projects/${project.slug}/passport`}
            className="inline-flex min-h-44 items-center rounded-md bg-brand-andaman px-24 text-small font-semibold text-white hover:bg-brand-deep"
          >
            {labels['project_page.trust.passport']}
          </Link>
          <Link href="/trust" className="text-brand-andaman font-semibold hover:underline">
            {labels['landing.trust.cta']}
          </Link>
        </div>
        <p className="mx-auto mt-12 max-w-2xl text-center text-small text-text-secondary">
          {labels['project_page.trust.passport_body']}
        </p>
      </section>
    </main>
  );
}
