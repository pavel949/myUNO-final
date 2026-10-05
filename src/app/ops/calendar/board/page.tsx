import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getDepartmentProjectIds, getMCProjectScopes } from '@/app/libs/projectScope';
import { getMCManagedUnits } from '@/modules/projects';
import { getLabels } from '@/lib/i18n';
import { prisma } from '@/lib/prisma';
import {
  bangkokCalendarDay, calendarDays, projectCalendar, shiftCalendarDay, validCalendarDay,
} from '@/modules/booking';
import type { CalendarEntry } from '@/modules/booking';
import UnifiedStayCalendar from '@/components/ops/UnifiedStayCalendar';
import { allExcludedSourceControlledUnitIds } from '@/modules/booking/source-authority';
import { computeCanonicalCalendarRates } from '@/modules/core';
import { getOperatingSpaceMembership, getOperatingSpaceUnitIds, getUnitReadinessMap } from '@/modules/ops';
import { getChannelHealthForUnits } from '@/modules/integrations';

export const dynamic = 'force-dynamic';

interface CalendarSearchParams {
  spaceId?: string;
  mc?: string;
  projectId?: string;
  organizationId?: string;
  categoryId?: string;
  unitId?: string;
  start?: string;
  days?: string;
}
export default async function UnifiedStayCalendarPage({
  searchParams,
}: { searchParams?: CalendarSearchParams }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/ops/calendar/board');

  const staffProjectIds = await getDepartmentProjectIds(user,['reservations','front_desk','housekeeping','maintenance','guest_care','pricing']);
  const requestedSpaceId = typeof searchParams?.spaceId === 'string' ? searchParams.spaceId : '';
  const spaceMembership = requestedSpaceId && !user.isAdmin
    ? await getOperatingSpaceMembership(prisma, requestedSpaceId, user.identityId)
    : null;
  if (requestedSpaceId && !user.isAdmin && !spaceMembership?.active) redirect('/ops/spaces');
  const spaceUnitIds = requestedSpaceId
    ? await getOperatingSpaceUnitIds(prisma, requestedSpaceId)
    : [];
  const requestedProjectId = searchParams?.projectId;
  const requestedOrganizationId = searchParams?.organizationId;
  // Explicit mc=1 keeps a dual-role user inside the management-company
  // authorization boundary even when viewing all of their managed projects.
  const mcMode = !user.isAdmin && (
    searchParams?.mc === '1' || Boolean(requestedOrganizationId) || staffProjectIds.length === 0
  );
  // MC project roles alone are NOT unit authorization: every physical unit
  // must also be covered by the matching active management engagement.
  const mcScopes = mcMode ? getMCProjectScopes(user) : [];
  if (mcMode && mcScopes.length === 0) redirect('/');

  const requestedScopes = mcMode
    ? mcScopes.filter((scope) =>
        (!requestedOrganizationId || scope.organizationId === requestedOrganizationId) &&
        (!requestedProjectId || scope.projectId === requestedProjectId)
      )
    : [];
  const hasExplicitScopeRequest = Boolean(requestedOrganizationId || requestedProjectId);
  // A forged or stale MC scope must never widen access. When an explicit scope
  // is invalid, fall back to one real authorized scope rather than silently
  // switching to "all managed" or returning misleading blank filter state.
  const effectiveScopes = mcMode
    ? requestedScopes.length
      ? requestedScopes
      : hasExplicitScopeRequest
        ? mcScopes.slice(0, 1)
        : mcScopes
    : [];

  const managedUnitLists = mcMode
    ? await Promise.all(effectiveScopes.map((scope) =>
        getMCManagedUnits(prisma, user.identityId, scope.projectId, scope.organizationId)
      ))
    : [];
  const managedIds = Array.from(new Set(managedUnitLists.flat().map((unit) => unit.id)));
  const mcProjectIds = Array.from(new Set(mcScopes.map((scope) => scope.projectId)));
  const projectWhere = user.isAdmin ? {} : mcMode
    ? { id: { in: mcProjectIds } }
    : { id: { in: staffProjectIds } };
  const [projects, sourceExcludedUnitIds] = await Promise.all([
    prisma.project.findMany({
      where: projectWhere, select: { id: true, name: true }, orderBy: { name: 'asc' },
    }),
    allExcludedSourceControlledUnitIds(prisma),
  ]);
  const sourceExcluded = new Set(sourceExcludedUnitIds);
  const authorizedIds = new Set(projects.map((project) => project.id));
  const fallbackScope = mcMode && hasExplicitScopeRequest ? effectiveScopes[0] : undefined;
  const projectId =
    requestedProjectId && authorizedIds.has(requestedProjectId) &&
    (!mcMode || effectiveScopes.some((scope) => scope.projectId === requestedProjectId))
      ? requestedProjectId
      : fallbackScope?.projectId ?? '';
  const organizationId =
    mcMode
      ? requestedOrganizationId &&
        effectiveScopes.some((scope) => scope.organizationId === requestedOrganizationId)
        ? requestedOrganizationId
        : fallbackScope?.organizationId ?? ''
      : '';
  const unitWhere = {
    status: { not: 'offboarded' as const },
    ...(requestedSpaceId
      ? user.isAdmin
        ? { id: { in: spaceUnitIds } }
        : mcMode
          ? { id: { in: spaceUnitIds.filter((id) => managedIds.includes(id)) } }
          : { id: { in: spaceUnitIds }, projectId: { in: staffProjectIds } }
      : mcMode
        ? { id: { in: managedIds } }
        : !user.isAdmin
          ? { projectId: { in: staffProjectIds } }
          : {}),
    ...(projectId ? { projectId } : {}),
  };
  const units = await prisma.unit.findMany({
    where: unitWhere,
    select: {
      id: true, name: true, projectId: true, inventoryCategoryId: true, status: true,
      project: { select: { name: true, status: true, projectType: true } },
      inventoryCategory: { select: { name: true, status: true } },
      commercialOfferings: { select: { offeringType: true, status: true } },
    },
    orderBy: [{ project: { name: 'asc' } }, { inventoryCategory: { name: 'asc' } }, { name: 'asc' }],
  });
  const categories = Array.from(
    new Map(units.filter((unit) => unit.inventoryCategoryId).map((unit) => [
      unit.inventoryCategoryId as string,
      { id: unit.inventoryCategoryId as string, name: unit.inventoryCategory?.name || 'Uncategorized' },
    ])).values(),
  );
  const categoryId = searchParams?.categoryId && categories.some((c) => c.id === searchParams.categoryId)
    ? searchParams.categoryId : '';
  const categoryUnits = categoryId ? units.filter((unit) => unit.inventoryCategoryId === categoryId) : units;
  const unitId = searchParams?.unitId && categoryUnits.some((unit) => unit.id === searchParams.unitId)
    ? searchParams.unitId : '';
  const visibleUnits = unitId ? categoryUnits.filter((unit) => unit.id === unitId) : categoryUnits;
  const isUnitSellable = (unit: (typeof visibleUnits)[number]) =>
    unit.status === 'live' &&
    unit.project.status === 'live' &&
    unit.inventoryCategory?.status === 'live' &&
    !sourceExcluded.has(unit.id) &&
    (
      !unit.project.projectType ||
      unit.commercialOfferings.some((offer) =>
        ['short_term_stay', 'short_stay'].includes(offer.offeringType) &&
        offer.status === 'active'
      )
    );

  const today = bangkokCalendarDay();
  const start = searchParams?.start && validCalendarDay(searchParams.start) ? searchParams.start : today;
  const requestedDays = Number(searchParams?.days);
  const daysCount = [7, 14, 30].includes(requestedDays) ? requestedDays : 14;
  const days = calendarDays(start, daysCount);
  const end = shiftCalendarDay(start, daysCount);
  const unitIds = visibleUnits.map((unit) => unit.id);
  const rangeStart = new Date(start + 'T00:00:00.000Z');
  const rangeEnd = new Date(end + 'T00:00:00.000Z');
  const dateWhere = {
    unitId: { in: unitIds },
    startDate: { lt: rangeEnd },
    endDate: { gt: rangeStart },
  };
  const readinessPromise = getUnitReadinessMap(prisma, unitIds);
  const channelHealthPromise = getChannelHealthForUnits(prisma, unitIds);
  // Quote only sellable stay inventory and bound concurrency so a 100-unit
  // portfolio cannot stampede the DB. Every line still comes from the same
  // canonical booking quote engine.
  const pricedUnits = visibleUnits.filter(isUnitSellable);
  const calendarRateResults: Array<
    readonly [string, Awaited<ReturnType<typeof computeCanonicalCalendarRates>>]
  > = [];
  const RATE_BATCH = 12;
  for (let offset = 0; offset < pricedUnits.length; offset += RATE_BATCH) {
    const batch = await Promise.all(
      pricedUnits.slice(offset, offset + RATE_BATCH).map(async (unit) => [
        unit.id,
        await computeCanonicalCalendarRates(
          prisma,
          unit.id,
          rangeStart,
          rangeEnd,
          1
        ),
      ] as const)
    );
    calendarRateResults.push(...batch);
  }
  const [readinessByUnit, channelHealthByUnit] = await Promise.all([
    readinessPromise,
    channelHealthPromise,
  ]);
  const calendarRatesByUnit = Object.fromEntries(calendarRateResults);

  // This is a projection only: Booking and BlockedDate remain the same
  // authoritative rows used by checkout, availability and unit operations.
  const [bookings, blocks, labels] = await Promise.all([
    prisma.booking.findMany({
      where: dateWhere,
      select: {
        id: true, unitId: true, startDate: true, endDate: true,
        status: true, channel: true, holdExpiresAt: true,
        guestIdentity: { select: { firstName: true, lastName: true } },
      },
      orderBy: { startDate: 'asc' },
    }),
    prisma.blockedDate.findMany({
      where: dateWhere,
      select: { id: true, unitId: true, startDate: true, endDate: true, reason: true, note: true },
    }),
    getLabels({
      'staff.unified_calendar.title': 'Portfolio stay calendar',
      'staff.unified_calendar.kicker': 'ONE INVENTORY · EVERY CHANNEL',
      'staff.unified_calendar.subtitle': 'Reservations, live holds and blocked nights from one source of truth.',
      'staff.unified_calendar.project': 'Property',
      'staff.unified_calendar.all_projects': 'All properties',
      'staff.unified_calendar.category': 'Category',
      'staff.unified_calendar.all_categories': 'All categories',
      'staff.unified_calendar.home': 'Home',
      'staff.unified_calendar.all_homes': 'All homes',
      'staff.unified_calendar.search': 'Search villas or properties',
      'staff.unified_calendar.prev': 'Previous',
      'staff.unified_calendar.next': 'Next',
      'staff.unified_calendar.today': 'Today',
      'staff.unified_calendar.refresh': 'Refresh calendar',
      'staff.unified_calendar.refresh_requested': 'Refresh requested',
      'staff.unified_calendar.conflict_warning': 'conflicting villa-nights. Review imported and canonical records before opening sales.',
      'staff.unified_calendar.days_suffix': ' days',
      'staff.unified_calendar.project_home': 'Property / Home',
      'staff.unified_calendar.available': 'Available',
      'staff.unified_calendar.not_sellable': 'Not on sale',
      'staff.unified_calendar.booked': 'Booked',
      'staff.unified_calendar.holds': 'Active holds',
      'staff.unified_calendar.arrivals': 'Arrivals',
      'staff.unified_calendar.departures': 'Departures',
      'staff.unified_calendar.empty': 'No homes in this scope.',
      'staff.unified_calendar.inspect': 'Night details',
      'staff.unified_calendar.open_unit': 'Open home calendar',
      'staff.unified_calendar.open_stay': 'Open canonical stay',
      'staff.unified_calendar.manage_block': 'Manage availability block',
      'staff.unified_calendar.back': 'Back to operations',
      'staff.unified_calendar.work_queue': 'Stay operations →',
      'staff.unified_calendar.read_only': 'Calendar is read-only. All changes use the existing canonical booking and availability actions.',
      'staff.unified_calendar.source': 'Live myUNO database',
      'staff.unified_calendar.no_entries': 'No reservation or closure for this date.',
      'staff.unified_calendar.protected': 'Imported occupancy is protected as a calendar block until booking and payment identities are reconciled.',
      'staff.unified_calendar.readiness': 'Readiness',
      'staff.unified_calendar.ready': 'Ready',
      'staff.unified_calendar.needs_cleaning': 'Needs cleaning',
      'staff.unified_calendar.needs_inspection': 'Needs inspection',
      'staff.unified_calendar.in_progress': 'In progress',
      'staff.unified_calendar.channel_health': 'Channels',
      'staff.unified_calendar.channel_warning': 'homes do not have fully verified healthy ARI. iCal/manual channels do not push rates or restrictions.',
      'staff.unified_calendar.rate_unavailable': 'Rate unavailable',
      'staff.unified_calendar.effective_rate': 'Effective daily rate',
      'staff.unified_calendar.tasks': 'Housekeeping & readiness →',
    }),
  ]);

  const entries: CalendarEntry[] = [
    ...bookings.map((booking) => ({
      id: booking.id, unitId: booking.unitId, kind: 'booking' as const,
      startDate: booking.startDate.toISOString().slice(0, 10),
      endDate: booking.endDate.toISOString().slice(0, 10),
      status: booking.status, channel: booking.channel,
      holdExpiresAt: booking.holdExpiresAt?.toISOString() ?? null,
    })),
    ...blocks.map((block) => ({
      id: block.id, unitId: block.unitId, kind: 'block' as const,
      startDate: block.startDate.toISOString().slice(0, 10),
      endDate: block.endDate.toISOString().slice(0, 10),
      status: 'active', reason: block.reason,
    })),
  ];
  const now = new Date();
  const cells = projectCalendar(unitIds, days, entries, now);
  const bookingDetails = Object.fromEntries(bookings.map((booking) => [
    booking.id, {
      id: booking.id, kind: 'booking' as const, status: booking.status,
      channel: booking.channel,
      // MC's shared calendar exposes occupancy, not unrelated guest identity.
      label: mcMode ? 'Reservation' :
        [booking.guestIdentity.firstName, booking.guestIdentity.lastName].filter(Boolean).join(' ') || 'Reservation',
    },
  ]));
  const blockDetails = Object.fromEntries(blocks.map((block) => [
    block.id, { id: block.id, kind: 'block' as const, status: block.reason,
      channel: null, label: mcMode ? block.reason.replace(/_/g, ' ') :
        block.note || block.reason.replace(/_/g, ' ') },
  ]));
  return <UnifiedStayCalendar
    mode={mcMode ? 'mc' : 'staff'} organizationId={organizationId}
    labels={labels} today={today} start={start} days={days} daysCount={daysCount}
    projects={projects} categories={categories}
    units={visibleUnits.map((unit) => ({
      id: unit.id, name: unit.name, projectId: unit.projectId,
      projectName: unit.project.name,
      sellable: isUnitSellable(unit),
      categoryId: unit.inventoryCategoryId,
      categoryName: unit.inventoryCategory?.name ?? 'Uncategorized',
      readiness: readinessByUnit[unit.id]?.state ?? 'ready',
      openTaskCount: readinessByUnit[unit.id]?.openTaskCount ?? 0,
      channelState: channelHealthByUnit[unit.id]?.state ?? 'manual_only',
      channelRows: (channelHealthByUnit[unit.id]?.rows ?? []).map((row) => ({
        ...row,
        lastSyncAt: row.lastSyncAt?.toISOString() ?? null,
      })),
    }))}
    allUnits={categoryUnits.map((unit) => ({ id: unit.id, name: unit.name }))}
    projectId={projectId} categoryId={categoryId} unitId={unitId}
    cells={cells} entries={{ ...bookingDetails, ...blockDetails }}
    rates={Object.fromEntries(Object.entries(calendarRatesByUnit).map(([id, result]) => [
      id,
      {
        error: result.error,
        byDate: Object.fromEntries(result.lines.map((line) => [
          line.date,
          { nightlyThb: line.nightlyThb, source: line.source },
        ])),
      },
    ]))}
    arrivals={bookings.filter((booking) =>
      booking.startDate.toISOString().slice(0, 10) >= start &&
      booking.startDate.toISOString().slice(0, 10) < end &&
      ['confirmed', 'checked_in'].includes(booking.status)).length}
    departures={bookings.filter((booking) =>
      booking.endDate.toISOString().slice(0, 10) >= start &&
      booking.endDate.toISOString().slice(0, 10) < end &&
      ['confirmed', 'checked_in', 'checked_out', 'completed'].includes(booking.status)).length}
  />;
}
