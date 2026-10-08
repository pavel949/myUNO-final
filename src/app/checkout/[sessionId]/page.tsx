import { getLabels } from '@/lib/i18n';
import CheckoutClient from './checkout-client';

export const dynamic = 'force-dynamic';

interface CheckoutPageProps {
  params: { sessionId: string };
}

export default async function CheckoutPage({ params }: CheckoutPageProps) {
  const labels = await getLabels({
    'payments.checkout.title': 'Complete payment',
    'payments.checkout.loading': 'Loading checkout…',
    'payments.checkout.not_found': 'Checkout session not found',
    'payments.checkout.mock_title': 'Test checkout',
    'payments.checkout.mock_note':
      'This is a test checkout page — no real card will be charged.',
    'payments.checkout.stay_label': 'Stay',
    'payments.checkout.service_label': 'Service',
    'payments.checkout.dates_label': 'Dates',
    'payments.checkout.amount_label': 'Amount due',
    'payments.checkout.pay_now': 'Pay now',
    'payments.checkout.success_title': 'Payment confirmed',
    'payments.checkout.reconciliation_title': 'Payment received — review required',
    'payments.checkout.reconciliation_body': 'We received your payment, but could not confirm this booking. Please contact the property team to arrange the next step. Do not pay again. A refund has not yet been confirmed.',
    'payments.checkout.success_body':
      'Your booking is confirmed. Taking you to your trip…',
    'payments.checkout.error_generic': 'Payment failed. Please try again.',
    'payments.checkout.decline_simulate': 'Simulate card declined',
    'payments.checkout.back_to_trip': 'Back to your trip',
    'payments.checkout.test_note': 'No real payment is charged in test mode.',
    'payments.checkout.provider_pending': 'This payment is handled by the external provider. Check your trip for its confirmed status; do not submit a mock payment here.',
  });

  return <CheckoutClient sessionId={params.sessionId} labels={labels} />;
}
