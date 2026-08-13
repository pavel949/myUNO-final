import { getLabels } from '@/lib/i18n';
import GuestAccessClient from './access-client';

export const dynamic = 'force-dynamic';

export default async function GuestAccessPage() {
  const labels = await getLabels({
    'guests.access.title': 'Open your stay',
    'guests.access.subtitle':
      'Enter your booking reference and the email you booked with — we will send you a personal link.',
    'guests.access.booking_ref': 'Booking reference',
    'guests.access.booking_ref_hint': 'It is in your confirmation message.',
    'guests.access.email': 'Email',
    'guests.access.submit': 'Send me the link',
    'guests.access.submitting': 'Sending…',
    'guests.access.sent':
      'If the details match a booking, the link is on its way to your inbox.',
    'guests.access.error_generic': 'Something went wrong. Please try again.',
  });

  return (
    <GuestAccessClient
      labels={{
        title: labels['guests.access.title'],
        subtitle: labels['guests.access.subtitle'],
        bookingRef: labels['guests.access.booking_ref'],
        bookingRefHint: labels['guests.access.booking_ref_hint'],
        email: labels['guests.access.email'],
        submit: labels['guests.access.submit'],
        submitting: labels['guests.access.submitting'],
        sent: labels['guests.access.sent'],
        errorGeneric: labels['guests.access.error_generic'],
      }}
    />
  );
}
