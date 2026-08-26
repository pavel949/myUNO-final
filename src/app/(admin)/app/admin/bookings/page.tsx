import { getLabels } from '@/lib/i18n';
import BookingsAdminClient from './bookings-client';

export const dynamic = 'force-dynamic';

export default async function AdminBookingsPage() {
  const labels = await getLabels({
    'admin.bookings.title': 'Bookings',
    'admin.bookings.empty': 'No bookings yet.',
    'admin.bookings.paid': 'Paid',
    'admin.bookings.record_cash': 'Record cash',
    'admin.bookings.receipt_placeholder': 'Receipt / чек №',
    'admin.bookings.cancel': 'Cancel',
    'admin.bookings.approve': 'Approve request',
    'admin.bookings.decline': 'Decline request',
    'admin.bookings.cancel_confirm': 'Cancel this booking (policy refund applies)?',
    'admin.bookings.error_generic': 'Action failed. Please try again.',
    'admin.bookings.guest_link': 'Guest link',
    'admin.bookings.guest_link_hint': 'Copy and send this activation link to the guest:',
    'admin.bookings.channel_all': 'All channels',
    'admin.bookings.guest_note': 'Guest note',
    'admin.bookings.internal_note': 'Internal note',
    'admin.bookings.internal_note_save': 'Save note',
    'admin.bookings.loading': 'Loading...',
    'admin.bookings.showing': 'Showing bookings...',
    'admin.bookings.load_more': 'Load more',
  });

  return (
    <div>
      <h1 className="text-heading-1 font-bold text-text-ink mb-24">
        {labels['admin.bookings.title']}
      </h1>
      <BookingsAdminClient labels={labels} />
    </div>
  );
}
