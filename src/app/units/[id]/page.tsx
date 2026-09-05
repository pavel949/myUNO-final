import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Breadcrumb } from '@/components/Breadcrumb';
import { getLabels, getRequestLocale } from '@/lib/i18n';
import { publicPageAlternates, unitJsonLd, serializeJsonLd } from '@/lib/seo';
import { getPublicUnitById } from '@/modules/projects';
import { t } from '@/modules/content';
import { prisma } from '@/lib/prisma';
import UnitDetailClient from './unit-client';

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
  const unit = await getPublicUnitById(params.id).catch(() => null);

  // A draft or paused unit has no public face, so it gets no indexable
  // metadata either (doc 08 §7).
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

export default async function UnitDetailPage({ params }: { params: { id: string } }) {
  // Suspended/draft entities never render (doc 08 §7). The booking widget
  // below is client-rendered, so without this gate a paused unit would still
  // serve a page and get indexed.
  const unit = await getPublicUnitById(params.id).catch(() => null);
  if (!unit) {
    notFound();
  }

  const description = await unitDescription(unit.descriptionKey);
  const jsonLd = unitJsonLd({ ...unit, description });

  const labels = await getLabels({
    'units.breadcrumb_home': 'Home',
    'units.breadcrumb_detail': 'Unit Details',
    'listing.loading': 'Loading unit details…',
    'listing.not_found': 'Unit not found',
    'listing.back_to_results': '← Back to results',
    'listing.on_myuno': 'on myUNO',
    'listing.show_all_photos': 'Show all {count} photos',
    'listing.guests_count': '{count} guests',
    'listing.bedrooms_count': '{count} bedrooms',
    'listing.min_nights_count': 'Min {count} nights',
    'listing.not_charged_yet': 'You are not charged yet. Card, transfer or cash on arrival.',
    'listing.fewer_guests': 'Fewer adults',
    'listing.more_guests': 'More adults',
    'search.bar_check_in': 'Check-in',
    'search.bar_check_out': 'Check-out',
    'listing.default_description': 'A beautiful home in Phuket.',
    'listing.max_guests': 'Max guests',
    'listing.min_stay': 'Min stay',
    'listing.nights': 'nights',
    'listing.night': 'night',
    'listing.bedrooms': 'Bedrooms',
    'listing.bathrooms': 'Bathrooms',
    'listing.cancellation_policy': 'Cancellation policy',
    'listing.cancellation_default': 'Flexible cancellation',
    'listing.per_night': '/ night',
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
  });

  const breadcrumbs = [
    { label: labels['units.breadcrumb_home'], href: '/' },
    { label: labels['units.breadcrumb_detail'], current: true },
  ];

  return (
    <Suspense>
      <Breadcrumb items={breadcrumbs} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <UnitDetailClient
        unitId={params.id}
        labels={{
          loading: labels['listing.loading'],
          notFound: labels['listing.not_found'],
          backToResults: labels['listing.back_to_results'],
          onMyUno: labels['listing.on_myuno'],
          showAllPhotos: labels['listing.show_all_photos'],
          guestsCount: labels['listing.guests_count'],
          bedroomsCount: labels['listing.bedrooms_count'],
          minNightsCount: labels['listing.min_nights_count'],
          notChargedYet: labels['listing.not_charged_yet'],
          fewerGuests: labels['listing.fewer_guests'],
          moreGuests: labels['listing.more_guests'],
          checkIn: labels['search.bar_check_in'],
          checkOut: labels['search.bar_check_out'],
          defaultDescription: labels['listing.default_description'],
          maxGuests: labels['listing.max_guests'],
          minStay: labels['listing.min_stay'],
          nights: labels['listing.nights'],
          night: labels['listing.night'],
          bedrooms: labels['listing.bedrooms'],
          bathrooms: labels['listing.bathrooms'],
          cancellationPolicy: labels['listing.cancellation_policy'],
          cancellationDefault: labels['listing.cancellation_default'],
          perNight: labels['listing.per_night'],
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
          pickDates: labels['listing.pick_dates'],
          errorPrice: labels['listing.error_price'],
          errorBooking: labels['listing.error_booking'],
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
          },
        }}
      />
    </Suspense>
  );
}
