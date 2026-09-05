import { getLabels } from '@/lib/i18n';
import AdminServiceOrdersClient from './service-orders-client';

export const dynamic = 'force-dynamic';

/**
 * Cross-platform service order board (doc 08 §6, F-OPS-1 today's service orders).
 * Reads from GET /api/admin/service-orders — the admin oversight queue.
 */
export default async function AdminServiceOrdersPage() {
  const labels = await getLabels({
    'admin.service_orders.title': 'Service orders',
    'admin.service_orders.subtitle':
      'Every service order across the platform — new, in progress, and completed. Open an order for the full timeline and payment state.',
    'admin.service_orders.loading': 'Loading orders…',
    'admin.service_orders.empty': 'No orders match this filter.',
    'admin.service_orders.error': 'Could not load service orders.',
    'admin.service_orders.filter_active': 'Active',
    'admin.service_orders.filter_new': 'Awaiting provider',
    'admin.service_orders.filter_accepted': 'Accepted',
    'admin.service_orders.filter_issues': 'Declined / failed',
    'admin.service_orders.filter_done': 'Completed',
    'admin.service_orders.col_service': 'Service',
    'admin.service_orders.col_orderer': 'Orderer',
    'admin.service_orders.col_provider': 'Provider',
    'admin.service_orders.col_scheduled': 'Scheduled',
    'admin.service_orders.col_amount': 'Amount',
    'admin.service_orders.col_status': 'Status',
    'admin.service_orders.col_action': '',
    'admin.service_orders.view': 'Open →',
    'services.order_status.placed': 'New',
    'services.order_status.paid': 'Paid',
    'services.order_status.accepted': 'Accepted',
    'services.order_status.declined': 'Declined',
    'services.order_status.fulfilled': 'Fulfilled',
    'services.order_status.cancelled': 'Cancelled',
    'services.order_status.expired': 'Expired',
    'services.order_status.failed': 'Failed',
    'services.order_status.closed': 'Closed',
  });

  return (
    <div>
      <h1 className="font-display text-display-xl font-semibold text-text-ink mb-8">
        {labels['admin.service_orders.title']}
      </h1>
      <p className="text-body text-text-secondary mb-24 max-w-3xl">
        {labels['admin.service_orders.subtitle']}
      </p>
      <AdminServiceOrdersClient labels={labels} />
    </div>
  );
}
