import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';
import { getOperatingSpaceMembership, getOperatingSpaceUnitIds } from '@/modules/ops';
import { addDays, calendarDayIn, startOfCalendarDayUtc } from '@/lib/date';

export const dynamic = 'force-dynamic';

export default async function OperatingSpaceHome({
  params,
}: { params: { spaceId: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/ops/spaces/' + encodeURIComponent(params.spaceId));

  const space = await prisma.operatingSpace.findUnique({
    where: { id: params.spaceId },
    select: {
      id: true,
      key: true,
      name: true,
      timezone: true,
      status: true,
      organizationId: true,
    },
  });
  if (!space || space.status !== 'active') notFound();

  if (!user.isAdmin) {
    const membership = await getOperatingSpaceMembership(prisma, space.id, user.identityId);
    if (!membership?.active) redirect('/ops/spaces');
  }

  const unitIds = await getOperatingSpaceUnitIds(prisma, space.id);
  const now = new Date();
  // Booking.startDate/endDate are @db.Date values. Resolve "today" in the
  // operating-space timezone, then compare using the same UTC-midnight
  // calendar-day representation Prisma round-trips for date columns.
  const start = startOfCalendarDayUtc(calendarDayIn(now, space.timezone));
  const end = addDays(start, 1);

  const [units, arrivals, departures, occupied, requests, openTasks] = await Promise.all([
    prisma.unit.count({ where: { id: { in: unitIds }, status: { not: 'offboarded' } } }),
    prisma.booking.count({
      where: {
        unitId: { in: unitIds },
        startDate: { gte: start, lt: end },
        status: { in: ['confirmed', 'checked_in'] },
      },
    }),
    prisma.booking.count({
      where: {
        unitId: { in: unitIds },
        endDate: { gt: start, lte: end },
        status: { in: ['confirmed', 'checked_in', 'checked_out'] },
      },
    }),
    prisma.booking.count({
      where: {
        unitId: { in: unitIds },
        startDate: { lte: now },
        endDate: { gt: now },
        status: { in: ['confirmed', 'checked_in'] },
      },
    }),
    prisma.booking.count({
      where: {
        unitId: { in: unitIds },
        status: 'requested',
      },
    }),
    prisma.operationalTask.count({
      where: {
        unitId: { in: unitIds },
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
    'staff.space.scope_hint': 'All actions stay within this operating space and continue to use canonical Unit, Booking, Pricing and Finance records.',
  });

  const cards = [
    [labels['staff.space.units'], units],
    [labels['staff.space.arrivals'], arrivals],
    [labels['staff.space.departures'], departures],
    [labels['staff.space.occupied'], occupied],
    [labels['staff.space.requests'], requests],
    [labels['staff.space.tasks'], openTasks],
  ] as const;

  const links = [
    [labels['staff.space.calendar'], '/ops/calendar/board?spaceId=' + encodeURIComponent(space.id)],
    [labels['staff.space.reservations'], '/ops/stays?spaceId=' + encodeURIComponent(space.id)],
    [labels['staff.space.housekeeping'], '/ops/housekeeping?spaceId=' + encodeURIComponent(space.id)],
    [labels['staff.space.maintenance'], '/ops/maintenance?spaceId=' + encodeURIComponent(space.id)],
    [labels['staff.space.pricing'], '/ops/calendar/board?spaceId=' + encodeURIComponent(space.id)],
    [labels['staff.space.team'], '/ops/team?spaceId=' + encodeURIComponent(space.id)],
    [labels['staff.space.finance'], '/app/admin/ledger?spaceId=' + encodeURIComponent(space.id)],
    [labels['staff.space.channels'], '/ops/calendar/board?spaceId=' + encodeURIComponent(space.id)],
  ] as const;

  return <main className="min-h-screen bg-surface-ivory p-16 md:p-32">
    <div className="mx-auto max-w-7xl space-y-24">
      <header>
        <Link href="/ops/spaces" className="text-small font-semibold text-brand-andaman hover:underline">
          {labels['staff.space.back']}
        </Link>
        <p className="mt-16 text-kicker font-bold tracking-widest text-brand-andaman">
          {labels['staff.space.kicker']}
        </p>
        <h1 className="mt-8 font-display text-display-xl font-semibold text-text-ink">{space.name}</h1>
        <p className="mt-8 text-body text-text-secondary">{labels['staff.space.scope_hint']}</p>
      </header>

      <section>
        <h2 className="font-display text-heading-2 font-semibold text-text-ink">{labels['staff.space.today']}</h2>
        <div className="mt-12 grid grid-cols-2 gap-8 md:grid-cols-3 xl:grid-cols-6">
          {cards.map(([label, value]) => (
            <div key={label} className="rounded-lg border border-border-line bg-surface-paper p-16">
              <p className="text-small text-text-secondary">{label}</p>
              <p className="mt-4 font-display text-heading-2 font-bold text-text-ink">{value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-12 md:grid-cols-2 xl:grid-cols-3">
        {links.map(([label, href]) => (
          <Link key={label} href={href}
            className="rounded-xl border border-border-line bg-surface-paper p-20 font-semibold text-text-ink hover:border-brand-andaman">
            {label} →
          </Link>
        ))}
      </section>
    </div>
  </main>;
}
