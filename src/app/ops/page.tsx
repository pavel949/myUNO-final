import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getLabels } from '@/lib/i18n';
import { getOpsBoard } from '@/modules/ops';
import OpsBoardClient from './ops-client';

export const dynamic = 'force-dynamic';

export default async function OpsBoardPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?next=/ops');
  }
  const isStaff = user.roles.some((role) => role.role === 'staff_ops');
  if (!isStaff && !user.isAdmin) {
    redirect('/');
  }

  const { arrivals, departures, pendingPayment, pendingServiceOrders, slaMetrics } = await getOpsBoard(prisma);

  const labels = await getLabels({
    'staff.ops.title': 'Ops board',
    'staff.ops.tm30_link': 'TM30 queue →',
    'staff.ops.arrivals': "Today's arrivals",
    'staff.ops.departures': "Today's departures",
    'staff.ops.pending_cash': 'Awaiting payment (record cash)',
    'staff.ops.empty': 'Nothing here right now.',
    'staff.ops.guest': 'Guest',
    'staff.ops.unit': 'Unit',
    'staff.ops.dates': 'Dates',
    'staff.ops.total': 'Total',
    'staff.ops.paid': 'Paid',
    'staff.ops.unpaid': 'Unpaid',
    'staff.ops.verified': 'Passports OK',
    'staff.ops.not_verified': 'Passports missing',
    'staff.ops.check_in': 'Check in',
    'staff.ops.check_out': 'Check out',
    'staff.ops.record_cash': 'Record cash',
    'staff.ops.receipt_placeholder': 'Receipt / чек №',
    'staff.ops.confirm_cash': 'Confirm ฿{amount} received',
    'staff.ops.error_generic': 'Action failed. Please try again.',
    'staff.ops.service_pending_cash': 'Service orders awaiting cash',
    'staff.ops.sla_title': 'SLA health (last 7 days)',
    'staff.ops.tm30_on_time': 'TM30 on-time %',
    'staff.ops.tickets_past_sla': 'Tickets past SLA',
  });

  const serialize = (list: typeof arrivals) =>
    list.map((b) => ({
      id: b.id,
      status: b.status,
      startDate: b.startDate.toISOString(),
      endDate: b.endDate.toISOString(),
      totalThb: b.totalThb,
      party: b.adults + b.children,
      verificationStatus: b.verificationStatus,
      unitName: b.unit?.name || '—',
      guestName: b.guestIdentity
        ? `${b.guestIdentity.firstName} ${b.guestIdentity.lastName}`
        : '—',
      paid: b.payments.length > 0,
    }));

  return (
    <main className="min-h-screen bg-surface-background p-24 md:p-32">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-24">
          <h1 className="text-heading-1 font-bold text-text-ink">
            {labels['staff.ops.title']}
          </h1>
          <Link
            href="/ops/tm30"
            className="text-brand-andaman font-semibold hover:underline"
          >
            {labels['staff.ops.tm30_link']}
          </Link>
        </div>

        {/* SLA health tiles */}
        <div className="mb-24">
          <h2 className="text-heading-3 font-semibold text-text-ink mb-16">
            {labels['staff.ops.sla_title']}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
            <div className="bg-surface-paper border border-border-line rounded-lg p-24">
              <p className="text-small text-text-secondary mb-8">{labels['staff.ops.tm30_on_time']}</p>
              <p className="text-heading-2 font-semibold text-text-ink">{slaMetrics.tm30OnTimeRate7d}%</p>
            </div>
            <div className="bg-surface-paper border border-border-line rounded-lg p-24">
              <p className="text-small text-text-secondary mb-8">{labels['staff.ops.tickets_past_sla']}</p>
              <p className="text-heading-2 font-semibold text-text-ink">{slaMetrics.ticketsWithOpenSLA}</p>
            </div>
          </div>
        </div>

        <OpsBoardClient
          arrivals={serialize(arrivals)}
          departures={serialize(departures)}
          pendingPayment={serialize(pendingPayment)}
          pendingServiceOrders={pendingServiceOrders.map((o) => ({
            id: o.id,
            scheduledStart: o.scheduled_start.toISOString(),
            totalThb: o.total_thb,
            serviceTitle: o.service?.title || '—',
            ordererName: o.orderer
              ? `${o.orderer.firstName} ${o.orderer.lastName}`
              : '—',
          }))}
          labels={labels}
        />
      </div>
    </main>
  );
}
