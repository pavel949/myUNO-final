import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { Breadcrumb } from '@/components/Breadcrumb';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getLabels } from '@/lib/i18n';
import PayOrderButton from './pay-order-button';
import OrderDisputePanel from './order-dispute-panel';
import OrderNoShowPanel from './order-no-show-panel';
import { buildOrderTimeline } from './order-timeline';
import { baht, formatBreakdownValue } from './order-money';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

interface ServiceOrderDetail {
  id: string;
  createdAt: string;
  scheduledStart: string;
  scheduledEnd: string;
  status: string;
  quantity: number;
  totalThb: number;
  takeRatePctSnapshot: number;
  priceBreakdown: Record<string, any>;
  refundAccruedThb: number;
  noteToProvider: string | null;
  addressNote: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  service: {
    id: string;
    title: string;
    description: string | null;
    categoryKey: string;
    priceModel: string;
    basePriceThb: number | null;
  };
  provider: {
    id: string;
    name: string;
    description: string | null;
    phone: string | null;
    email: string | null;
    vetted: boolean;
  };
  project: {
    id: string;
    name: string;
  };
  unit: { id: string; name: string; addressSupplement: string | null } | null;
  orderer: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
  };
  payments: Array<{
    id: string;
    type: string;
    amountThb: number;
    status: string;
    createdAt: string;
    receiptNumber: string | null;
  }>;
}

