import { Suspense } from 'react';
import { getLabels } from '@/lib/i18n';
import BookingDetailClient from './booking-client';

export const dynamic = 'force-dynamic';

export default async function BookingDetailPage({ params }: { params: { id: string } }) {
  const labels = await getLabels({
    'booking.detail.title': 'Your trip',
    'booking.detail.back': '← My trips',
    'booking.detail.loading': 'Loading your trip…',
    'booking.detail.not_found': 'Booking not found',
    'booking.detail.check_in': 'Check-in',
    'booking.detail.check_out': 'Check-out',
    'booking.detail.guests': 'Guests',
    'booking.detail.total': 'Total',
    'booking.detail.payment_title': 'Payment',
    'booking.detail.paid': 'Paid',
    'booking.detail.awaiting_payment': 'Awaiting payment',
    'booking.detail.pay_card': 'Pay by card',
    'booking.detail.pay_cash_note':
      'You can also pay in cash to our team at check-in — we will confirm your booking on the spot.',
    'booking.detail.receipt': 'Receipt',
    'booking.detail.home_space': 'Open my home space',
    'booking.detail.passports': 'Pre-arrival: add passports',
    'booking.detail.cancel_title': 'Cancel this trip',
    'booking.detail.cancel_button': 'Cancel booking',
    'booking.detail.cancel_confirm':
      'Cancel this booking? Refund by your cancellation policy: ฿{refund}.',
    'booking.detail.cancel_confirm_unpaid': 'Cancel this booking request?',
    'booking.detail.cancelled_note': 'This booking was cancelled. Refund: ฿{refund}.',
    'booking.detail.modify_title': 'Change dates',
    'booking.detail.modify_start': 'New check-in',
    'booking.detail.modify_end': 'New check-out',
    'booking.detail.modify_submit': 'Reprice & change',
    'booking.detail.modify_note':
      'We recompute the price for the new dates. A higher price opens checkout for the difference; a lower one is refunded.',
    'booking.detail.error_generic': 'Something went wrong. Please try again.',
    'booking.detail.status.pending_payment': 'Awaiting payment',
    'booking.detail.status.confirmed': 'Confirmed',
    'booking.detail.status.requested': 'Requested',
    'booking.detail.status.checked_in': 'Checked in',
    'booking.detail.status.checked_out': 'Checked out',
    'booking.detail.status.cancelled': 'Cancelled',
    'booking.detail.status.declined': 'Declined',
    'booking.detail.status.expired': 'Expired',
  });

  return (
    <Suspense>
      <BookingDetailClient bookingId={params.id} labels={labels} />
    </Suspense>
  );
}
