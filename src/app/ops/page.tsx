import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getLabels } from '@/lib/i18n';
import OpsBoardClient from './ops-client';

export const dynamic = 'force-dynamic';

function dayRange(date: Date): { from: Date; to: Date } {
  const from = new Date(date);
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + 1);
  return { from, to };
}

export default async function OpsBoardPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?next=/ops');
  }
  const isStaff = user.roles.some((role) => role.role === 'staff_ops');
  if (!isStaff && !user.isAdmin) {
    redirect('/');
  }

  const { from, to } = dayRange(new Date());

  const bookingSelect = {
    id: true,
    status: true,
    startDate: true,
    endDate: true,
    totalThb: true,
    adults: true,
    children: true,
    verificationStatus: true,
    unit: { select: { name: true } },
    guestIdentity: { select: { firstName: true, lastName: true } },
    payments: {
      where: { status: 'succeeded' as const, purpose: 'stay' as const },
      select: { id: true },
    },
  };

  const [arrivals, departures, pendingPayment, pendingServiceOrders] = await Promise.all([
    prisma.booking.findMany({
      where: {
        startDate: { gte: from, lt: to },
        status: { in: ['confirmed', 'pending_payment'] },
      },
      select: bookingSelect,
      orderBy: { startDate: 'asc' },
    }),
    prisma.booking.findMany({
      where: { endDate: { gte: from, lt: to }, status: 'checked_in' },
      select: bookingSelect,
      orderBy: { endDate: 'asc' },
    }),
    prisma.booking.findMany({
      where: { status: 'pending_payment' },
      select: bookingSelect,
      orderBy: { startDate: 'asc' },
      take: 50,
    }),
    // Service orders awaiting cash (placed = not yet paid) — F-OPS-6 for services
    prisma.serviceOrder.findMany({
      where: { status: 'placed' },
      select: {
        id: true,
        scheduled_start: true,
        total_thb: true,
        service: { select: { title: true } },
        orderer: { select: { firstName: true, lastName: true } },
      },
      orderBy: { scheduled_start: 'asc' },
      take: 50,
    }),
  ]);

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
