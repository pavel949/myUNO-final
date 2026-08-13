import { Suspense } from 'react';
import { getLabels } from '@/lib/i18n';
import { prisma } from '@/lib/prisma';
import { getConfig } from '@/modules/config';
import ServicesClient from './services-client';

export const dynamic = 'force-dynamic';

interface CatalogCategory {
  key: string;
  icon?: string;
}

export default async function ServicesPage() {
  // The super-app facade (SA-1): category tiles come from the catalog —
  // config-not-code, so a new category appears without a deploy.
  let catalog: CatalogCategory[] = [];
  try {
    const raw = await getConfig(prisma, 'catalog.service_categories');
    if (Array.isArray(raw)) {
      catalog = (raw as CatalogCategory[]).filter((c) => typeof c?.key === 'string');
    }
  } catch {
    catalog = [];
  }

  const categoryLabelKeys = Object.fromEntries(
    catalog.map((c) => [
      `services.category.${c.key}`,
      c.key.replace(/_/g, ' ').replace(/^./, (ch) => ch.toUpperCase()),
    ])
  );

  const labels = await getLabels({
    'services.browse.title': 'Services',
    'services.browse.subtitle':
      'Cleaning, repairs, deliveries — every provider vetted, every order on the record.',
    'services.browse.categories_title': 'What do you need?',
    'services.browse.show_all': 'Show all services',
    'services.browse.category_empty': 'Nothing in this category yet — try another one.',
    'services.browse.stay_banner': 'Ordering for your stay at {unit}, {project}',
    'services.browse.stay_banner_link': 'Back to your home space',
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
    ...categoryLabelKeys,
  });

  const allLabels = labels as Record<string, string>;
  const categories = catalog.map((c) => ({
    key: c.key,
    icon: c.icon || '',
    label: allLabels[`services.category.${c.key}`] ?? c.key,
  }));

  return (
    <Suspense>
      <ServicesClient labels={labels} categories={categories} />
    </Suspense>
  );
}
