import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getLabels } from '@/lib/i18n';
import { prisma } from '@/lib/prisma';
import {
  loadOpsSwitcherProjects,
  opsBoardScope,
  opsHref,
  resolveOpsProjectContext,
  validatedActiveProjectId,
} from '@/app/libs/opsProjectContext';
import OpsProjectSwitcher from '@/components/ops/OpsProjectSwitcher';

export const dynamic = 'force-dynamic';

interface OpsCalendarIndexPageProps {
  searchParams?: {
    projectId?: string;
    start?: string;
    days?: string;
  };
}

const ALLOWED_DAYS = new Set([14, 21, 30]);

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseIsoDate(value?: string): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addDays(date: Date, amount: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + amount);
  return next;
}

function bangkokTodayIso(): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function dayLabel(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(date);
}

function calendarHref(start: Date, days: number, projectId: string | null) {
  const params = new URLSearchParams({ start: isoDate(start), days: String(days) });
  if (projectId) params.set('projectId', projectId);
  return `/ops/calendar?${params.toString()}`;
}

function bookingCellClass(status: string): string {
  if (status === 'checked_in') {
    return 'border-brand-andaman bg-brand-andaman/10';
  }
  if (status === 'confirmed' || status === 'checked_out') {
    return 'border-brand-andaman/40 bg-surface-paper';
  }
  return 'border-state-warning bg-state-warning-soft';
}

function blockCellClass(reason: string): string {
  if (reason === 'maintenance') return 'border-state-error bg-state-error-soft';
  return 'border-border-line bg-brand-sand';
}

/**
 * Resort-wide operational calendar.
 *
 * The calendar is intentionally a read/control surface over existing booking,
 * block and pricing truth. Permanent commercial setup lives in /ops/inventory;
 * clicking a villa opens the established unit override editor.
 */
