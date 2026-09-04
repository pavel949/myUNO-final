import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getProviderForIdentity } from '@/modules/services';
import { getLabels } from '@/lib/i18n';
import { prisma } from '@/lib/prisma';
import ProviderOrdersClient from './provider-orders-client';
import ProviderApplicationStatus from './provider-application-status';

export const dynamic = 'force-dynamic';

/**
 * S13 provider landing: members get the order queue; applicants see their
 * vetting status; identities with neither are sent to the application form.
 */
export default async function ProviderPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?next=/provider');
  }

  const memberProviderId = user.roles.find(
    (r) => r.role === 'provider_member' && r.providerId
  )?.providerId;

  if (!memberProviderId) {
    const application = await getProviderForIdentity(prisma, user.identityId);
    if (!application) {
      redirect('/provider/apply');
    }
    const statusLabels: Record<string, string> = await getLabels({
      'provider.application.title': 'Your application',
      'provider.application.note':
        'We review every provider before their services go live. You will be notified as soon as there is a decision.',
      'provider.application.loading': 'Loading your application…',
      'provider.application.error': 'Could not load your application status.',
      [`provider.status.${application.status}`]: application.status,
    });
    return <ProviderApplicationStatus labels={statusLabels} />;
  }

  const labels = await getLabels({
      'provider.orders.title': 'Order queue',
      'provider.orders.loading': 'Loading your orders…',
      'provider.orders.empty': 'No orders yet — they will appear here the moment a customer books you.',
      'provider.orders.accept': 'Accept',
      'provider.orders.decline': 'Decline',
      'provider.orders.fulfil': 'Mark fulfilled',
      'provider.orders.decline_reason': 'Reason (optional)',
      'provider.orders.sla_left': 'Respond within {time}',
      'provider.orders.sla_overdue': 'Response overdue',
      'provider.orders.note': 'Customer note',
      'provider.orders.error_generic': 'Something went wrong. Please try again.',
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

  return <ProviderOrdersClient labels={labels} />;
}
