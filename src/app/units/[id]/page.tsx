import { PublicSleepingSummary } from '@/components/units/PublicSleepingSummary';
import { publicSleepingLabelsForLocale } from '@/modules/content/public-sleeping';
import { PageHeading } from '@/components/premium/StitchPage';
import { Suspense } from 'react';
import { discoveryContext } from '@/lib/discovery-navigation';
import Link from 'next/link';
import { UnitPhotoMosaic } from '@/components/UnitPhotoMosaic';
import { discoveryCopy } from '@/components/DiscoveryHomes';
import { listPublicDiscoveryUnits } from '@/modules/projects/public-discovery';
import { LeadFormSection } from '@/app/(public)/lead-form-section';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Breadcrumb } from '@/components/Breadcrumb';
import { getLabels, getRequestLocale } from '@/lib/i18n';
import { publicPageAlternates, unitJsonLd, serializeJsonLd } from '@/lib/seo';
import { getPublicUnitById } from '@/modules/projects';
import { t } from '@/modules/content';
import { prisma } from '@/lib/prisma';
import UnitDetailClient from './unit-client';
import { track } from '@/modules/analytics';
import { getDestination } from '@/modules/destinations';

export const dynamic = 'force-dynamic';

/**
 * The unit's own description is a content key, so it may legitimately be
 * absent. Nothing is invented to fill the gap — the page simply carries less.
 */
