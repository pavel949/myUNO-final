/* eslint-disable local-rules/no-literal-ui-text */
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getMCProjectScopes, getStaffProjectIds } from '@/app/libs/projectScope';
import { prisma } from '@/lib/prisma';
import { projectCalendar, type CalendarCell, type CalendarEntry, type CalendarState } from '@/modules/booking';

export const dynamic = 'force-dynamic';

type PageProps = { searchParams?: { month?: string; projectId?: string } };
const OCCUPYING = ['confirmed', 'checked_in'] as const;
const DAY_MS = 86_400_000;

function monthStart(value: string | undefined): Date {
  if (value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    const date = new Date(`${value}-01T00:00:00.000Z`);
    if (!Number.isNaN(date.getTime()) && date.getUTCFullYear() >= 2000 && date.getUTCFullYear() <= 2100) return date;
  }
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}
const dayKey = (date: Date) => date.toISOString().slice(0, 10);
const monthKey = (date: Date) => dayKey(date).slice(0, 7);
const inNight = (day: Date, start: Date, end: Date) => start <= day && day < end;
const asBaht = (satang: number) => new Intl.NumberFormat('en-TH', { maximumFractionDigits: 0 }).format(satang / 100);

export default async function ManagedPortfolioCalendarPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/mc/portfolio');
  const scopes = getMCProjectScopes(user);
  const staffProjectIds = getStaffProjectIds(user);
  if (!scopes.length && !staffProjectIds.length && !user.isAdmin) redirect('/');

  const month = monthStart(searchParams?.month);
  const end = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1));
  const days = Array.from({ length: Math.round((end.getTime() - month.getTime()) / DAY_MS) }, (_, i) =>
    new Date(month.getTime() + i * DAY_MS)
  );
  const previous = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() - 1, 1));
  const next = end;
  const projectIds = [...new Set(scopes.map((scope) => scope.projectId))];
  const organizationIds = [...new Set(scopes.map((scope) => scope.organizationId))];

  // Role assignments alone are insufficient: each displayed unit must also have an active
  // engagement for the SAME (project, organization) pair. Never union the two lists independently.
  const roleAssignments = await prisma.roleAssignment.findMany({
    where: {
      identityId: user.identityId,
      role: 'mc_member',
      status: 'active',
      projectId: { in: projectIds },
      organizationId: { in: organizationIds },
    },
    select: { projectId: true, organizationId: true },
  });
  const approvedPairs = new Set(
    roleAssignments.filter((role) => role.projectId && role.organizationId)
      .map((role) => `${role.projectId}:${role.organizationId}`)
  );
  const approvedScopes = scopes.filter((scope) => approvedPairs.has(`${scope.projectId}:${scope.organizationId}`));
  const projectScopeIds = [...new Set([...approvedScopes.map((scope) => scope.projectId), ...staffProjectIds])];
  const validProjectId = typeof searchParams?.projectId === 'string' &&
    (user.isAdmin || projectScopeIds.includes(searchParams.projectId))
    ? searchParams.projectId : undefined;
  const selectedProjectId = validProjectId;
  const eligible = selectedProjectId
    ? approvedScopes.filter((scope) => scope.projectId === selectedProjectId)
    : approvedScopes;
  const staffEligibleIds = selectedProjectId
    ? staffProjectIds.filter((id) => id === selectedProjectId) : staffProjectIds;
  const visibility = [
    ...eligible.map((scope) => ({
      projectId: scope.projectId,
      engagements: { some: {
        engagementType: 'via_management_company' as const,
        status: 'active' as const,
        managementOrgId: scope.organizationId,
      } },
    })),
    ...staffEligibleIds.map((projectId) => ({
      projectId,
      engagements: { some: { status: 'active' as const } },
    })),
    ...(user.isAdmin ? [{ engagements: { some: { status: 'active' as const } }, ...(selectedProjectId ? { projectId: selectedProjectId } : {}) }] : []),
  ];
  const allManagedVisibility = [
    ...approvedScopes.map(scope => ({
      projectId: scope.projectId,
      engagements: { some: {
        engagementType: 'via_management_company' as const,
        status: 'active' as const,
        managementOrgId: scope.organizationId,
      } },
    })),
    ...staffProjectIds.map(projectId => ({
      projectId,
      engagements: { some: { status: 'active' as const } },
    })),
    ...(user.isAdmin ? [{ engagements: { some: { status: 'active' as const } } }] : []),
  ];
  const managedProjectRows = await prisma.unit.findMany({
    where: { status: { not: 'offboarded' }, OR: allManagedVisibility },
    select: { projectId: true, project: { select: { name: true } } },
    distinct: ['projectId'],
  });
  const units = await prisma.unit.findMany({
    where: {
      status: { not: 'offboarded' },
      OR: visibility,
    },
    select: {
      id: true, name: true, projectId: true, status: true, baseNightlyThb: true,
      project: { select: { name: true } },
      inventoryCategory: { select: { name: true, baseNightlyThb: true } },
    },
    orderBy: [{ project: { name: 'asc' } }, { name: 'asc' }],
  });
  const ids = units.map((unit) => unit.id);
  const now = new Date();
  const [bookings, blocks, rules, tickets] = ids.length ? await Promise.all([
    prisma.booking.findMany({
      where: { unitId: { in: ids }, startDate: { lt: end }, endDate: { gt: month },
        OR: [
          { status: { in: [...OCCUPYING] } },
          { status: 'pending_payment', holdExpiresAt: { gt: now } },
          { status: 'requested' },
          { status: { in: ['checked_out', 'completed'] } },
        ],
      },
      select: { id: true, unitId: true, status: true, startDate: true, endDate: true, holdExpiresAt: true },
    }),
    prisma.blockedDate.findMany({
      where: { unitId: { in: ids }, startDate: { lt: end }, endDate: { gt: month } },
      select: { id: true, unitId: true, startDate: true, endDate: true, reason: true },
    }),
    prisma.pricingRule.findMany({
      where: { unitId: { in: ids }, startDate: { lt: end }, endDate: { gt: month } },
      select: { unitId: true, startDate: true, endDate: true, nightlyThb: true },
    }),
    prisma.ticket.groupBy({
      by: ['unitId'], where: { unitId: { in: ids }, status: { in: ['open', 'acknowledged', 'in_progress', 'waiting_reporter'] } },
      _count: { _all: true },
    }),
  ]) : [[], [], [], []];

  const byUnit = <T extends { unitId: string | null }>(rows: T[]) => {
    const result = new Map<string, T[]>();
    for (const row of rows) {
      if (!row.unitId) continue;
      result.set(row.unitId, [...(result.get(row.unitId) || []), row]);
    }
    return result;
  };
  const rulesByUnit = byUnit(rules);
  const ticketsByUnit = new Map(tickets.map((ticket) => [ticket.unitId, ticket._count._all]));
  // One projection with the ops board: the same Booking/BlockedDate records,
  // the same precedence (canonical calendar-projection), so occupancy here can
  // never disagree with the calendar an operator acts on.
  const entries: CalendarEntry[] = [
    ...bookings.map((booking) => ({
      id: booking.id, unitId: booking.unitId, kind: 'booking' as const,
      startDate: dayKey(booking.startDate), endDate: dayKey(booking.endDate),
      status: booking.status, holdExpiresAt: booking.holdExpiresAt?.toISOString() ?? null,
    })),
    ...blocks.map((block) => ({
      id: block.id, unitId: block.unitId, kind: 'block' as const,
      startDate: dayKey(block.startDate), endDate: dayKey(block.endDate),
      status: 'blocked', reason: block.reason,
    })),
  ];
  const cells = projectCalendar(ids, days.map(dayKey), entries, now);
  const bookingStatus = new Map(bookings.map((booking) => [booking.id, booking.status]));
  const OCCUPIED_STATES = new Set<CalendarState>(['confirmed', 'in_house', 'past']);
  const BLOCKED_STATES = new Set<CalendarState>(['owner', 'maintenance', 'external', 'blocked']);
  // A conflicted night is unsellable either way; it counts as occupied when a
  // stay sits on it, otherwise as blocked, and is also reported separately.
  const nightKind = (cell: CalendarCell): 'occupied' | 'blocked' | 'held' | 'request' | 'free' => {
    if (cell.state === 'conflict') {
      return cell.bookingIds.some((id) => ['confirmed', 'checked_in', 'checked_out', 'completed'].includes(bookingStatus.get(id) ?? ''))
        ? 'occupied' : 'blocked';
    }
    if (OCCUPIED_STATES.has(cell.state)) return 'occupied';
    if (BLOCKED_STATES.has(cell.state)) return 'blocked';
    if (cell.state === 'hold') return 'held';
    if (cell.state === 'request') return 'request';
    return 'free';
  };
  let occupiedNights = 0;
  let blockedNights = 0;
  let heldNights = 0;
  let conflictedNights = 0;
  for (const unit of units) {
    for (const cell of cells[unit.id] ?? []) {
      if (cell.state === 'conflict') conflictedNights++;
      const kind = nightKind(cell);
      if (kind === 'occupied') occupiedNights++;
      else if (kind === 'blocked') blockedNights++;
      else if (kind === 'held') heldNights++;
    }
  }
  const totalNights = units.length * days.length;
  const sellableNights = totalNights - blockedNights;
  const availableNights = totalNights - occupiedNights - blockedNights - heldNights;
  const openTasks = tickets.reduce((sum, ticket) => sum + ticket._count._all, 0);
  const query = (date: Date, projectId?: string) =>
    `/mc/portfolio?month=${monthKey(date)}${projectId ? `&projectId=${encodeURIComponent(projectId)}` : ''}`;
  // Offer only projects actually represented by an authorized managed unit.
  const projectOptions = managedProjectRows.map(row => [row.projectId, row.project.name] as const)
    .sort((a, b) => a[1].localeCompare(b[1]));
  const label = month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });

  return (
    <main className="min-h-screen bg-surface-ivory px-16 py-24 md:px-32">
      <div className="mx-auto max-w-[1600px]">
        <div className="flex flex-wrap items-center justify-between gap-12">
          <div>
            <Link href="/mc" className="text-small text-brand-andaman hover:underline">← Management</Link>
            <h1 className="mt-8 font-display text-display-xl text-text-ink">Managed portfolio</h1>
            <p className="mt-4 text-small text-text-secondary">One occupancy calendar across your authorized properties. All dates are property nights; checkout is exclusive.</p>
          </div>
          <div className="flex flex-wrap gap-8">
            <Link href="/property/onboard" className="rounded-lg border border-border-line bg-surface-paper px-16 py-12 text-small font-semibold text-brand-andaman">Submit a property →</Link>
            {(user.isAdmin || (selectedProjectId && staffProjectIds.includes(selectedProjectId))) && selectedProjectId && <Link href={`/ops/projects/${selectedProjectId}/edit`} className="rounded-lg border border-border-line bg-surface-paper px-16 py-12 text-small font-semibold text-brand-andaman">Edit complex →</Link>}
            <Link href={user.isAdmin || staffProjectIds.length ? '/ops/calendar' : '/mc/calendar'} className="rounded-lg border border-border-line bg-surface-paper px-16 py-12 text-small font-semibold text-brand-andaman">Unit calendars & rates →</Link>
          </div>
        </div>
        <div className="mt-24 grid grid-cols-2 gap-12 lg:grid-cols-4">
          {[
            ['Managed homes', units.length.toString()],
            ['Occupied nights', occupiedNights.toString()],
            ['Occupancy · sellable nights', sellableNights ? `${Math.round(100 * occupiedNights / sellableNights)}%` : '—'],
            ['Available nights', availableNights.toString()],
            ['Blocked nights', blockedNights.toString()],
            ['Payment-hold nights', heldNights.toString()],
            ['Calendar conflicts', conflictedNights.toString()],
            ['Open maintenance / service tickets', openTasks.toString()],
          ].map(([name, value]) => <div key={name} className="rounded-lg border border-border-line bg-surface-paper p-16"><p className="text-small text-text-secondary">{name}</p><p className="mt-8 font-display text-heading-2 text-text-ink">{value}</p></div>)}
        </div>
        <div className="mt-24 flex flex-wrap items-center justify-between gap-12">
          <nav aria-label="Project" className="flex flex-wrap gap-8">
            <Link href={query(month, undefined)} className={`rounded-full border px-12 py-8 text-small ${!selectedProjectId ? 'bg-brand-deep text-white' : 'bg-surface-paper text-text-ink'}`}>All managed</Link>
            {projectOptions.map(([id, name]) => <Link key={id} href={query(month, id)} className={`rounded-full border px-12 py-8 text-small ${selectedProjectId === id ? 'bg-brand-deep text-white' : 'bg-surface-paper text-text-ink'}`}>{name}</Link>)}
          </nav>
          <nav aria-label="Month" className="flex items-center gap-12">
            <Link href={query(previous, selectedProjectId)} className="rounded-lg border border-border-line bg-surface-paper px-12 py-8" aria-label="Previous month">←</Link>
            <span className="min-w-[120px] text-center font-semibold text-text-ink">{label}</span>
            <Link href={query(next, selectedProjectId)} className="rounded-lg border border-border-line bg-surface-paper px-12 py-8" aria-label="Next month">→</Link>
          </nav>
        </div>
        <div className="mt-12 flex flex-wrap gap-16 text-small text-text-secondary">
          <span>■ Booked / checked in</span><span>■ Payment hold</span><span>■ Maintenance / owner / OTA block</span><span>◇ Request (not blocked)</span><span>! Overlap needs reconciliation</span>
        </div>
        <div className="mt-12 overflow-x-auto rounded-lg border border-border-line bg-surface-paper">
          <table className="w-full min-w-max border-collapse text-small">
            <thead><tr className="bg-surface-ivory">
              <th scope="col" className="sticky left-0 z-20 min-w-[210px] border-b border-r border-border-line bg-surface-ivory px-12 py-12 text-left">Property / unit</th>
              {days.map((day) => <th key={dayKey(day)} scope="col" className="min-w-[37px] border-b border-border-line px-4 py-12 text-center"><span className="block text-text-secondary">{day.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' }).slice(0, 2)}</span>{day.getUTCDate()}</th>)}
              <th scope="col" className="border-b border-border-line px-12 py-12 text-right">Base / night</th>
              <th scope="col" className="border-b border-border-line px-12 py-12 text-right">Tasks</th>
            </tr></thead>
            <tbody>{units.map((unit, i) => {
              const unitCells = cells[unit.id] ?? [];
              const unitRules = rulesByUnit.get(unit.id) || [];
              return <tr key={unit.id} className={i % 2 ? 'bg-surface-ivory/50' : ''}>
                <th scope="row" className="sticky left-0 z-10 border-b border-r border-border-line bg-surface-paper px-12 py-8 text-left">
                  <Link href={user.isAdmin || staffProjectIds.includes(unit.projectId) ? `/ops/calendar/${unit.id}` : `/mc/units/${unit.id}`} className="font-semibold text-brand-andaman hover:underline">{unit.name}</Link>
                  <span className="block text-text-secondary">{unit.project.name}</span>
                  <span className="block text-brand-andaman">Category: {unit.inventoryCategory?.name || 'Uncategorized'} · {unit.status}</span>
                </th>
                {days.map((day, dayIndex) => {
                  const cell = unitCells[dayIndex];
                  const kind = cell ? nightKind(cell) : 'free';
                  const conflict = cell?.state === 'conflict';
                  const confirmed = kind === 'occupied';
                  const blockReasons = blocks.filter((b) => b.unitId === unit.id && cell?.entryIds.includes(b.id)).map((b) => b.reason);
                  const blocked = kind === 'blocked';
                  const hold = kind === 'held';
                  const requested = kind === 'request';
                  const rule = unitRules.find((r) => inNight(day, r.startDate, r.endDate));
                  const title = `${unit.name} · ${dayKey(day)}: ${conflict ? 'overlap / reconcile' : confirmed ? 'occupied' : blocked ? blockReasons.join(', ') : hold ? 'payment hold' : requested ? 'request only' : 'available'}${rule ? ` · rate override ฿${asBaht(rule.nightlyThb)}` : ''}`;
                  return <td key={dayKey(day)} title={title} className="border-b border-l border-border-line p-4 text-center">
                    <Link href={user.isAdmin || staffProjectIds.includes(unit.projectId) ? `/ops/calendar/${unit.id}` : `/mc/units/${unit.id}`} aria-label={title} className={`block rounded-md py-8 font-semibold ${conflict ? 'bg-red-100 text-red-800' : confirmed ? 'bg-brand-andaman text-white' : blocked ? 'bg-amber-100 text-amber-900' : hold ? 'bg-violet-100 text-violet-900' : requested ? 'bg-blue-50 text-blue-800' : 'text-text-secondary hover:bg-surface-ivory'}`}>{conflict ? '!' : confirmed ? '■' : blocked ? '×' : hold ? 'H' : requested ? '◇' : rule ? '·' : ' '}</Link>
                  </td>;
                })}
                <td className="border-b border-border-line px-12 text-right text-text-ink">฿{asBaht(unit.inventoryCategory?.baseNightlyThb ?? unit.baseNightlyThb)}</td>
                <td className="border-b border-border-line px-12 text-right text-text-ink">{ticketsByUnit.get(unit.id) ?? 0}</td>
              </tr>;
            })}</tbody>
          </table>
          {!units.length && <p className="p-24 text-text-secondary">No active management engagements in this scope.</p>}
        </div>
        <p className="mt-12 text-small text-text-secondary">Occupancy denominator excludes blocked nights; live payment holds reduce availability but do not count as occupied. Overlaps are shown separately for reconciliation.</p>
        <p className="mt-12 text-small text-text-secondary">A visual projection of canonical Booking, BlockedDate and PricingRule records, not a second availability store. Open a unit to make changes. Base rates are indicative; quotes remain authoritative for tax, seasonality and discounts.</p>
      </div>
    </main>
  );
}
