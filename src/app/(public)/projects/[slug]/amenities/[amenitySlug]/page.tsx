import { amenityLeadTime, amenityUsageLines } from '@/modules/projects/amenity-usage';
import { AMENITY_USAGE_LABELS, AMENITY_USAGE_DRAFTS, amenityUsageLabels } from '@/modules/projects/amenity-usage-copy';
import { UI_LOCALE } from '@/lib/format';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getPublicProjectAmenityBySlug } from '@/modules/projects';
import { getLabels, getRequestLocale } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

function human(value: string) {
  return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
export default async function AmenityDetailPage(
  props: {
    params: Promise<{ slug: string; amenitySlug: string }>;
    searchParams?: Promise<{ bookingId?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const data = await getPublicProjectAmenityBySlug(prisma, params.slug, params.amenitySlug, getRequestLocale());
  if (!data) notFound();
  const { project, amenity } = data;
  const usageLabels = amenityUsageLabels(await getLabels(AMENITY_USAGE_LABELS, getRequestLocale(), AMENITY_USAGE_DRAFTS));
  const leadTime = amenityLeadTime(amenity.reservationConfig);
  const leadText = leadTime ? usageLabels.lead.replace('{amount}', String(leadTime.amount)).replace('{unit}', usageLabels[leadTime.unit]) : null;
  const labels = await getLabels({
    'project_amenity.back': 'All amenities',
    'project_amenity.terms': 'Terms of use',
    'project_amenity.rules': 'Rules',
    'project_amenity.location': 'Location',
    'project_amenity.access': 'Access',
    'project_amenity.how_access': 'How to access',
    'project_amenity.cost': 'Cost',
    'project_amenity.capacity': 'Capacity',
    'project_amenity.min_age': 'Minimum age',
    'project_amenity.booking': 'Booking',
    'project_amenity.hours': 'Opening hours',
    'project_amenity.book': 'Book this amenity',
    'project_amenity.free': 'Free',
    'project_amenity.included': 'Included',
  });

  return <main className="stitch-workspace">
    <div className="stitch-page max-w-5xl space-y-24">
    <header className="stitch-hero">
      <div>
        <Link href={`/projects/${project.slug}/amenities`} className="text-small font-semibold text-brand-andaman hover:underline">← {labels['project_amenity.back']}</Link>
        <h1 className="mt-12 font-display text-display-xl font-semibold text-text-ink">{amenity.name}</h1>
        {amenity.shortDescription ? <p className="mt-8 text-body text-text-secondary">{amenity.shortDescription}</p> : null}
      </div>
    </header>

    <div className="stitch-panel p-20 md:p-24">
      {amenity.galleryUrls.length ? (
        <div className="grid gap-8 sm:grid-cols-2">
          {amenity.galleryUrls.map((src, i) => <Image key={src} src={src} alt={`${amenity.name} photo ${i+1}`} width={900} height={540} className="aspect-video w-full rounded-lg object-cover" />)}
        </div>
      ) : amenity.coverUrl ? <Image src={amenity.coverUrl} alt={amenity.name} width={1200} height={720} className="aspect-video w-full rounded-lg object-cover" /> : null}

      <div className="mt-32 grid gap-24 lg:grid-cols-[1fr_320px]">
        <article>
          {amenity.description ? <p className="whitespace-pre-line text-body leading-relaxed text-text-secondary">{amenity.description}</p> : null}
          {amenity.openingHours ? <section className="mt-24"><h2 className="font-display text-heading-2 font-semibold">{labels['project_amenity.hours']}</h2><ul className="mt-8 list-disc space-y-8 pl-20 text-body text-text-secondary">{amenityUsageLines(amenity.openingHours, usageLabels).map((line, index) => <li key={index}>{line}</li>)}</ul></section> : null}
          {amenity.terms ? <section className="mt-24"><h2 className="font-display text-heading-2 font-semibold">{labels['project_amenity.terms']}</h2><p className="mt-8 whitespace-pre-line text-body text-text-secondary">{amenity.terms}</p></section> : null}
          {amenity.rules ? <section className="mt-24"><h2 className="font-display text-heading-2 font-semibold">{labels['project_amenity.rules']}</h2><ul className="mt-8 list-disc space-y-8 pl-20 text-body text-text-secondary">{amenityUsageLines(amenity.rules, usageLabels).map((line, index) => <li key={index}>{line}</li>)}</ul></section> : null}
        </article>
        <aside className="stitch-panel-soft p-20">
          <dl className="space-y-12 text-small">
            {amenity.locationLabel ? <div><dt className="text-text-secondary">{labels['project_amenity.location']}</dt><dd className="font-medium">{amenity.locationLabel}</dd></div> : null}
            <div><dt className="text-text-secondary">{labels['project_amenity.access']}</dt><dd className="font-medium">{amenity.accessType === 'not_specified' ? usageLabels.unknown : human(amenity.accessType)}</dd></div>
            {amenity.accessInstructions ? <div><dt className="text-text-secondary">{labels['project_amenity.how_access']}</dt><dd className="font-medium">{amenity.accessInstructions}</dd></div> : null}
            <div><dt className="text-text-secondary">{labels['project_amenity.cost']}</dt><dd className="font-medium">{amenity.pricingType === 'not_specified' ? usageLabels.unknown : amenity.pricingType === 'included' ? labels['project_amenity.included'] : amenity.pricingType === 'free' ? labels['project_amenity.free'] : amenity.priceThb !== null ? `฿${Math.round(amenity.priceThb/100).toLocaleString(UI_LOCALE)}` : human(amenity.pricingType)}</dd></div>
            {amenity.capacity ? <div><dt className="text-text-secondary">{labels['project_amenity.capacity']}</dt><dd className="font-medium">{amenity.capacity}</dd></div> : null}
            {amenity.minAge !== null ? <div><dt className="text-text-secondary">{labels['project_amenity.min_age']}</dt><dd className="font-medium">{amenity.minAge}</dd></div> : null}
            {amenity.bookingRequired ? <div><dt className="text-text-secondary">{labels['project_amenity.booking']}</dt><dd className="font-medium">{amenity.bookingMode === 'other' ? usageLabels.otherBooking : human(amenity.bookingMode)}{leadText ? <p className="mt-4">{leadText}</p> : null}</dd></div> : null}
          </dl>
          {amenity.bookingRequired && project.status === 'live' ? (
            ['time_slot','request','reception'].includes(amenity.bookingMode) ? (
              <Link
                href={`/projects/${project.slug}/amenities/${amenity.slug}/book${searchParams?.bookingId ? `?bookingId=${encodeURIComponent(searchParams.bookingId)}` : ''}`}
                className="mt-20 inline-flex min-h-48 w-full items-center justify-center rounded-lg bg-brand-andaman px-16 font-semibold text-surface-ivory hover:bg-brand-deep"
              >
                {labels['project_amenity.book']}
              </Link>
            ) : amenity.bookingUrl ? (
              <a href={amenity.bookingUrl} className="mt-20 inline-flex min-h-48 w-full items-center justify-center rounded-lg bg-brand-andaman px-16 font-semibold text-surface-ivory hover:bg-brand-deep">
                {labels['project_amenity.book']}
              </a>
            ) : null
          ) : null}
        </aside>
      </div>
    </div>
    </div>
  </main>;
}