async function unitDescription(descriptionKey: string | null): Promise<string | null> {
  if (!descriptionKey) return null;
  try {
    const value = await t(prisma, descriptionKey, undefined, getRequestLocale());
    return value && value !== descriptionKey && value !== '—' ? value : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const unit = await getPublicUnitById(params.id).catch(() => null) ?? (await listPublicDiscoveryUnits({ unitId: params.id }))[0];

  // Only live units and explicitly imported public discovery inventory get metadata.
  if (!unit) {
    return { robots: { index: false, follow: false } };
  }

  const description = await unitDescription(unit.descriptionKey);

  return {
    title: `${unit.name} · ${unit.project.name} | myUNO`,
    ...(description ? { description } : {}),
    alternates: publicPageAlternates(`/units/${unit.id}`),
    openGraph: {
      title: `${unit.name} · ${unit.project.name}`,
      ...(description ? { description } : {}),
      ...(unit.coverUrl ? { images: [unit.coverUrl] } : {}),
    },
  };
}

export default async function UnitDetailPage({ params, searchParams = {} }: { params: { id: string }; searchParams?: Record<string, string | string[] | undefined> }) {
  // Booking stays behind the strict gate; imported inventory gets inquiry-only details.
  const context = discoveryContext(searchParams);
  const unit = await getPublicUnitById(params.id).catch(() => null) ?? (await listPublicDiscoveryUnits({ unitId: params.id }))[0];
  if (!unit) {
    notFound();
  }

  await track(prisma, 'unit_opened', {
    unitId: unit.id,
    destination: getDestination().key,
    locale: getRequestLocale(),
    intent: 'stay',
    source: 'stay_unit_detail',
  }).catch(() => null);

  const copy = await discoveryCopy(getRequestLocale());
  const projectHref = `/projects/${unit.project.slug}${context ? `?${context}` : ''}`;
  const description = await unitDescription(unit.descriptionKey);
  const jsonLd = 'bookable' in unit ? unitJsonLd({ ...unit, description }) : null;

  const labels = await getLabels({
    ...publicSleepingLabelsForLocale(getRequestLocale()),
    'units.breadcrumb_home': 'Home',
    'units.breadcrumb_detail': 'Unit Details',
    'listing.loading': 'Loading unit details…',
    'listing.not_found': 'Unit not found',
    'listing.back_to_results': '← Back to results',
    'listing.on_myuno': 'on myUNO',
    'listing.show_all_photos': 'Show all {count} photos',
    'listing.photos_pending': 'Photos of this home are being prepared.',
    'listing.representative_media': 'Representative room-type photography. The exact room is assigned from this category.',
    'listing.guests_count': '{count} guests',
    'listing.bedrooms_count': '{count} bedrooms',
    'listing.floor': 'Floor {value}',
    'listing.min_nights_count': 'Min {count} nights',
    'homes.detail.size_unit': 'sqm',
    'listing.not_charged_yet': 'You are not charged yet. Card, transfer or cash on arrival.',
    'listing.fewer_guests': 'Fewer adults',
    'listing.more_guests': 'More adults',
    'search.bar_check_in': 'Check-in',
    'search.bar_check_out': 'Check-out',
    'listing.max_guests': 'Max guests',
    'listing.min_stay': 'Min stay',
    'listing.nights': 'nights',
    'listing.night': 'night',
    'listing.bedrooms': 'Bedrooms',
    'listing.bathrooms': 'Bathrooms',
    'listing.cancellation_policy': 'Cancellation policy',
    'listing.per_night': '/ night',
    'listing.average_for_dates': 'Average per night for your dates, before fees',
    'listing.base_rate_note': 'Base rate — the price for your dates depends on the season',
    'listing.price_nights': '× {nights} nights',
    'listing.discount_long_stay': 'Long stay discount',
    'listing.discount_early_bird': 'Early bird discount',
    'listing.cleaning_fee': 'Cleaning fee',
    'listing.occupancy_tax': 'Occupancy tax',
    'listing.total': 'Total',
    'listing.booking_type': 'Booking type',
    'listing.instant_book': 'Instant book',
    'listing.request_to_book': 'Request to book',
    'listing.payment_method': 'Payment method',
    'listing.pay_cash': 'Cash on arrival',
    'listing.pay_card': 'Card (online)',
    'listing.guest_note': 'Guest note (optional)',
    'listing.guest_note_placeholder': 'Any special requests…',
    'listing.reserve': 'Reserve',
    'listing.reserving': 'Booking…',
    'listing.pick_dates': 'Choose dates on the search page to see the price.',
    'listing.error_price': 'Failed to calculate price',
    'listing.unavailable_for_dates': 'This home cannot be booked for these dates. Please choose other dates.',
    'listing.lease_required_title': 'A year or longer is arranged by lease',
    'listing.lease_required_body':
      'For a stay of twelve months or more, the rate and terms are agreed in a lease. Leave your contact and we will send the terms for your dates.',
    'listing.lease_request_message': 'Lease request: {unit}, {start} – {end}, {guests} guests.',
    'audience.lead.title': 'Leave your contact — we reply within a day',
    'audience.lead.name': 'Your name',
    'audience.lead.contact': 'How to reach you',
    'audience.lead.contact_hint': 'Phone, WhatsApp, Telegram, or email — whatever suits you.',
    'audience.lead.message': 'Tell us about your situation (optional)',
    'audience.lead.consent':
      'I agree that myUNO stores this information to respond to my enquiry.',
    'audience.lead.consent_required': 'Please tick the consent box so we may contact you.',
    'audience.lead.submit': 'Send',
    'audience.lead.submitting': 'Sending…',
    'audience.lead.success': 'Thank you — we received your message and will reply shortly.',
    'audience.lead.error': 'Something went wrong. Please try again, or email us directly.',
    'listing.error_booking': 'Booking failed',
    'listing.conflict_title': 'Those dates are no longer available',
    'listing.conflict_body':
      'Someone else booked this home while you were checking out. Nothing was charged — search again for open dates.',
    'listing.search_again': 'Search again',
    'listing.amenities': 'Amenities',
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
    'catalog.cancellation_policies.flexible.label': 'Flexible',
    'catalog.cancellation_policies.moderate.label': 'Moderate',
    'catalog.cancellation_policies.strict.label': 'Strict',
    'catalog.cancellation_policies.season.label': 'By season of arrival',
  });

  const breadcrumbs = [
    { label: labels['units.breadcrumb_home'], href: '/' },
    { label: unit.project.name, href: projectHref },
    { label: unit.name, current: true },
  ];

  const inquiryAudience = 'renters' as const;
  if (!('bookable' in unit)) {
    return <main className="stitch-workspace">
      <Breadcrumb items={breadcrumbs} />
      <div className="stitch-page space-y-24">
        <Link href={`/search${context ? `?${context}` : ''}`} className="text-brand-andaman hover:underline">{labels['listing.back_to_results']}</Link>
        <PageHeading title={unit.name} subtitle={<Link href={`${projectHref}#homes`} className="text-brand-andaman hover:underline">{unit.project.name} · {copy.project} →</Link>} />
        <UnitPhotoMosaic images={unit.galleryUrls} alt={unit.name} showAllLabel={labels['listing.show_all_photos'].replace('{count}', String(unit.galleryUrls.length))} emptyLabel={copy.photos} />
        <p>{[unit.bedrooms > 0 ? `${unit.bedrooms} ${copy.bedrooms}` : null, unit.maxGuests > 0 ? `${unit.maxGuests} ${copy.guests}` : null, unit.sizeSqm && unit.sizeSqm > 0 ? `${unit.sizeSqm} m²` : null].filter(Boolean).join(' · ')}</p>
        {unit.photoScope === 'room_type' && <p className="text-small text-text-secondary">{copy.representative}</p>}
        {description && <p className="max-w-3xl leading-relaxed">{description}</p>}
        <PublicSleepingSummary spaces={unit.sleepingSpaces} labels={labels} />
        <aside className="stitch-panel p-24"><p>{copy.pending}</p><a href="#lead-form" className="mt-16 inline-flex min-h-48 items-center rounded-lg bg-brand-andaman px-24 text-white">{copy.ask}</a></aside>
      </div>
      <LeadFormSection audience={inquiryAudience} projectId={unit.project.id} initialMessage={`${unit.project.name} — ${unit.name} (${unit.id})`} />
    </main>;
  }

  return (
    <Suspense>
      <Breadcrumb items={breadcrumbs} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <UnitDetailClient
        unitId={params.id}
        sleepingSummary={<PublicSleepingSummary spaces={unit.sleepingSpaces} labels={labels} />}
        labels={{
          loading: labels['listing.loading'],
          notFound: labels['listing.not_found'],
          backToResults: labels['listing.back_to_results'],
          onMyUno: labels['listing.on_myuno'],
          showAllPhotos: labels['listing.show_all_photos'],
          photosPending: labels['listing.photos_pending'],
          representativeMedia: labels['listing.representative_media'],
          guestsCount: labels['listing.guests_count'],
          bedroomsCount: labels['listing.bedrooms_count'],
          floor: labels['listing.floor'],
          minNightsCount: labels['listing.min_nights_count'],
          sizeUnit: labels['homes.detail.size_unit'],
          notChargedYet: labels['listing.not_charged_yet'],
          fewerGuests: labels['listing.fewer_guests'],
          moreGuests: labels['listing.more_guests'],
          checkIn: labels['search.bar_check_in'],
          checkOut: labels['search.bar_check_out'],
          maxGuests: labels['listing.max_guests'],
          minStay: labels['listing.min_stay'],
          nights: labels['listing.nights'],
          night: labels['listing.night'],
          bedrooms: labels['listing.bedrooms'],
          bathrooms: labels['listing.bathrooms'],
          cancellationPolicy: labels['listing.cancellation_policy'],
          perNight: labels['listing.per_night'],
          averageForDates: labels['listing.average_for_dates'],
          baseRateNote: labels['listing.base_rate_note'],
          priceNights: labels['listing.price_nights'],
          discountLongStay: labels['listing.discount_long_stay'],
          discountEarlyBird: labels['listing.discount_early_bird'],
          cleaningFee: labels['listing.cleaning_fee'],
          occupancyTax: labels['listing.occupancy_tax'],
          total: labels['listing.total'],
          bookingType: labels['listing.booking_type'],
          instantBook: labels['listing.instant_book'],
          requestToBook: labels['listing.request_to_book'],
          paymentMethod: labels['listing.payment_method'],
          payCash: labels['listing.pay_cash'],
          payCard: labels['listing.pay_card'],
          guestNote: labels['listing.guest_note'],
          guestNotePlaceholder: labels['listing.guest_note_placeholder'],
          reserve: labels['listing.reserve'],
          reserving: labels['listing.reserving'],
          pickDates: copy.note,
          errorPrice: labels['listing.error_price'],
          errorBooking: labels['listing.error_booking'],
          unavailableForDates: labels['listing.unavailable_for_dates'],
          leaseRequiredTitle: labels['listing.lease_required_title'],
          leaseRequiredBody: labels['listing.lease_required_body'],
          leaseRequestMessage: labels['listing.lease_request_message'],
          leadForm: {
            title: labels['audience.lead.title'],
            name: labels['audience.lead.name'],
            contact: labels['audience.lead.contact'],
            contactHint: labels['audience.lead.contact_hint'],
            message: labels['audience.lead.message'],
            consent: labels['audience.lead.consent'],
            consentRequired: labels['audience.lead.consent_required'],
            submit: labels['audience.lead.submit'],
            submitting: labels['audience.lead.submitting'],
            success: labels['audience.lead.success'],
            error: labels['audience.lead.error'],
          },
          conflictTitle: labels['listing.conflict_title'],
          conflictBody: labels['listing.conflict_body'],
          searchAgain: labels['listing.search_again'],
          amenitiesTitle: labels['listing.amenities'],
          amenityLabels: {
            wifi: labels['catalog.amenities.wifi.label'],
            pool: labels['catalog.amenities.pool.label'],
            kitchen: labels['catalog.amenities.kitchen.label'],
            gym: labels['catalog.amenities.gym.label'],
            parking: labels['catalog.amenities.parking.label'],
            aircon: labels['catalog.amenities.aircon.label'],
            sea_view: labels['catalog.amenities.sea_view.label'],
            washer: labels['catalog.amenities.washer.label'],
            workspace: labels['catalog.amenities.workspace.label'],
            kids_friendly: labels['catalog.amenities.kids_friendly.label'],
            pets_allowed: labels['catalog.amenities.pets_allowed.label'],
            security_24h: labels['catalog.amenities.security_24h.label'],
          },
          policyLabels: {
            flexible: labels['catalog.cancellation_policies.flexible.label'],
            moderate: labels['catalog.cancellation_policies.moderate.label'],
            strict: labels['catalog.cancellation_policies.strict.label'],
            season: labels['catalog.cancellation_policies.season.label'],
          },
        }}
      />
    </Suspense>
  );
}
