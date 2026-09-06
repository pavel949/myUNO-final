import { getLabels, getRequestLocale } from '@/lib/i18n';
import { getBookingDeclineReasonOptions } from '@/modules/booking';
import BookingsAdminClient from './bookings-client';

export const dynamic = 'force-dynamic';

export default async function AdminBookingsPage() {
  const [labels, declineReasons] = await Promise.all([
    getLabels({
    'admin.bookings.title': 'Bookings',
    'admin.bookings.empty': 'No bookings yet.',
    'admin.bookings.filtered_empty': 'No bookings match this filter.',
    'admin.bookings.paid': 'Paid',
    'admin.bookings.record_cash': 'Record cash',
    'admin.bookings.record_transfer': 'Record transfer',
    'admin.bookings.bank_ref_placeholder': 'Bank ref №',
    'admin.bookings.receipt_placeholder': 'Receipt / чек №',
    'admin.bookings.cancel': 'Cancel',
    'admin.bookings.approve': 'Approve request',
    'admin.bookings.decline': 'Decline request',
    'admin.bookings.decline_reason': 'Decline reason',
    'admin.bookings.decline_reason_required': 'Select a decline reason.',
    'admin.bookings.confirm_decline': 'Decline this booking request? The guest will be notified.',
    'admin.bookings.cancel_confirm': 'Cancel this booking (policy refund applies)?',
    'admin.bookings.error_generic': 'Action failed. Please try again.',
    'admin.bookings.sheet_close': 'Close',
    'admin.bookings.sheet_amount_due': 'Amount due',
    'admin.bookings.cash_sheet_title': 'Record cash · {name}',
    'admin.bookings.cash_sheet_hint': 'From the paper receipt book at the desk.',
    'admin.bookings.cash_sheet_counted': 'I have counted {amount} and it is in the safe.',
    'admin.bookings.cash_sheet_submit': 'Record {amount} cash',
    'admin.bookings.cash_sheet_required_hint': 'Both the reference and the count are required.',
    'admin.bookings.transfer_sheet_title': 'Record transfer · {name}',
    'admin.bookings.transfer_sheet_hint': 'The reference from the bank transfer or slip.',
    'admin.bookings.transfer_sheet_submit': 'Record {amount} transfer',
    'admin.bookings.transfer_sheet_required_hint': 'A bank reference is required.',
    'admin.bookings.guest_link': 'Guest link',
    'admin.bookings.guest_link_hint': 'Copy and send this activation link to the guest:',
    'admin.bookings.channel_all': 'All channels',
    'admin.bookings.guest_note': 'Guest note',
    'admin.bookings.internal_note': 'Internal note',
    'admin.bookings.internal_note_save': 'Save note',
    'admin.bookings.loading': 'Loading...',
    'admin.bookings.showing': 'Showing bookings...',
    'admin.bookings.load_more': 'Load more',
    }),
    getBookingDeclineReasonOptions(getRequestLocale()),
  ]);

  return (
    <div>
      <h1 className="text-heading-1 font-bold text-text-ink mb-24">
        {labels['admin.bookings.title']}
      </h1>
      <BookingsAdminClient labels={labels} declineReasons={declineReasons} />
    </div>
  );
}
