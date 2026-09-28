import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getStaffProjectIds } from '@/app/libs/projectScope';
import { getLabels } from '@/lib/i18n';
import { prisma } from '@/lib/prisma';
import {
  bangkokCalendarDay, calendarDays, projectCalendar, shiftCalendarDay, validCalendarDay,
} from '@/modules/booking/calendar-projection';
import type { CalendarEntry } from '@/modules/booking/calendar-projection';
import UnifiedStayCalendar from '@/components/ops/UnifiedStayCalendar';

export const dynamic = 'force-dynamic';

interface CalendarSearchParams {
  projectId?: string;
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

  const staffProjectIds = getStaffProjectIds(user);
  if (!user.isAdmin && !staffProjectIds.length) redirect('/');

  const projectWhere = user.isAdmin ? {} : { id: { in: staffProjectIds } };
  const projects = await prisma.project.findMany({
    where: projectWhere, select: { id: true, name: true }, orderBy: { name: 'asc' },
  });
  const authorizedIds = new Set(projects.map((project) => project.id));
  const requestedProjectId = searchParams?.projectId;
  const projectId = requestedProjectId && authorizedIds.has(requestedProjectId) ? requestedProjectId : '';
  const unitWhere = {
    status: { not: 'offboarded' as const },
    ...(!user.isAdmin ? { projectId: { in: staffProjectIds } } : {}),
    ...(projectId ? { projectId } : {}),
  };
  const units = await prisma.unit.findMany({
    where: unitWhere,
    select: {
      id: true, name: true, projectId: true, inventoryCategoryId: true, status: true,
      project: { select: { name: true, status: true } },
      inventoryCategory: { select: { name: true } },
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

  const today = bangkokCalendarDay();
  const start = searchParams?.start && validCalendarDay(searchParams.start) ? searchParams.start : today;
  const requestedDays = Number(searchParams?.days);
  const daysCount = [7, 14, 28].includes(requestedDays) ? requestedDays : 14;
  const days = calendarDays(start, daysCount);
  const end = shiftCalendarDay(start, daysCount);
  const unitIds = visibleUnits.map((unit) => unit.id);
  const dateWhere = {
    unitId: { in: unitIds },
    startDate: { lt: new Date(end + 'T00:00:00.000Z') },
    endDate: { gt: new Date(start + 'T00:00:00.000Z') },
  };
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
      'staff.unified_calendar.back': 'Back to operations',
      'staff.unified_calendar.work_queue': 'Stay operations →',
      'staff.unified_calendar.read_only': 'Calendar is read-only. All changes use the existing canonical booking and availability actions.',
      'staff.unified_calendar.source': 'Live myUNO database',
      'staff.unified_calendar.no_entries': 'No reservation or closure for this date.',
      'staff.unified_calendar.protected': 'Imported occupancy is protected as a calendar block until booking and payment identities are reconciled.',
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
      label: [booking.guestIdentity.firstName, booking.guestIdentity.lastName].filter(Boolean).join(' ') || 'Reservation',
    },
  ]));
  const blockDetails = Object.fromEntries(blocks.map((block) => [
    block.id, { id: block.id, kind: 'block' as const, status: block.reason,
      channel: null, label: block.note || block.reason.replace(/_/g, ' ') },
  ]));
  return <UnifiedStayCalendar
    labels={labels} today={today} start={start} days={days} daysCount={daysCount}
    projects={projects} categories={categories}
    units={visibleUnits.map((unit) => ({
      id: unit.id, name: unit.name, projectId: unit.projectId,
      projectName: unit.project.name, sellable: unit.status === 'live' && unit.project.status === 'live', categoryId: unit.inventoryCategoryId,
      categoryName: unit.inventoryCategory?.name ?? 'Uncategorized',
    }))}
    allUnits={categoryUnits.map((unit) => ({ id: unit.id, name: unit.name }))}
    projectId={projectId} categoryId={categoryId} unitId={unitId}
    cells={cells} entries={{ ...bookingDetails, ...blockDetails }}
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
