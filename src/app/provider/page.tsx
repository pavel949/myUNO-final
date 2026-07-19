import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import {
  getProviderForIdentity,
  getServiceOrdersByProvider,
} from '@/modules/services';
import { getConfig } from '@/modules/config';
import { getLabels } from '@/lib/i18n';
import { serializeOrder } from '@/app/libs/serviceOrderSerializer';
import ProviderOrdersClient from './provider-orders-client';

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
      [`provider.status.${application.status}`]: application.status,
    });
    return (
      <div className="bg-surface-paper border border-border-line rounded-lg p-24">
        <h2 className="text-heading-3 font-bold text-text-ink mb-8">
          {statusLabels['provider.application.title']}
        </h2>
        <p className="text-body font-semibold text-brand-andaman mb-8">
          {application.name} — {statusLabels[`provider.status.${application.status}`]}
        </p>
        <p className="text-body text-text-secondary">
          {statusLabels['provider.application.note']}
        </p>
      </div>
    );
  }

  const [orders, slaHours, labels] = await Promise.all([
    getServiceOrdersByProvider(prisma, memberProviderId),
    getConfig(prisma, 'service.accept_sla_hours'),
    getLabels({
      'provider.orders.title': 'Order queue',
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
    }),
  ]);

  const hours = (slaHours as number) ?? 12;
  const queue = orders.map((order) => ({
    ...serializeOrder(order),
    scheduledStart: order.scheduled_start.toISOString(),
    scheduledEnd: order.scheduled_end ? order.scheduled_end.toISOString() : null,
    createdAt: order.createdAt.toISOString(),
    noteToProvider: order.note_to_provider ?? null,
    acceptDeadline:
      order.status === 'placed' || order.status === 'paid'
        ? new Date(order.createdAt.getTime() + hours * 60 * 60 * 1000).toISOString()
        : null,
  }));

  return <ProviderOrdersClient orders={queue} labels={labels} />;
}
