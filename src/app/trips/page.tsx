import { Suspense } from 'react';
import { getLabels } from '@/lib/i18n';
import TripsList from './trips-list';

export const dynamic = 'force-dynamic';

export default async function TripsPage() {
  const labels = await getLabels({
    'booking.trips.loading': 'Loading your trips...',
    'booking.trips.title': 'My Trips',
    'booking.trips.count_singular': 'booking',
    'booking.trips.count_plural': 'bookings',
    'booking.trips.empty_title': 'No trips yet. Ready for your first adventure?',
    'booking.trips.empty_action': 'Search Stays',
    'booking.trips.check_in': 'Check-in',
    'booking.trips.check_out': 'Check-out',
    'booking.trips.total': 'Total',
    'booking.trips.payment_pending': 'Payment pending',
    'booking.trips.payment_action': 'Complete Payment',
    'booking.trips.hold_expires': 'Complete payment within {time}',
    'booking.trips.hold_expired': 'Hold expired',
    'booking.trips.ready_checkin': 'Ready for check-in',
    'booking.trips.note_label': 'Guest Note:',
    'booking.trips.fetch_error': 'Failed to fetch trips',
    'booking.trips.retry': 'Try again',
    'booking.trips.status.pending_payment': 'Awaiting payment',
    'booking.trips.status.confirmed': 'Confirmed',
    'booking.trips.status.requested': 'Requested',
    'booking.trips.status.checked_in': 'Checked in',
    'booking.trips.status.checked_out': 'Checked out',
    'booking.trips.status.cancelled': 'Cancelled',
    'booking.trips.status.declined': 'Declined',
    'booking.trips.status.expired': 'Expired',
  });

  return (
    <Suspense fallback={<div className="min-h-screen bg-surface-mint p-8"><p>{labels['booking.trips.loading']}</p></div>}>
      <TripsList labels={labels} />
    </Suspense>
  );
}
