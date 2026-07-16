import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';

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

  const labels = await getLabels({
    'admin.dashboard.title': 'Dashboard',
    'admin.dashboard.units': 'Units (live / total)',
    'admin.dashboard.bookings': 'Bookings (awaiting payment / total)',
    'admin.dashboard.tickets': 'Open tickets',
    'admin.dashboard.people': 'People',
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
    </div>
  );
}
