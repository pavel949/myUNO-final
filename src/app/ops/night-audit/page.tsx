import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getStaffProjectIds, hasProjectDepartmentAccess } from '@/app/libs/projectScope';
import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';
import { bangkokCalendarDay, shiftCalendarDay, validCalendarDay } from '@/modules/booking/calendar-projection';

export const dynamic = 'force-dynamic';

function money(satang: number) {
  return '฿' + (satang / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default async function DailyReconciliationPage({
  searchParams,
}: {
  searchParams?: { projectId?: string; date?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/ops/night-audit');

  const staffProjectIds = getStaffProjectIds(user);
  const projects = await prisma.project.findMany({
    where: user.isAdmin ? undefined : { id: { in: staffProjectIds } },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  if (!projects.length) notFound();

  const requestedProjectId = typeof searchParams?.projectId === 'string' ? searchParams.projectId : '';
  const projectId = projects.some((project) => project.id === requestedProjectId)
    ? requestedProjectId
    : projects[0].id;

  const [financeAccess, frontDeskAccess] = await Promise.all([
    hasProjectDepartmentAccess(user, projectId, 'finance'),
    hasProjectDepartmentAccess(user, projectId, 'front_desk'),
  ]);
  if (!financeAccess && !frontDeskAccess) notFound();

  const requestedDate = typeof searchParams?.date === 'string' ? searchParams.date : '';
  const day = validCalendarDay(requestedDate) ? requestedDate : bangkokCalendarDay();
  const nextDay = shiftCalendarDay(day, 1);

  // Booking dates are PostgreSQL DATE values; financial/task timestamps use Bangkok-day boundaries.
  const bookingStart = new Date(day + 'T00:00:00.000Z');
  const bookingEnd = new Date(nextDay + 'T00:00:00.000Z');
  const timestampStart = new Date(day + 'T00:00:00+07:00');
  const timestampEnd = new Date(nextDay + 'T00:00:00+07:00');

  const [arrivals, departures, inHouse, ledger, openTasks] = await Promise.all([
    prisma.booking.count({
      where: { projectId, startDate: { gte: bookingStart, lt: bookingEnd }, status: { in: ['confirmed','checked_in','checked_out','completed'] } },
    }),
    prisma.booking.count({
      where: { projectId, endDate: { gte: bookingStart, lt: bookingEnd }, status: { in: ['confirmed','checked_in','checked_out','completed'] } },
    }),
    prisma.booking.count({
      where: { projectId, startDate: { lte: bookingStart }, endDate: { gt: bookingStart }, status: { in: ['confirmed','checked_in'] } },
    }),
    prisma.ledgerEntry.findMany({
      where: { projectId, occurredOn: { gte: timestampStart, lt: timestampEnd } },
      select: { id: true, entryType: true, amountThb: true, description: true, occurredOn: true, unit: { select: { name: true } } },
      orderBy: { occurredOn: 'desc' },
    }),
    prisma.operationalTask.findMany({
      where: {
        unit: { projectId },
        status: { in: ['planned','assigned','in_progress','inspected','blocked'] },
        OR: [
          { dueAt: { gte: timestampStart, lt: timestampEnd } },
          { status: 'blocked' },
        ],
      },
      select: { id: true, title: true, taskType: true, status: true, dueAt: true, unit: { select: { name: true } } },
      orderBy: { dueAt: 'asc' },
      take: 50,
    }),
  ]);

  const ledgerByType = new Map<string, { count: number; amount: number }>();
  for (const entry of ledger) {
    const current = ledgerByType.get(entry.entryType) ?? { count: 0, amount: 0 };
    current.count += 1;
    current.amount += entry.amountThb;
    ledgerByType.set(entry.entryType, current);
  }
  const netMovement = ledger.reduce((sum, entry) => sum + entry.amountThb, 0);
  const blockedTasks = openTasks.filter((task) => task.status === 'blocked').length;

  const labels = await getLabels({
    'staff.close.kicker': 'PMS control',
    'staff.close.title': 'Daily reconciliation',
    'staff.close.subtitle': 'One operational view of stay movement, append-only finance and unresolved work for the selected Bangkok day.',
    'staff.close.project': 'Project',
    'staff.close.date': 'Business day',
    'staff.close.arrivals': 'Arrivals',
    'staff.close.departures': 'Departures',
    'staff.close.in_house': 'In house',
    'staff.close.net': 'Net ledger movement',
    'staff.close.ledger': 'Ledger movements',
    'staff.close.tasks': 'Open operational work',
    'staff.close.blocked': 'Blocked',
    'staff.close.no_ledger': 'No ledger movements recorded for this day.',
    'staff.close.no_tasks': 'No open work due for this day.',
    'staff.close.finance_board': 'Open financial reconciliation',
    'staff.close.back': 'Operations',
    'staff.close.read_only': 'This is a canonical read model. Corrections stay in the existing booking, ledger, refund and payout writers.',
  });

  const queryFor = (next: { projectId?: string; date?: string }) => {
    const query = new URLSearchParams({ projectId, date: day });
    if (next.projectId) query.set('projectId', next.projectId);
    if (next.date) query.set('date', next.date);
    return '/ops/night-audit?' + query.toString();
  };

  return (
    <main className="stitch-workspace p-16 md:p-32">
      <div className="mx-auto max-w-7xl space-y-20">
        <Link href={'/ops?projectId='+encodeURIComponent(projectId)} className="text-small font-semibold text-brand-andaman">
          ← {labels['staff.close.back']}
        </Link>

        <header className="stitch-hero-dark">
          <p className="stitch-kicker text-brand-sun-soft">{labels['staff.close.kicker']}</p>
          <h1 className="mt-8 font-display text-display-xl font-semibold">{labels['staff.close.title']}</h1>
          <p className="mt-8 max-w-3xl text-body text-white/70">{labels['staff.close.subtitle']}</p>
        </header>

        <section className="stitch-panel p-16">
          <form className="grid gap-12 md:grid-cols-[minmax(220px,1fr)_220px_auto] md:items-end">
            <label className="text-small font-semibold text-text-secondary">
              {labels['staff.close.project']}
              <select name="projectId" defaultValue={projectId} className="stitch-control mt-4 w-full">
                {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
              </select>
            </label>
            <label className="text-small font-semibold text-text-secondary">
              {labels['staff.close.date']}
              <input name="date" type="date" defaultValue={day} className="stitch-control mt-4 w-full" />
            </label>
            <button type="submit" className="h-48 rounded-md bg-brand-deep px-16 text-small font-semibold text-white">Apply</button>
          </form>
          <div className="mt-12 flex gap-8">
            <Link href={queryFor({ date: shiftCalendarDay(day,-1) })} className="rounded-md border border-border-line px-12 py-8 text-small font-semibold">←</Link>
            <Link href={queryFor({ date: bangkokCalendarDay() })} className="rounded-md border border-border-line px-12 py-8 text-small font-semibold">Today</Link>
            <Link href={queryFor({ date: shiftCalendarDay(day,1) })} className="rounded-md border border-border-line px-12 py-8 text-small font-semibold">→</Link>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-12 md:grid-cols-4">
          {[
            [labels['staff.close.arrivals'], String(arrivals)],
            [labels['staff.close.departures'], String(departures)],
            [labels['staff.close.in_house'], String(inHouse)],
            [labels['staff.close.net'], money(netMovement)],
          ].map(([label,value]) => (
            <div key={label} className="stitch-panel p-16">
              <p className="text-small text-text-secondary">{label}</p>
              <p className="mt-4 font-display text-heading-2 font-bold font-tabular">{value}</p>
            </div>
          ))}
        </section>

        <div className="grid gap-16 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
          <section className="stitch-panel overflow-hidden">
            <div className="border-b border-border-line p-16">
              <h2 className="font-display text-heading-2 font-semibold">{labels['staff.close.ledger']}</h2>
              <div className="mt-8 flex flex-wrap gap-8">
                {Array.from(ledgerByType.entries()).map(([type, summary]) => (
                  <span key={type} className="rounded-full bg-surface-ivory px-10 py-4 text-small">
                    {type.replace(/_/g,' ')} · {summary.count} · {money(summary.amount)}
                  </span>
                ))}
              </div>
            </div>
            {ledger.length === 0 ? <p className="p-16 text-small text-text-secondary">{labels['staff.close.no_ledger']}</p> :
              ledger.map((entry) => (
                <article key={entry.id} className="grid gap-8 border-b border-border-line p-16 last:border-0 md:grid-cols-[160px_1fr_160px]">
                  <div><p className="font-semibold capitalize">{entry.entryType.replace(/_/g,' ')}</p><p className="text-small text-text-secondary">{entry.unit?.name || '—'}</p></div>
                  <p className="text-small text-text-secondary">{entry.description}</p>
                  <p className="text-right font-mono font-semibold tabular-nums">{money(entry.amountThb)}</p>
                </article>
              ))}
          </section>

          <section className="stitch-panel overflow-hidden">
            <div className="border-b border-border-line p-16">
              <h2 className="font-display text-heading-2 font-semibold">{labels['staff.close.tasks']}</h2>
              <p className="mt-4 text-small text-text-secondary">{labels['staff.close.blocked']}: {blockedTasks}</p>
            </div>
            {openTasks.length === 0 ? <p className="p-16 text-small text-text-secondary">{labels['staff.close.no_tasks']}</p> :
              openTasks.map((task) => (
                <Link key={task.id} href={'/ops/tasks?unitId='+encodeURIComponent(task.unit.name)}
                  className="block border-b border-border-line p-16 last:border-0 hover:bg-surface-ivory">
                  <p className="font-semibold">{task.title || task.taskType.replace(/_/g,' ')}</p>
                  <p className="mt-4 text-small text-text-secondary">{task.unit.name} · {task.status.replace(/_/g,' ')}</p>
                </Link>
              ))}
          </section>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-12">
          <p className="max-w-3xl text-small text-text-secondary">{labels['staff.close.read_only']}</p>
          {user.isAdmin ? (
            <Link href="/admin/finance/reconciliation" className="rounded-md bg-brand-deep px-16 py-12 text-small font-semibold text-white">
              {labels['staff.close.finance_board']} →
            </Link>
          ) : null}
        </div>
      </div>
    </main>
  );
}