export default async function ServiceOrderDetailPage({
  params,
  searchParams,
}: {
  params: { orderId: string };
  searchParams: { paid?: string; placed?: string };
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  const { orderId } = params;

  let order: ServiceOrderDetail | null = null;
  try {
    // Forward the caller's cookies — the detail API authenticates with them;
    // a bare server-side fetch would always 401 and soft-404 this page.
    const res = await fetch(`/api/service-orders/${orderId}/detail`, {
      cache: 'no-store',
      headers: { cookie: cookies().toString() },
    });
    if (res.ok) {
      order = await res.json();
    } else if (res.status === 403) {
      notFound();
    }
  } catch {
    // Order fetch failed
  }

  if (!order) {
    notFound();
  }

  const labels = await getLabels({
    'service-order.breadcrumb_home': 'Home',
    'service-order.breadcrumb_services': 'Services',
    'service-order.breadcrumb_orders': 'Orders',
    'service-order.breadcrumb_detail': 'Order Details',
    'service-order.detail.title': 'Service Order',
    'service-order.detail.order_id': 'Order ID',
    'service-order.detail.status': 'Status',
    'service-order.detail.placed': 'Placed',
    'service-order.detail.accepted': 'Accepted',
    'service-order.detail.declined': 'Declined',
    'service-order.detail.fulfilled': 'Completed',
    'service-order.detail.cancelled': 'Cancelled',
    'service-order.detail.scheduled': 'Scheduled',
    'service-order.detail.scheduled_start': 'Start date & time',
    'service-order.detail.scheduled_end': 'End date & time',
    'service-order.detail.quantity': 'Quantity',
    'service-order.detail.pricing': 'Pricing',
    'service-order.detail.total_price': 'Total price',
    'service-order.detail.payment_status': 'Payment status',
    'service-order.detail.paid': 'Paid',
    'service-order.detail.unpaid': 'Unpaid',
    'service-order.detail.provider_info': 'Service Provider',
    'service-order.detail.contact_provider': 'Contact Provider',
    'service-order.detail.location': 'Location',
    'service-order.detail.notes': 'Notes',
    'service-order.detail.note_to_provider': 'Note to Provider',
    'service-order.detail.address_note': 'Special Location Note',
    'service-order.detail.cancellation_reason': 'Cancellation Reason',
    'service-order.detail.cancel_order': 'Cancel Order',
    'service-order.detail.confirm_cancellation': 'Confirm Cancellation',
    'service-order.detail.confirmed_paid': 'Payment received — your order is confirmed. The provider will be in touch.',
    'service-order.detail.confirmed_cash': 'Order placed — pay in cash when the service is delivered. Our staff will record the receipt.',
    'services.detail.back': 'Back to services',
    'service-order.detail.phone_label': 'Phone',
    'service-order.detail.email_label': 'Email',
    'service-order.detail.vetted_badge': 'Vetted',
    'service-order.detail.receipt_label': 'Receipt',
    'service-order.detail.refund_accrued': 'Refund accrued',
    'services.order.pay': 'Pay',
    'services.wizard.error_generic': 'Could not place the order. Please try again.',
    'service-order.detail.dispute_title': 'Dispute this order',
    'service-order.detail.dispute_open': 'Raise a dispute',
    'service-order.detail.dispute_title_field': 'Subject',
    'service-order.detail.dispute_description_field': 'What went wrong',
    'service-order.detail.dispute_submit': 'Submit dispute',
    'service-order.detail.dispute_cancel': 'Cancel',
    'service-order.detail.dispute_sent':
      'Your dispute has been sent to our team — you can follow its status from the ticket it opened.',
    'service-order.detail.dispute_error': 'That did not work. Please try again.',
    'service-order.detail.dispute_view_ticket': 'View the ticket',
    'service-order.detail.failed': 'Failed',
    'service-order.detail.no_show_title': 'Provider did not show up',
    'service-order.detail.no_show_hint':
      'If the provider accepted but did not arrive for the scheduled time, report a no-show. We will refund you per our policy and open a ticket for our team.',
    'service-order.detail.no_show_open': 'Report provider no-show',
    'service-order.detail.no_show_note_label': 'What happened (optional)',
    'service-order.detail.no_show_note_placeholder': 'e.g. Waited 30 minutes, no call or arrival…',
    'service-order.detail.no_show_submit': 'Submit report',
    'service-order.detail.no_show_cancel': 'Cancel',
    'service-order.detail.no_show_confirm':
      'Report this as a provider no-show? A refund will be issued and our team will follow up.',
    'service-order.detail.no_show_error': 'Could not submit the report. Please try again.',
    'service-order.detail.no_show_done':
      'No-show reported. Any refund due is being processed — our team has opened a ticket.',
  });

  // SA-2 confirmation rail: arriving from checkout (?paid=1) or the
  // cash-on-fulfilment choice (?placed=cash) shows the confirmation banner.
  const confirmationNote =
    searchParams.paid === '1'
      ? labels['service-order.detail.confirmed_paid']
      : searchParams.placed === 'cash'
        ? labels['service-order.detail.confirmed_cash']
        : null;

  const statusLabel: Record<string, string> = {
    placed: labels['service-order.detail.placed'],
    accepted: labels['service-order.detail.accepted'],
    declined: labels['service-order.detail.declined'],
    fulfilled: labels['service-order.detail.fulfilled'],
    cancelled: labels['service-order.detail.cancelled'],
    failed: labels['service-order.detail.failed'],
  };

  const timeline = buildOrderTimeline(order.status);
  const timelineLabel: Record<string, string> = {
    placed: labels['service-order.detail.placed'],
    paid: labels['service-order.detail.paid'],
    accepted: labels['service-order.detail.accepted'],
    fulfilled: labels['service-order.detail.fulfilled'],
  };

  // `order.totalThb` itself stays satang for the isPaymentRequired check
  // below (a sign check, not a display) — baht/formatBreakdownValue (from
  // ./order-money) convert only at render, see that module's doc comment.
  const isPaymentRequired =
    order.status === 'placed' && order.totalThb > 0;
  const isPaid =
    order.payments.some((p) => p.status === 'completed') ||
    order.status === 'fulfilled';

  const isOrderer = order.orderer.id === user.identityId;
  const slotStarted = new Date() >= new Date(order.scheduledStart);
  const canReportNoShow = isOrderer && order.status === 'accepted' && slotStarted;
  const disputableStatuses = ['accepted', 'fulfilled', 'closed', 'failed'];
  const canDispute =
    isOrderer && disputableStatuses.includes(order.status);

  const existingDispute =
    canDispute
      ? await prisma.dispute.findFirst({
          where: { subjectType: 'service_order', subjectId: order.id },
          select: { id: true, ticketId: true },
        })
      : null;

  const breadcrumbs = [
    { label: labels['service-order.breadcrumb_home'], href: '/' },
    { label: labels['service-order.breadcrumb_services'], href: '/services' },
    { label: labels['service-order.breadcrumb_orders'], href: '/services/orders' },
    { label: labels['service-order.breadcrumb_detail'], current: true },
  ];

  return (
    <main className="min-h-screen bg-surface-background">
      <Breadcrumb items={breadcrumbs} />
      <div className="p-24 md:p-32">
      <div className="max-w-3xl mx-auto">
        {confirmationNote && (
          <div className="bg-state-success-soft border border-state-success rounded-lg p-16 mb-24">
            <p className="text-body text-state-success">{confirmationNote}</p>
          </div>
        )}
        {/* Header */}
        <div className="mb-24">
          <h1 className="text-heading-1 font-bold text-text-ink mb-8">
            {labels['service-order.detail.title']}
          </h1>
          <div className="flex items-center gap-16 mb-16">
            <div>
              <p className="text-small text-text-secondary mb-4">
                {labels['service-order.detail.order_id']}
              </p>
              <p className="font-mono text-body text-text-ink">{order.id}</p>
            </div>
            <div>
              <p className="text-small text-text-secondary mb-4">
                {labels['service-order.detail.status']}
              </p>
              <div className="flex items-center gap-8">
                <span
                  className={`px-12 py-6 rounded-full text-small font-semibold ${
                    order.status === 'fulfilled'
                      ? 'bg-status-good bg-opacity-10 text-status-good'
                      : order.status === 'cancelled'
                        ? 'bg-status-serious bg-opacity-10 text-status-serious'
                        : order.status === 'declined'
                          ? 'bg-status-warning bg-opacity-10 text-status-warning'
                          : 'bg-brand-light bg-opacity-10 text-brand-deep'
                  }`}
                >
                  {statusLabel[order.status] || order.status}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* SA-4: status journey — placed → paid → accepted → fulfilled */}
        <div className="bg-surface-paper border border-border-line rounded-lg p-24 mb-24">
          <ol className="flex flex-wrap items-center gap-8">
            {timeline.steps.map((step, i) => (
              <li key={step.key} className="flex items-center gap-8">
                {i > 0 && <span className="w-16 h-px bg-border-line" aria-hidden="true" />}
                <span
                  className={`inline-flex items-center gap-6 px-12 py-6 rounded-full text-small font-medium ${
                    step.current
                      ? 'bg-brand-andaman text-surface-ivory'
                      : step.done
                        ? 'bg-state-success-soft text-state-success'
                        : 'bg-surface-ivory text-text-secondary'
                  }`}
                >
                  {step.done ? '✓ ' : ''}
                  {timelineLabel[step.key]}
                </span>
              </li>
            ))}
          </ol>
          {timeline.terminal && (
            <p className="text-small text-text-secondary mt-12">
              {statusLabel[timeline.terminal] || timeline.terminal}
              {order.cancellationReason ? ` — ${order.cancellationReason}` : ''}
            </p>
          )}
        </div>

        {/* Service Details */}
        <div className="bg-surface-paper border border-border-line rounded-lg p-24 mb-24">
          <h2 className="text-heading-2 font-semibold text-text-ink mb-16">
            {order.service.title}
          </h2>
          {order.service.description && (
            <p className="text-body text-text-secondary mb-16">
              {order.service.description}
            </p>
          )}
        </div>

        {/* Scheduling */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-24 mb-24">
          <div className="bg-surface-paper border border-border-line rounded-lg p-24">
            <p className="text-small text-text-secondary mb-8">
              {labels['service-order.detail.scheduled_start']}
            </p>
            <p className="text-body font-semibold text-text-ink">
              {new Date(order.scheduledStart).toLocaleString()}
            </p>
          </div>
          <div className="bg-surface-paper border border-border-line rounded-lg p-24">
            <p className="text-small text-text-secondary mb-8">
              {labels['service-order.detail.scheduled_end']}
            </p>
            <p className="text-body font-semibold text-text-ink">
              {new Date(order.scheduledEnd).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Pricing */}
        <div className="bg-surface-paper border border-border-line rounded-lg p-24 mb-24">
          <p className="text-small text-text-secondary mb-8">
            {labels['service-order.detail.pricing']}
          </p>
          <p className="text-heading-2 font-semibold text-text-ink mb-16">
            ฿{baht(order.totalThb)}
          </p>
          {order.priceBreakdown && Object.keys(order.priceBreakdown).length > 0 && (
            <div className="space-y-8 text-small text-text-secondary">
              {Object.entries(order.priceBreakdown).map(([key, value]) => (
                <div key={key} className="flex justify-between">
                  <span className="capitalize">{key.replace(/_/g, ' ')}</span>
                  <span>{formatBreakdownValue(key, value)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Payment Status */}
        <div className="bg-surface-paper border border-border-line rounded-lg p-24 mb-24">
          <p className="text-small text-text-secondary mb-8">
            {labels['service-order.detail.payment_status']}
          </p>
          <div className="flex items-center gap-12 mb-16">
            <span
              className={`px-12 py-6 rounded-full text-small font-semibold ${
                isPaid
                  ? 'bg-status-good bg-opacity-10 text-status-good'
                  : 'bg-status-warning bg-opacity-10 text-status-warning'
              }`}
            >
              {isPaid
                ? labels['service-order.detail.paid']
                : labels['service-order.detail.unpaid']}
            </span>
          </div>
          {order.payments.length > 0 && (
            <div className="space-y-12">
              {order.payments.map((payment) => (
                <div
                  key={payment.id}
                  className="p-12 border border-border-line rounded bg-surface-background"
                >
                  <div className="flex justify-between items-start mb-8">
                    <div>
                      <p className="text-small text-text-secondary">
                        {payment.type.replace(/_/g, ' ')}
                      </p>
                      <p className="text-body font-semibold text-text-ink">
                        ฿{baht(payment.amountThb)}
                      </p>
                    </div>
                    <span className="text-small text-text-secondary">
                      {new Date(payment.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  {payment.receiptNumber && (
                    <p className="text-small text-text-secondary">
                      {labels['service-order.detail.receipt_label']}: {payment.receiptNumber}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Provider Contact */}
        <div className="bg-surface-paper border border-border-line rounded-lg p-24 mb-24">
          <h2 className="text-heading-2 font-semibold text-text-ink mb-16">
            {labels['service-order.detail.provider_info']}
          </h2>
          <div className="mb-16">
            <p className="text-body font-semibold text-text-ink mb-4">
              {order.provider.name}
            </p>
            {order.provider.vetted && (
              <span className="inline-flex items-center gap-4 px-8 py-4 bg-status-good bg-opacity-10 text-status-good rounded-full text-small font-semibold">
                {labels['service-order.detail.vetted_badge']}
              </span>
            )}
          </div>
          {order.provider.description && (
            <p className="text-body text-text-secondary mb-16">
              {order.provider.description}
            </p>
          )}
          <div className="space-y-12">
            {order.provider.phone && (
              <div>
                <p className="text-small text-text-secondary mb-4">{labels['service-order.detail.phone_label']}</p>
                <a
                  href={`tel:${order.provider.phone}`}
                  className="text-body text-brand-deep hover:underline"
                >
                  {order.provider.phone}
                </a>
              </div>
            )}
            {order.provider.email && (
              <div>
                <p className="text-small text-text-secondary mb-4">{labels['service-order.detail.email_label']}</p>
                <a
                  href={`mailto:${order.provider.email}`}
                  className="text-body text-brand-deep hover:underline"
                >
                  {order.provider.email}
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Location */}
        {order.unit && (
          <div className="bg-surface-paper border border-border-line rounded-lg p-24 mb-24">
            <p className="text-small text-text-secondary mb-8">
              {labels['service-order.detail.location']}
            </p>
            <div>
              <p className="text-body text-text-ink mb-4">{order.unit.name}</p>
              {order.unit.addressSupplement && (
                <p className="text-small text-text-secondary">{order.unit.addressSupplement}</p>
              )}
            </div>
          </div>
        )}

        {/* Notes */}
        {(order.noteToProvider || order.addressNote) && (
          <div className="bg-surface-paper border border-border-line rounded-lg p-24 mb-24">
            <h2 className="text-heading-2 font-semibold text-text-ink mb-16">
              {labels['service-order.detail.notes']}
            </h2>
            {order.noteToProvider && (
              <div className="mb-16">
                <p className="text-small text-text-secondary mb-4">
                  {labels['service-order.detail.note_to_provider']}
                </p>
                <p className="text-body text-text-secondary">
                  {order.noteToProvider}
                </p>
              </div>
            )}
            {order.addressNote && (
              <div>
                <p className="text-small text-text-secondary mb-4">
                  {labels['service-order.detail.address_note']}
                </p>
                <p className="text-body text-text-secondary">
                  {order.addressNote}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Cancellation Info */}
        {order.status === 'cancelled' && (
          <div className="bg-status-serious bg-opacity-10 border border-status-serious rounded-lg p-24 mb-24">
            <h3 className="text-heading-3 font-semibold text-status-serious mb-12">
              {labels['service-order.detail.cancelled']}
            </h3>
            {order.cancellationReason && (
              <p className="text-body text-status-serious">
                {labels['service-order.detail.cancellation_reason']}:{' '}
                {order.cancellationReason}
              </p>
            )}
            {order.refundAccruedThb > 0 && (
              <p className="text-body text-status-serious mt-8">
                {labels['service-order.detail.refund_accrued']}: ฿{baht(order.refundAccruedThb)}
              </p>
            )}
          </div>
        )}

        {canReportNoShow && <OrderNoShowPanel orderId={order.id} labels={labels} />}

        {order.status === 'failed' && isOrderer && (
          <div className="bg-state-warning-soft border border-state-warning rounded-lg p-24 mb-24">
            <p className="text-body text-state-warning">{labels['service-order.detail.no_show_done']}</p>
            {order.refundAccruedThb > 0 && (
              <p className="text-small text-text-secondary mt-8">
                {labels['service-order.detail.refund_accrued']}: ฿{baht(order.refundAccruedThb)}
              </p>
            )}
          </div>
        )}

        {canDispute && !existingDispute && (
          <OrderDisputePanel orderId={order.id} labels={labels} />
        )}

        {existingDispute && (
          <div className="bg-surface-paper border border-border-line rounded-lg p-24 mb-24">
            <h2 className="text-heading-3 font-bold text-text-ink mb-8">
              {labels['service-order.detail.dispute_title']}
            </h2>
            <p className="text-body text-text-secondary mb-12">
              {labels['service-order.detail.dispute_sent']}
            </p>
            <Link
              href={`/tickets/${existingDispute.ticketId}`}
              className="text-body text-brand-andaman font-semibold hover:underline"
            >
              {labels['service-order.detail.dispute_view_ticket']}
            </Link>
          </div>
        )}

        {/* Actions */}
        <div className="mt-32 flex items-start gap-12">
          <Link
            href="/services"
            className="px-24 py-12 border border-border-line rounded-lg text-body font-semibold text-text-ink hover:bg-surface-paper transition-colors"
          >
            ← {labels['services.detail.back']}
          </Link>
          {isPaymentRequired && (
            <PayOrderButton
              orderId={order.id}
              label={labels['services.order.pay']}
              errorLabel={labels['services.wizard.error_generic']}
            />
          )}
        </div>
      </div>
      </div>
    </main>
  );
}
