import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';
import { getMetricsSeries } from '@/modules/analytics';
import { Sparkline, formatThb } from '@/components/viz';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  const [units, liveUnits, bookings, pendingPayment, openTickets, identities] =
    await Promise.all([
      prisma.unit.count(),
      prisma.unit.count({ where: { status: 'live' } }),
      prisma.booking.count(),
      prisma.booking.count({ where: { status: 'pending_payment' } }),
      prisma.ticket.count({ where: { status: { in: ['open', 'acknowledged', 'in_progress'] } } }),
      prisma.identity.count(),
    ]);

  // Platform-wide last 30 days from the analytics rollup (MetricDaily)
  const now = new Date();
  const last30 = await getMetricsSeries(prisma, {
    from: new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000),
    to: now,
    groupBy: 'day',
  });
  const revenue30 = last30.reduce((sum, p) => sum + p.rentalRevenueThb, 0);
  const nights30 = last30.reduce((sum, p) => sum + p.nightsOccupied, 0);

  const labels = await getLabels({
    'admin.dashboard.title': 'Dashboard',
    'admin.dashboard.units': 'Units (live / total)',
    'admin.dashboard.bookings': 'Bookings (awaiting payment / total)',
    'admin.dashboard.tickets': 'Open tickets',
    'admin.dashboard.people': 'People',
    'admin.dashboard.last30_title': 'Last 30 days',
    'admin.dashboard.last30_revenue': 'Rental revenue',
    'admin.dashboard.last30_nights': 'Occupied nights',
    'admin.dashboard.last30_revenue_spark': 'Rental revenue per day, last 30 days',
    'admin.dashboard.last30_nights_spark': 'Occupied nights per day, last 30 days',
    'admin.dashboard.last30_empty': 'No rollup data yet — trends appear after the first nightly rollup.',
  });

  const tiles = [
    {
      href: '/app/admin/units',
      label: labels['admin.dashboard.units'],
      value: `${liveUnits} / ${units}`,
    },
    {
      href: '/app/admin/bookings',
      label: labels['admin.dashboard.bookings'],
      value: `${pendingPayment} / ${bookings}`,
    },
    { href: '/ops', label: labels['admin.dashboard.tickets'], value: String(openTickets) },
    { href: '/app/admin', label: labels['admin.dashboard.people'], value: String(identities) },
  ];

  return (
    <div>
      <h1 className="text-heading-1 font-bold text-text-ink mb-24">
        {labels['admin.dashboard.title']}
      </h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-16">
        {tiles.map((tile) => (
          <Link
            key={tile.label}
            href={tile.href}
            className="bg-surface-paper border border-border-line rounded-lg p-24 hover:shadow-card"
          >
            <p className="text-small text-text-secondary mb-8">{tile.label}</p>
            <p className="text-heading-1 font-bold text-brand-andaman">{tile.value}</p>
          </Link>
        ))}
      </div>

      {/* Platform-wide 30-day trend row (MetricDaily via the analytics read seam) */}
      <h2 className="text-heading-3 font-semibold text-text-ink mt-32 mb-16">
        {labels['admin.dashboard.last30_title']}
      </h2>
      {last30.length === 0 ? (
        <p className="text-small text-text-secondary">
          {labels['admin.dashboard.last30_empty']}
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
          <div className="bg-surface-paper border border-border-line rounded-lg p-24">
            <p className="text-small text-text-secondary mb-8">
              {labels['admin.dashboard.last30_revenue']}
            </p>
            <div className="flex items-end justify-between gap-16">
              <p className="text-heading-2 font-semibold text-text-ink">
                {formatThb(revenue30)}
              </p>
              <Sparkline
                values={last30.map((p) => p.rentalRevenueThb)}
                title={labels['admin.dashboard.last30_revenue_spark']}
                width={160}
                height={36}
              />
            </div>
          </div>
          <div className="bg-surface-paper border border-border-line rounded-lg p-24">
            <p className="text-small text-text-secondary mb-8">
              {labels['admin.dashboard.last30_nights']}
            </p>
            <div className="flex items-end justify-between gap-16">
              <p className="text-heading-2 font-semibold text-text-ink">{nights30}</p>
              <Sparkline
                values={last30.map((p) => p.nightsOccupied)}
                title={labels['admin.dashboard.last30_nights_spark']}
                width={160}
                height={36}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
