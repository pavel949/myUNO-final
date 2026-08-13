import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';
import {
  getAdminDashboardStats,
  occupancyByCategory,
  revenueByChannel,
  revenueSplit,
} from '@/modules/analytics';
import { listProjects } from '@/modules/projects';
import { Sparkline, formatThb } from '@/components/viz';
import { StatTile } from '@/components/StatTile';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  const { units, liveUnits, bookings, pendingPayment, openTickets, identities, revenue30, nights30, last30, kpis } =
    await getAdminDashboardStats(prisma);

  // Per-project reports (LY-10, last 30 days): occupancy by category,
  // revenue by channel, rental vs ancillary — read-time aggregates.
  const reportEnd = new Date();
  const reportStart = new Date(reportEnd.getTime() - 30 * 24 * 60 * 60 * 1000);
  const liveProjects = (await listProjects('live')).slice(0, 5);
  const projectReports = await Promise.all(
    liveProjects.map(async (project) => ({
      id: project.id,
      name: project.name,
      categories: await occupancyByCategory(prisma, project.id, reportStart, reportEnd),
      channels: await revenueByChannel(prisma, project.id, reportStart, reportEnd),
      split: await revenueSplit(prisma, project.id, reportStart, reportEnd),
    }))
  );

  const labels = await getLabels({
    'admin.dashboard.title': 'Dashboard',
    'admin.dashboard.units': 'Units (live / total)',
    'admin.dashboard.bookings': 'Bookings (awaiting payment / total)',
    'admin.dashboard.tickets': 'Open tickets',
    'admin.dashboard.people': 'People',
    'admin.dashboard.last30_title': 'Last 30 days',
    'admin.dashboard.kpi_title': 'Key metrics (last 30 days)',
    'admin.dashboard.occupancy': 'Occupancy %',
    'admin.dashboard.adr': 'ADR (฿)',
    'admin.dashboard.revpan': 'RevPAN (฿)',
    'admin.dashboard.attach_rate': 'Service attach rate %',
    'admin.dashboard.direct_share': 'Direct bookings %',
    'admin.dashboard.repeat_guests': 'Repeat guests %',
    'admin.dashboard.last30_revenue': 'Rental revenue',
    'admin.dashboard.last30_nights': 'Occupied nights',
    'admin.dashboard.last30_revenue_spark': 'Rental revenue per day, last 30 days',
    'admin.dashboard.reports_title': 'Project reports (last 30 days)',
    'admin.dashboard.reports.category': 'Category',
    'admin.dashboard.reports.villas': 'Villas',
    'admin.dashboard.reports.booked_nights': 'Booked nights',
    'admin.dashboard.reports.occupancy': 'Occupancy %',
    'admin.dashboard.reports.channel': 'Channel',
    'admin.dashboard.reports.revenue': 'Revenue',
    'admin.dashboard.reports.bookings': 'Bookings',
    'admin.dashboard.reports.rental': 'Rental revenue',
    'admin.dashboard.reports.ancillary': 'Ancillary revenue (services)',
    'admin.dashboard.reports.empty': 'No data in the period yet.',
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

  const kpiTiles = [
    { label: labels['admin.dashboard.occupancy'], value: `${kpis.occupancyPct}%` },
    { label: labels['admin.dashboard.adr'], value: formatThb(kpis.adrThb) },
    { label: labels['admin.dashboard.revpan'], value: formatThb(kpis.revpanThb) },
    { label: labels['admin.dashboard.attach_rate'], value: `${kpis.attachRatePct}%` },
    { label: labels['admin.dashboard.direct_share'], value: `${kpis.directSharePct}%` },
    { label: labels['admin.dashboard.repeat_guests'], value: `${kpis.repeatGuestRatePct}%` },
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
            className="hover:shadow-card transition-shadow"
          >
            <StatTile label={tile.label} value={tile.value} />
          </Link>
        ))}
      </div>

      {/* KPI row */}
      <h2 className="text-heading-3 font-semibold text-text-ink mt-32 mb-16">
        {labels['admin.dashboard.kpi_title']}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-16">
        {kpiTiles.map((tile) => (
          <div key={tile.label} className="bg-surface-paper border border-border-line rounded-lg p-24">
            <p className="text-small text-text-secondary mb-8">{tile.label}</p>
            <p className="text-heading-2 font-semibold text-text-ink">{tile.value}</p>
          </div>
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

      {projectReports.length > 0 ? (
        <div className="mt-40">
          <h2 className="text-heading-2 font-semibold text-text-ink mb-24">
            {labels['admin.dashboard.reports_title']}
          </h2>
          <div className="flex flex-col gap-24">
            {projectReports.map((report) => (
              <div
                key={report.id}
                className="bg-surface-paper border border-border-line rounded-lg p-24"
              >
                <p className="text-subtitle font-semibold text-text-ink mb-16">{report.name}</p>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-24">
                  <div>
                    {report.categories.length === 0 ? (
                      <p className="text-small text-text-secondary">
                        {labels['admin.dashboard.reports.empty']}
                      </p>
                    ) : (
                      <table className="w-full text-small">
                        <thead>
                          <tr className="text-left text-text-secondary">
                            <th className="pb-8">{labels['admin.dashboard.reports.category']}</th>
                            <th className="pb-8">{labels['admin.dashboard.reports.villas']}</th>
                            <th className="pb-8">{labels['admin.dashboard.reports.booked_nights']}</th>
                            <th className="pb-8">{labels['admin.dashboard.reports.occupancy']}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.categories.map((row) => (
                            <tr key={row.categoryKey} className="text-text-ink">
                              <td className="py-4">{row.categoryKey.replace(/_/g, ' ')}</td>
                              <td className="py-4">{row.unitCount}</td>
                              <td className="py-4">{row.bookedNights}</td>
                              <td className="py-4">{row.occupancyPct}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                  <div>
                    {report.channels.length === 0 ? (
                      <p className="text-small text-text-secondary">
                        {labels['admin.dashboard.reports.empty']}
                      </p>
                    ) : (
                      <table className="w-full text-small">
                        <thead>
                          <tr className="text-left text-text-secondary">
                            <th className="pb-8">{labels['admin.dashboard.reports.channel']}</th>
                            <th className="pb-8">{labels['admin.dashboard.reports.revenue']}</th>
                            <th className="pb-8">{labels['admin.dashboard.reports.bookings']}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.channels.map((row) => (
                            <tr key={row.channel} className="text-text-ink">
                              <td className="py-4">{row.channel.replace(/_/g, ' ')}</td>
                              <td className="py-4">{formatThb(row.revenueThb)}</td>
                              <td className="py-4">{row.bookings}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                  <div className="flex flex-col gap-12">
                    <div>
                      <p className="text-small text-text-secondary">
                        {labels['admin.dashboard.reports.rental']}
                      </p>
                      <p className="text-heading-3 font-semibold text-text-ink">
                        {formatThb(report.split.rentalThb)}
                      </p>
                    </div>
                    <div>
                      <p className="text-small text-text-secondary">
                        {labels['admin.dashboard.reports.ancillary']}
                      </p>
                      <p className="text-heading-3 font-semibold text-text-ink">
                        {formatThb(report.split.ancillaryThb)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
