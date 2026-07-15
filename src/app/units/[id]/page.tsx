import { Suspense } from 'react';
import { getLabels } from '@/lib/i18n';
import UnitDetailClient from './unit-client';

export const dynamic = 'force-dynamic';

export default async function UnitDetailPage({ params }: { params: { id: string } }) {
  const labels = await getLabels({
    'listing.loading': 'Loading unit details…',
    'listing.not_found': 'Unit not found',
    'listing.back_to_results': '← Back to results',
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
  });

  return (
    <Suspense>
      <UnitDetailClient
        unitId={params.id}
        labels={{
          loading: labels['listing.loading'],
          notFound: labels['listing.not_found'],
          backToResults: labels['listing.back_to_results'],
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
        }}
      />
    </Suspense>
  );
}
