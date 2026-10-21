import { SALES_LABELS, SALES_DRAFTS } from '@/modules/content/sales-offer.seed';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';
import { getOperatingSpaceOverviewAccess, OperatingAccessError } from '@/modules/ops/operating-space-access.service';
import type { OperatingSpaceCapability } from '@/modules/ops/operating-space.service';

export const dynamic = 'force-dynamic';

export default async function OperatingSpaceHome(props: { params: Promise<{ spaceId: string }> }) {
  const params = await props.params;
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/ops/spaces/' + encodeURIComponent(params.spaceId));

  const access = await getOperatingSpaceOverviewAccess(prisma, user.identityId, params.spaceId).catch(error => {
    if (error instanceof OperatingAccessError) notFound();
    throw error;
  });
  const { space, unitIds } = access;
  const can = (capability: OperatingSpaceCapability) => access.isAdmin || Boolean(access.byCapability[capability]?.length);
  const bookingUnitIds = [...new Set([...(access.byCapability.view_calendar || []), ...(access.byCapability.manage_reservations || [])])];
  const taskUnitIds = access.byCapability.manage_tasks || [];
  const now = new Date();
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone: space.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const start = new Date(day + 'T00:00:00+07:00');
  const end = new Date(new Date(start).getTime() + 24 * 60 * 60 * 1000);

  const [units, arrivals, departures, occupied, requests, openTasks] = await Promise.all([
    prisma.unit.count({ where: { id: { in: unitIds }, status: { not: 'offboarded' } } }),
    prisma.booking.count({
      where: {
        unitId: { in: bookingUnitIds },
        startDate: { gte: start, lt: end },
        status: { in: ['confirmed', 'checked_in'] },
      },
    }),
    prisma.booking.count({
      where: {
        unitId: { in: bookingUnitIds },
        endDate: { gt: start, lte: end },
        status: { in: ['confirmed', 'checked_in', 'checked_out'] },
      },
    }),
    prisma.booking.count({
      where: {
        unitId: { in: bookingUnitIds },
        startDate: { lte: now },
        endDate: { gt: now },
        status: { in: ['confirmed', 'checked_in'] },
      },
    }),
    prisma.booking.count({
      where: {
        unitId: { in: bookingUnitIds },
        status: 'requested',
      },
    }),
    prisma.operationalTask.count({
      where: {
        unitId: { in: taskUnitIds },
        OR: [{ operatingSpaceId: space.id }, { operatingSpaceId: null }],
        status: { in: ['planned', 'assigned', 'in_progress', 'inspected', 'blocked'] },
      },
    }),
  ]);

  const labels = await getLabels({
    'staff.space.back': '← Operating spaces',
    'staff.space.kicker': 'OPERATING SPACE',
    'staff.space.today': 'Today',
    'staff.space.units': 'Managed homes',
    'staff.space.arrivals': 'Arrivals',
    'staff.space.departures': 'Departures',
    'staff.space.occupied': 'Occupied now',
    'staff.space.requests': 'Booking requests',
    'staff.space.tasks': 'Open readiness tasks',
    'staff.space.calendar': 'Calendar',
    'staff.space.reservations': 'Reservations',
    'staff.space.housekeeping': 'Housekeeping & tasks',
    'staff.space.maintenance': 'Maintenance',
    'staff.space.pricing': 'Pricing',
    'staff.space.team': 'Team',
    'staff.space.finance': 'Finance & reports',
    'staff.space.channels': 'Channels',
    ...SALES_LABELS,
    'staff.space.tasks_link': 'Tasks',
    'staff.space.effective_scope_hint': 'Counts and daily tasks reflect your current authorized homes. Reservation, finance and recurring-automation readiness remain separate.',
  }, undefined, SALES_DRAFTS);

  const cards = [
    [labels['staff.space.units'], units],
    ...(bookingUnitIds.length ? [[labels['staff.space.arrivals'], arrivals], [labels['staff.space.departures'], departures], [labels['staff.space.occupied'], occupied], [labels['staff.space.requests'], requests]] : []),
    ...(can('manage_tasks') ? [[labels['staff.space.tasks'], openTasks]] : []),
  ] as const;

  const links = [
    ...(can('manage_reservations') ? [[labels['sales.title'], '/ops/sales?spaceId=' + encodeURIComponent(space.id)]] : []),
    ...(can('view_calendar') ? [[labels['staff.space.calendar'], '/ops/calendar/board?spaceId=' + encodeURIComponent(space.id)]] : []),
    ...(can('manage_reservations') ? [[labels['staff.space.reservations'], '/ops/reservations?spaceId=' + encodeURIComponent(space.id)]] : []),
    ...(can('manage_tasks') ? [[labels['staff.space.tasks_link'], '/ops/tasks?spaceId=' + encodeURIComponent(space.id)]] : []),
    ...(can('manage_housekeeping') ? [[labels['staff.space.housekeeping'], '/ops/housekeeping?spaceId=' + encodeURIComponent(space.id)]] : []),
    ...(can('manage_maintenance') ? [[labels['staff.space.maintenance'], '/ops/maintenance?spaceId=' + encodeURIComponent(space.id)]] : []),
    ...(can('manage_pricing') || can('manage_availability') ? [[labels['staff.space.pricing'], '/ops/calendar/board?spaceId=' + encodeURIComponent(space.id)]] : []),
    ...(can('manage_team') ? [[labels['staff.space.team'], '/ops/team?spaceId=' + encodeURIComponent(space.id)]] : []),
    ...(access.isAdmin ? [[labels['staff.space.finance'], '/app/admin/ledger?spaceId=' + encodeURIComponent(space.id)]] : []),
    ...(can('manage_channels') ? [[labels['staff.space.channels'], '/ops/calendar/board?spaceId=' + encodeURIComponent(space.id) + '&channel=attention']] : []),
  ];

  return <main className="stitch-workspace p-16 md:p-32">
    <div className="mx-auto max-w-7xl space-y-24">
      <header>
        <Link href="/ops/spaces" className="text-small font-semibold text-brand-andaman hover:underline">
          {labels['staff.space.back']}
        </Link>
        <p className="mt-16 stitch-kicker">
          {labels['staff.space.kicker']}
        </p>
        <h1 className="mt-8 font-display text-display-xl font-semibold text-text-ink">{space.name}</h1>
        <p className="mt-8 text-body text-text-secondary">{labels['staff.space.effective_scope_hint']}</p>
      </header>

      <section>
        <h2 className="font-display text-heading-2 font-semibold text-text-ink">{labels['staff.space.today']}</h2>
        <div className="mt-12 grid grid-cols-2 gap-8 md:grid-cols-3 xl:grid-cols-6">
          {cards.map(([label, value]) => (
            <div key={label} className="stitch-panel p-16">
              <p className="text-small text-text-secondary">{label}</p>
              <p className="mt-4 font-display text-heading-2 font-bold font-tabular text-text-ink">{value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-12 md:grid-cols-2 xl:grid-cols-3">
        {links.map(([label, href]) => (
          <Link key={label} href={href}
            className="stitch-panel p-20 font-semibold text-text-ink hover:border-brand-andaman">
            {label} →
          </Link>
        ))}
      </section>
    </div>
  </main>;
}

