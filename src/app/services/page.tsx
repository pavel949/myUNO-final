import { Suspense } from 'react';
import { getLabels } from '@/lib/i18n';
import ServicesClient from './services-client';

export const dynamic = 'force-dynamic';

export default async function ServicesPage() {
  const labels = await getLabels({
    'services.browse.title': 'Services',
    'services.browse.subtitle':
      'Cleaning, repairs, deliveries — every provider vetted, every order on the record.',
    'services.browse.empty': 'No services available yet — check back soon.',
    'services.browse.vetted': 'Vetted',
    'services.browse.from': 'from',
    'services.browse.order': 'Order',
    'services.browse.when': 'When',
    'services.browse.quantity': 'Quantity',
    'services.browse.note': 'Note to provider (optional)',
    'services.browse.confirm_order': 'Place order — ฿{total}',
    'services.browse.login_needed': 'Log in to place an order.',
    'services.browse.ordered': 'Order placed. The provider will confirm shortly.',
    'services.browse.error_generic': 'Could not place the order. Please try again.',
    'services.my_orders.title': 'My orders',
    'services.my_orders.empty': 'No orders yet.',
    'services.order.pay': 'Pay',
    'services.order.cancel': 'Cancel',
    'services.order.cancel_confirm':
      'Cancel this order? Cancelling early enough before the visit refunds in full; inside the cancellation window there is no refund.',
    'services.order.cancelled_note': 'Order cancelled. Any refund due is on its way.',
    'services.order_status.placed': 'Awaiting provider',
    'services.order_status.paid': 'Paid',
    'services.order_status.expired': 'Expired',
    'services.order_status.failed': 'Failed',
    'services.order_status.accepted': 'Accepted',
    'services.order_status.declined': 'Declined',
    'services.order_status.fulfilled': 'Fulfilled',
    'services.order_status.cancelled': 'Cancelled',
    'services.order_status.closed': 'Closed',
  });

  return (
    <Suspense>
      <ServicesClient labels={labels} />
    </Suspense>
  );
}