export default async function OpsCalendarIndexPage({ searchParams }: OpsCalendarIndexPageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?next=/ops/calendar');
  }

  const opsContext = resolveOpsProjectContext(
    user,
    typeof searchParams?.projectId === 'string' ? searchParams.projectId : null
  );
  const isStaff = opsContext.isAdmin || opsContext.staffProjectIds.length > 0;
  if (!isStaff) {
    redirect('/');
  }

  const projects = await loadOpsSwitcherProjects(prisma, opsContext);
  const validActiveProjectId = validatedActiveProjectId(
    opsContext.activeProjectId,
    projects.map((project) => project.id)
  );
  const scope = opsBoardScope(opsContext, validActiveProjectId);
  const projectIds = scope?.projectIds?.length
    ? scope.projectIds
    : projects.map((project) => project.id);

  const requestedDays = Number(searchParams?.days || 21);
  const days = ALLOWED_DAYS.has(requestedDays) ? requestedDays : 21;
  const todayIso = bangkokTodayIso();
  const startDate = parseIsoDate(searchParams?.start) ?? parseIsoDate(todayIso)!;
  const endDate = addDays(startDate, days);
  const dates = Array.from({ length: days }, (_, index) => addDays(startDate, index));

  const units = await prisma.unit.findMany({
    where: {
      status: { not: 'offboarded' },
      ...(projectIds.length ? { projectId: { in: projectIds } } : { id: '__none__' }),
    },
    select: {
      id: true,
      name: true,
      status: true,
      projectId: true,
      project: { select: { id: true, name: true } },
      inventoryCategory: {
        select: {
          id: true,
          name: true,
          categoryKey: true,
          baseNightlyThb: true,
          minNights: true,
        },
      },
      baseNightlyThb: true,
      minNights: true,
    },
    orderBy: [{ project: { name: 'asc' } }, { name: 'asc' }],
  });

  const unitIds = units.map((unit) => unit.id);
  const [bookings, blocks, pricingRules] = unitIds.length
    ? await Promise.all([
        prisma.booking.findMany({
          where: {
            unitId: { in: unitIds },
            startDate: { lt: endDate },
            endDate: { gt: startDate },
            status: {
              in: ['requested', 'pending_payment', 'confirmed', 'checked_in', 'checked_out'],
            },
          },
          select: {
            id: true,
            unitId: true,
            status: true,
            startDate: true,
            endDate: true,
            channel: true,
            guestIdentity: { select: { firstName: true, lastName: true } },
          },
          orderBy: [{ startDate: 'asc' }],
        }),
        prisma.blockedDate.findMany({
          where: {
            unitId: { in: unitIds },
            startDate: { lt: endDate },
            endDate: { gt: startDate },
          },
          select: {
            id: true,
            unitId: true,
            startDate: true,
            endDate: true,
            reason: true,
            note: true,
          },
          orderBy: [{ startDate: 'asc' }],
        }),
        prisma.pricingRule.findMany({
          where: {
            unitId: { in: unitIds },
            startDate: { lt: endDate },
            endDate: { gt: startDate },
          },
          select: {
            id: true,
            unitId: true,
            startDate: true,
            endDate: true,
            nightlyThb: true,
            label: true,
          },
          orderBy: [{ startDate: 'asc' }],
        }),
      ])
    : [[], [], []];

  const bookingsByUnit = new Map<string, typeof bookings>();
  const blocksByUnit = new Map<string, typeof blocks>();
  const rulesByUnit = new Map<string, typeof pricingRules>();
  for (const booking of bookings) {
    bookingsByUnit.set(booking.unitId, [...(bookingsByUnit.get(booking.unitId) || []), booking]);
  }
  for (const block of blocks) {
    blocksByUnit.set(block.unitId, [...(blocksByUnit.get(block.unitId) || []), block]);
  }
  for (const rule of pricingRules) {
    rulesByUnit.set(rule.unitId, [...(rulesByUnit.get(rule.unitId) || []), rule]);
  }

  const labels = await getLabels({
    'staff.calendar.portfolio.title': 'Resort calendar',
    'staff.calendar.portfolio.subtitle':
      'Bookings, arrivals, departures, blocks and dated rate overrides across every villa in one view.',
    'staff.calendar.portfolio.back': '← Today',
    'staff.calendar.portfolio.inventory': 'Inventory & pricing',
    'staff.calendar.portfolio.today': 'Today',
    'staff.calendar.portfolio.previous': 'Previous',
    'staff.calendar.portfolio.next': 'Next',
    'staff.calendar.portfolio.days': 'days',
    'staff.calendar.portfolio.bookings': 'Bookings in view',
    'staff.calendar.portfolio.arrivals': 'Arrivals',
    'staff.calendar.portfolio.departures': 'Departures',
    'staff.calendar.portfolio.blocks': 'Blocks',
    'staff.calendar.portfolio.overrides': 'Price overrides',
    'staff.calendar.portfolio.legend_checkedin': 'In house',
    'staff.calendar.portfolio.legend_confirmed': 'Confirmed',
    'staff.calendar.portfolio.legend_pending': 'Pending / requested',
    'staff.calendar.portfolio.legend_block': 'Blocked',
    'staff.calendar.portfolio.legend_rate': 'Dated rate override',
    'staff.calendar.portfolio.no_units': 'No units in this project scope.',
    'staff.calendar.portfolio.open': 'Open villa calendar',
    'staff.calendar.portfolio.uncategorized': 'Uncategorized',
    'staff.calendar.portfolio.in': 'IN',
    'staff.calendar.portfolio.out': 'OUT',
    'staff.ops.context.switcher': 'Project context',
    'staff.ops.context.all_projects': 'All projects',
    'staff.ops.context.active': 'Showing',
  });

  const arrivals = bookings.filter((booking) => booking.startDate >= startDate && booking.startDate < endDate).length;
  const departures = bookings.filter((booking) => booking.endDate > startDate && booking.endDate <= endDate).length;
  const cardClass = 'rounded-lg border border-border-line bg-surface-paper p-12';

  return (
    <main className="min-h-screen bg-surface-ivory p-12 md:p-24">
      <div className="max-w-[1900px] mx-auto">
        <div className="flex flex-col gap-16 xl:flex-row xl:items-start xl:justify-between mb-20">
          <div>
            <Link
              href={opsHref('/ops', validActiveProjectId)}
              className="text-small font-semibold text-brand-andaman hover:underline"
            >
              {labels['staff.calendar.portfolio.back']}
            </Link>
            <h1 className="font-display text-display-xl font-semibold text-text-ink mt-10">
              {labels['staff.calendar.portfolio.title']}
            </h1>
            <p className="text-body text-text-stone mt-6 max-w-3xl">
              {labels['staff.calendar.portfolio.subtitle']}
            </p>
          </div>
          <div className="flex flex-wrap gap-8">
            <Link
              href={calendarHref(parseIsoDate(todayIso)!, days, validActiveProjectId)}
              className="rounded-md border border-border-line bg-surface-paper px-12 py-8 text-small font-semibold text-text-ink"
            >
              {labels['staff.calendar.portfolio.today']}
            </Link>
            <Link
              href={opsHref('/ops/inventory', validActiveProjectId)}
              className="rounded-md bg-brand-andaman px-12 py-8 text-small font-semibold text-on-dark-text"
            >
              {labels['staff.calendar.portfolio.inventory']}
            </Link>
          </div>
        </div>

        <OpsProjectSwitcher
          projects={projects}
          activeProjectId={validActiveProjectId}
          basePath="/ops/calendar"
          labels={labels}
        />

        <section className="grid grid-cols-2 lg:grid-cols-5 gap-8 my-16">
          <div className={cardClass}><p className="text-micro text-text-secondary">{labels['staff.calendar.portfolio.bookings']}</p><p className="font-display text-title font-semibold text-text-ink mt-2">{bookings.length}</p></div>
          <div className={cardClass}><p className="text-micro text-text-secondary">{labels['staff.calendar.portfolio.arrivals']}</p><p className="font-display text-title font-semibold text-text-ink mt-2">{arrivals}</p></div>
          <div className={cardClass}><p className="text-micro text-text-secondary">{labels['staff.calendar.portfolio.departures']}</p><p className="font-display text-title font-semibold text-text-ink mt-2">{departures}</p></div>
          <div className={cardClass}><p className="text-micro text-text-secondary">{labels['staff.calendar.portfolio.blocks']}</p><p className="font-display text-title font-semibold text-text-ink mt-2">{blocks.length}</p></div>
          <div className={cardClass}><p className="text-micro text-text-secondary">{labels['staff.calendar.portfolio.overrides']}</p><p className="font-display text-title font-semibold text-text-ink mt-2">{pricingRules.length}</p></div>
        </section>

        <section className="mb-12 flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-6">
            {[14, 21, 30].map((option) => (
              <Link
                key={option}
                href={calendarHref(startDate, option, validActiveProjectId)}
                className={`rounded-md border px-10 py-6 text-small font-semibold ${
                  option === days
                    ? 'border-brand-andaman bg-brand-andaman text-on-dark-text'
                    : 'border-border-line bg-surface-paper text-text-ink'
                }`}
              >
                {option} {labels['staff.calendar.portfolio.days']}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-8">
            <Link
              href={calendarHref(addDays(startDate, -days), days, validActiveProjectId)}
              className="rounded-md border border-border-line bg-surface-paper px-10 py-6 text-small font-semibold text-text-ink"
            >
              ← {labels['staff.calendar.portfolio.previous']}
            </Link>
            <span className="text-small font-semibold text-text-ink tabular-nums">
              {isoDate(startDate)} → {isoDate(addDays(endDate, -1))}
            </span>
            <Link
              href={calendarHref(endDate, days, validActiveProjectId)}
              className="rounded-md border border-border-line bg-surface-paper px-10 py-6 text-small font-semibold text-text-ink"
            >
              {labels['staff.calendar.portfolio.next']} →
            </Link>
          </div>
        </section>

        <section className="mb-12 flex flex-wrap gap-x-16 gap-y-6 text-micro text-text-secondary">
          <span><span className="inline-block h-10 w-10 rounded-sm border border-brand-andaman bg-brand-andaman/10 align-middle mr-4" />{labels['staff.calendar.portfolio.legend_checkedin']}</span>
          <span><span className="inline-block h-10 w-10 rounded-sm border border-brand-andaman/40 bg-surface-paper align-middle mr-4" />{labels['staff.calendar.portfolio.legend_confirmed']}</span>
          <span><span className="inline-block h-10 w-10 rounded-sm border border-state-warning bg-state-warning-soft align-middle mr-4" />{labels['staff.calendar.portfolio.legend_pending']}</span>
          <span><span className="inline-block h-10 w-10 rounded-sm border border-state-error bg-state-error-soft align-middle mr-4" />{labels['staff.calendar.portfolio.legend_block']}</span>
          <span><span className="font-semibold text-brand-andaman">฿</span> {labels['staff.calendar.portfolio.legend_rate']}</span>
        </section>

        {units.length === 0 ? (
          <div className={cardClass}>{labels['staff.calendar.portfolio.no_units']}</div>
        ) : (
          <div className="overflow-auto rounded-lg border border-border-line bg-surface-paper shadow-card">
            <table className="border-separate border-spacing-0 text-small">
              <thead>
                <tr>
                  <th className="sticky left-0 top-0 z-30 min-w-[220px] border-b border-r border-border-line bg-surface-paper p-10 text-left text-text-secondary">
                    Villa / category
                  </th>
                  {dates.map((date) => {
                    const dayIso = isoDate(date);
                    const isToday = dayIso === todayIso;
                    return (
                      <th
                        key={dayIso}
                        className={`sticky top-0 z-20 min-w-[128px] border-b border-r border-border-line p-8 text-left ${
                          isToday ? 'bg-brand-sand text-text-ink' : 'bg-surface-paper text-text-secondary'
                        }`}
                      >
                        <p className="font-semibold">{dayLabel(date)}</p>
                        {isToday ? <p className="text-micro text-brand-andaman">TODAY</p> : null}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {units.map((unit) => {
                  const unitBookings = bookingsByUnit.get(unit.id) || [];
                  const unitBlocks = blocksByUnit.get(unit.id) || [];
                  const unitRules = rulesByUnit.get(unit.id) || [];
                  const baseRate = unit.inventoryCategory?.baseNightlyThb ?? unit.baseNightlyThb;
                  const minStay = unit.inventoryCategory?.minNights ?? unit.minNights;
                  return (
                    <tr key={unit.id}>
                      <th className="sticky left-0 z-10 border-b border-r border-border-line bg-surface-paper p-10 text-left align-top">
                        <Link
                          href={opsHref(`/ops/calendar/${unit.id}`, validActiveProjectId ?? unit.projectId)}
                          className="font-semibold text-text-ink hover:text-brand-andaman"
                        >
                          {unit.name}
                        </Link>
                        <p className="text-micro text-text-secondary mt-2">{unit.project.name}</p>
                        <p className="text-micro text-text-secondary mt-5">
                          {unit.inventoryCategory?.name || labels['staff.calendar.portfolio.uncategorized']}
                        </p>
                        <p className="text-micro text-text-muted mt-2 tabular-nums">
                          ฿{Math.round(baseRate / 100).toLocaleString()} · min {minStay}n
                        </p>
                        <Link
                          href={opsHref(`/ops/calendar/${unit.id}`, validActiveProjectId ?? unit.projectId)}
                          className="text-micro font-semibold text-brand-andaman hover:underline mt-6 inline-block"
                        >
                          {labels['staff.calendar.portfolio.open']} →
                        </Link>
                      </th>
                      {dates.map((date) => {
                        const dayIso = isoDate(date);
                        const booking = unitBookings.find(
                          (item) => isoDate(item.startDate) <= dayIso && isoDate(item.endDate) > dayIso
                        );
                        const departing = unitBookings.find((item) => isoDate(item.endDate) === dayIso);
                        const block = unitBlocks.find(
                          (item) => isoDate(item.startDate) <= dayIso && isoDate(item.endDate) > dayIso
                        );
                        const rule = unitRules.find(
                          (item) => isoDate(item.startDate) <= dayIso && isoDate(item.endDate) > dayIso
                        );
                        const isArrival = booking ? isoDate(booking.startDate) === dayIso : false;
                        const isToday = dayIso === todayIso;

                        return (
                          <td
                            key={dayIso}
                            className={`h-[82px] border-b border-r border-border-line p-4 align-top ${
                              isToday ? 'bg-brand-sand/30' : 'bg-surface-ivory'
                            }`}
                          >
                            {booking ? (
                              <div className={`h-full rounded-md border p-6 ${bookingCellClass(booking.status)}`}>
                                <div className="flex items-start justify-between gap-4">
                                  <span className="text-micro font-semibold text-text-ink truncate">
                                    {isArrival ? `${labels['staff.calendar.portfolio.in']} · ` : ''}
                                    {booking.guestIdentity.lastName || booking.guestIdentity.firstName}
                                  </span>
                                  {rule ? (
                                    <span className="text-micro font-semibold text-brand-andaman tabular-nums">
                                      ฿{Math.round(rule.nightlyThb / 100).toLocaleString()}
                                    </span>
                                  ) : null}
                                </div>
                                <p className="text-micro text-text-secondary mt-3 truncate">
                                  {booking.status.replace(/_/g, ' ')} · {String(booking.channel).replace(/_/g, ' ')}
                                </p>
                                {departing ? (
                                  <p className="text-micro text-text-muted mt-2">{labels['staff.calendar.portfolio.out']} · {departing.guestIdentity.lastName}</p>
                                ) : null}
                                {block ? (
                                  <p className="text-micro font-semibold text-state-error mt-2">Conflict: {String(block.reason).replace(/_/g, ' ')}</p>
                                ) : null}
                              </div>
                            ) : block ? (
                              <div className={`h-full rounded-md border p-6 ${blockCellClass(String(block.reason))}`}>
                                <p className="text-micro font-semibold text-text-ink">{String(block.reason).replace(/_/g, ' ')}</p>
                                {block.note ? <p className="text-micro text-text-secondary mt-3 line-clamp-2">{block.note}</p> : null}
                                {departing ? <p className="text-micro text-text-muted mt-2">{labels['staff.calendar.portfolio.out']} · {departing.guestIdentity.lastName}</p> : null}
                                {rule ? <p className="text-micro font-semibold text-brand-andaman mt-2">฿{Math.round(rule.nightlyThb / 100).toLocaleString()}</p> : null}
                              </div>
                            ) : (
                              <div className="h-full rounded-md p-4">
                                {departing ? (
                                  <p className="text-micro font-semibold text-text-secondary">{labels['staff.calendar.portfolio.out']} · {departing.guestIdentity.lastName}</p>
                                ) : null}
                                {rule ? (
                                  <p className="text-micro font-semibold text-brand-andaman tabular-nums mt-2">
                                    ฿{Math.round(rule.nightlyThb / 100).toLocaleString()}
                                    {rule.label ? ` · ${rule.label}` : ''}
                                  </p>
                                ) : null}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
