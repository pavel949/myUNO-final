/* eslint-disable local-rules/no-literal-ui-text */
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { hasManagedUnitMcAccess } from '@/app/libs/projectScope';
import { prisma } from '@/lib/prisma';
import { getUnitReadinessMap } from '@/modules/ops';
import { getChannelHealthForUnits } from '@/modules/integrations';
import { getLabels } from '@/lib/i18n';
import { UNIT_CALENDAR_LABEL_KEYS } from '@/app/libs/unitCalendarLabels';
import AvailabilityPricingPanel from '@/components/units/AvailabilityPricingPanel';
import { computeCanonicalCalendarRates } from '@/modules/core';

export const dynamic = 'force-dynamic';

const TABS = [
  'overview','calendar','reservations','operations','rates','channels',
  'financials','owner','property','media','activity',
] as const;
type Tab = (typeof TABS)[number];

function money(satang: number | null | undefined) {
  return '฿' + Math.round((satang || 0) / 100).toLocaleString();
}
function date(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : '—';
}
function bangkokDate(value: Date | null | undefined) {
  return value ? value.toLocaleDateString('en-GB',{timeZone:'Asia/Bangkok',day:'2-digit',month:'short',year:'numeric'}) : '—';
}
function bangkokDateTime(value: Date | null | undefined) {
  return value ? value.toLocaleString('en-GB',{timeZone:'Asia/Bangkok',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}) : '—';
}
function tabHref(unitId: string, tab: Tab, focusDate?: string) {
  const q = new URLSearchParams({ tab });
  if (focusDate) q.set('date', focusDate);
  return `/mc/properties/${encodeURIComponent(unitId)}?${q.toString()}`;
}

export default async function MCPropertyWorkspace({
  params,
  searchParams,
}: {
  params: { unitId: string };
  searchParams?: { tab?: string; date?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/mc/properties/${params.unitId}`);

  const unit = await prisma.unit.findUnique({
    where: { id: params.unitId },
    select: {
      id: true, name: true, projectId: true, status: true, assetStatus: true,
      bedrooms: true, bathrooms: true, maxGuests: true, sizeSqm: true, floor: true,
      addressSupplement: true, minNights: true, instantBook: true,
      project: { select: { name: true, coverMediaId: true, _count: { select: { media: true } } } },
      inventoryCategory: { select: { id: true, name: true, baseNightlyThb: true, coverMediaId: true, _count: { select: { media: true } } } },
      coverMediaId: true,
      _count: { select: { media: true } },
      owner: { select: { id: true, firstName: true, lastName: true } },
      engagements: {
        where: { status: 'active' },
        select: {
          id: true, engagementType: true, startsOn: true, endsOn: true,
          feeOverridePct: true, noiCapAnnualThb: true,
          managementOrg: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });
  if (!unit) notFound();
  if (!(await hasManagedUnitMcAccess(user, { projectId: unit.projectId, unitId: unit.id }))) notFound();

  const rawTab = typeof searchParams?.tab === 'string' ? searchParams.tab : 'overview';
  const tab: Tab = (TABS as readonly string[]).includes(rawTab) ? rawTab as Tab : 'overview';
  const focusDate = typeof searchParams?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.date)
    ? searchParams.date : undefined;
  const now = new Date();
  const recentStart = new Date(now); recentStart.setDate(recentStart.getDate() - 30);
  const futureEnd = new Date(now); futureEnd.setDate(futureEnd.getDate() + 90);

  const [readinessMap, channelMap, bookings, tasks, tickets, pricingRules, statements, ledger, audit, calendarLabels] = await Promise.all([
    getUnitReadinessMap(prisma, [unit.id]),
    getChannelHealthForUnits(prisma, [unit.id]),
    prisma.booking.findMany({
      where: { unitId: unit.id, endDate: { gte: recentStart }, startDate: { lte: futureEnd } },
      select: {
        id: true, status: true, channel: true, startDate: true, endDate: true,
        totalThb: true, balanceDueThb: true, requestExpiresAt: true, holdExpiresAt: true,
        checkedInAt: true, checkedOutAt: true,
        guestIdentity: { select: { firstName: true, lastName: true } },
      },
      orderBy: { startDate: 'asc' }, take: 40,
    }),
    prisma.operationalTask.findMany({
      where: { unitId: unit.id, status: { in: ['planned','assigned','in_progress','inspected','blocked'] } },
      select: {
        id: true, taskType: true, status: true, title: true, priority: true, dueAt: true,
        blocksInventory: true, assignedTeam: { select: { name: true } },
        assignee: { select: { firstName: true, lastName: true } },
      },
      orderBy: { dueAt: 'asc' }, take: 30,
    }),
    prisma.ticket.findMany({
      where: { unitId: unit.id, status: { in: ['open','acknowledged','in_progress','waiting_reporter'] } },
      select: { id: true, title: true, priority: true, status: true, createdAt: true },
      orderBy: { createdAt: 'desc' }, take: 20,
    }),
    prisma.pricingRule.findMany({
      where: { unitId: unit.id, endDate: { gte: now } },
      select: { id: true, startDate: true, endDate: true, nightlyThb: true, label: true, minNightsOverride: true },
      orderBy: { startDate: 'asc' }, take: 20,
    }),
    prisma.ownerStatement.findMany({
      where: { unitId: unit.id },
      select: { id: true, periodStart: true, periodEnd: true, status: true, grossRevenueTh: true, totalCostsTh: true, noiTh: true, ownerShareTh: true },
      orderBy: { periodEnd: 'desc' }, take: 12,
    }),
    prisma.ledgerEntry.findMany({
      where: { unitId: unit.id },
      select: { id: true, occurredOn: true, entryType: true, amountThb: true, description: true },
      orderBy: { occurredOn: 'desc' }, take: 30,
    }),
    prisma.auditLog.findMany({
      where: { entityId: unit.id },
      select: { id: true, action: true, entityType: true, at: true, actor: { select: { firstName: true, lastName: true } } },
      orderBy: { at: 'desc' }, take: 30,
    }),
    getLabels(UNIT_CALENDAR_LABEL_KEYS),
  ]);

  const readiness = readinessMap[unit.id] ?? { state: 'ready', openTaskCount: 0 };
  const channel = channelMap[unit.id] ?? { state: 'manual_only', rows: [] };
  const activeBooking = bookings.find(b => b.startDate <= now && b.endDate > now && ['confirmed','checked_in'].includes(b.status));
  const nextBooking = bookings.find(b => b.startDate > now && ['confirmed','checked_in'].includes(b.status));
  const upcomingBalance = bookings
    .filter(b => ['pending_payment','confirmed','checked_in'].includes(b.status))
    .reduce((sum,b) => sum + Math.max(0,b.balanceDueThb),0);
  const activeEngagement = unit.engagements[0];
  const currentBookings = bookings.filter(b => b.startDate <= now && b.endDate > now && !['cancelled','declined'].includes(b.status));
  const upcomingBookings = bookings.filter(b => b.startDate > now && !['cancelled','declined'].includes(b.status));
  const pastBookings = bookings.filter(b => b.endDate <= now || ['checked_out','completed'].includes(b.status));
  const cancelledBookings = bookings.filter(b => ['cancelled','declined'].includes(b.status));
  const bookingGroups = [
    ['Current',currentBookings],
    ['Upcoming',upcomingBookings],
    ['Past',pastBookings],
    ['Cancelled / declined',cancelledBookings],
  ] as const;
  const activeRule = pricingRules.find(rule => rule.startDate <= now && rule.endDate > now);
  const nextRule = pricingRules.find(rule => rule.startDate > now);
  const rateStart = new Date(now); rateStart.setUTCHours(0,0,0,0);
  const rateEnd = new Date(rateStart); rateEnd.setUTCDate(rateEnd.getUTCDate()+1);
  const ratePreview = tab==='rates' ? await computeCanonicalCalendarRates(prisma,unit.id,rateStart,rateEnd,1) : null;
  const todayRate = ratePreview?.lines[0] ?? null;
  const attentionDeadline = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  const expiringRequests = bookings.filter(b => b.status==='requested' && b.requestExpiresAt && b.requestExpiresAt <= attentionDeadline);
  const expiringHolds = bookings.filter(b => b.status==='pending_payment' && b.holdExpiresAt && b.holdExpiresAt <= attentionDeadline);
  const arrivalToday = bookings.find(b => b.status==='confirmed' && bangkokDate(b.startDate)===bangkokDate(now));
  const hasArrivalReadinessRisk = Boolean(arrivalToday && readiness.state!=='ready');

  const card = 'rounded-xl border border-border-line bg-surface-paper p-16';
  const small = 'text-small text-text-secondary';
  const pill = 'rounded-full bg-surface-ivory px-8 py-4 text-[11px] font-semibold';

  return <main className="min-h-screen bg-surface-ivory">
    <div className="mx-auto max-w-[1500px] px-16 py-24 md:px-32">
      <header className="mb-20">
        <div className="flex flex-wrap items-center justify-between gap-12">
          <div>
            <Link href="/mc" className="text-small font-semibold text-brand-andaman">← Today</Link>
            <div className="mt-8 flex flex-wrap items-center gap-8">
              <p className="text-small font-semibold uppercase tracking-[0.12em] text-brand-andaman">Property Workspace</p>
              {focusDate && <span className={pill}>Context date · {new Date(focusDate+'T00:00:00.000Z').toLocaleDateString('en-GB',{timeZone:'UTC',weekday:'short',day:'2-digit',month:'short'})}</span>}
            </div>
            <h1 className="mt-4 font-display text-display-xl font-semibold text-text-ink">{unit.name}</h1>
            <p className="mt-4 text-body text-text-secondary">{unit.project.name}{unit.inventoryCategory ? ' · '+unit.inventoryCategory.name : ''}</p>
          </div>
          <div className="flex flex-wrap gap-8">
            <Link href={`/mc/calendar?projectId=${encodeURIComponent(unit.projectId)}&unitId=${encodeURIComponent(unit.id)}${focusDate ? '&start='+encodeURIComponent(focusDate) : ''}`} className="rounded-md bg-brand-deep px-16 py-12 text-small font-semibold text-white">Open calendar</Link>
            <Link href={`/ops/units/${encodeURIComponent(unit.id)}/edit`} className="rounded-md border border-border-line bg-surface-paper px-16 py-12 text-small font-semibold">Edit property</Link>
          </div>
        </div>
      </header>

      <nav className="mb-20 overflow-x-auto border-b border-border-line" aria-label="Property workspace">
        <div className="flex min-w-max items-end gap-12">
          {[
            ['Operate',['overview','calendar','reservations','operations']],
            ['Commercial',['rates','channels','financials']],
            ['Property',['owner','property','media','activity']],
          ].map(([group,items]) => <div key={String(group)} className="flex items-end gap-2">
            <span className="px-4 pb-8 text-[10px] font-semibold uppercase tracking-[0.12em] text-text-secondary">{group}</span>
            {(items as readonly Tab[]).map(item => <Link key={item} href={tabHref(unit.id,item,focusDate)}
              className={`px-10 py-8 text-small font-semibold capitalize ${tab===item?'border-b-2 border-brand-andaman text-brand-andaman':'text-text-secondary'}`}>
              {item}
            </Link>)}
          </div>)}
        </div>
      </nav>

      {tab==='overview' && <div className="space-y-20">
        <section className="grid gap-12 md:grid-cols-2 xl:grid-cols-5">
          {activeBooking ? <Link href={`/ops/stays/${activeBooking.id}`} className={card+' transition hover:border-brand-andaman'}>
            <p className={small}>Current stay</p><p className="mt-4 font-semibold">{activeBooking.guestIdentity.firstName} {activeBooking.guestIdentity.lastName}</p>
            <p className={small}>{bangkokDate(activeBooking.startDate)} → {bangkokDate(activeBooking.endDate)} · {activeBooking.status.replace(/_/g,' ')}</p>
          </Link> : <div className={card}><p className={small}>Current stay</p><p className="mt-4 font-semibold">Vacant</p></div>}
          <Link href={tabHref(unit.id,'operations',focusDate)} className={card+' transition hover:border-brand-andaman'}><p className={small}>Readiness</p><p className="mt-4 font-semibold capitalize">{readiness.state.replace(/_/g,' ')}</p><p className={small}>{readiness.openTaskCount} open tasks</p></Link>
          <Link href={tabHref(unit.id,'channels',focusDate)} className={card+' transition hover:border-brand-andaman'}><p className={small}>Channels</p><p className="mt-4 font-semibold capitalize">{channel.state.replace(/_/g,' ')}</p><p className={small}>{channel.rows.length} mapped channels</p></Link>
          <Link href={tabHref(unit.id,'reservations',focusDate)} className={card+' transition hover:border-brand-andaman'}><p className={small}>Outstanding</p><p className="mt-4 font-semibold">{money(upcomingBalance)}</p><p className={small}>booking balance</p></Link>
          {nextBooking ? <Link href={`/ops/stays/${nextBooking.id}`} className={card+' transition hover:border-brand-andaman'}><p className={small}>Next arrival</p><p className="mt-4 font-semibold">{bangkokDate(nextBooking.startDate)}</p><p className={small}>{nextBooking.guestIdentity.firstName} {nextBooking.guestIdentity.lastName} · {nextBooking.status.replace(/_/g,' ')}</p></Link>
            : <div className={card}><p className={small}>Next arrival</p><p className="mt-4 font-semibold">—</p><p className={small}>No upcoming stay</p></div>}
        </section>
        <section className="grid gap-16 xl:grid-cols-2">
          <div className={card}><h2 className="font-display text-heading-2 font-semibold">Requires attention</h2><div className="mt-12 space-y-8">
            {readiness.state!=='ready' && <Link className="block rounded-md bg-surface-ivory p-12" href={tabHref(unit.id,'operations',focusDate)}>Readiness · {readiness.state.replace(/_/g,' ')} →</Link>}
            {channel.state!=='healthy' && <Link className="block rounded-md bg-surface-ivory p-12" href={tabHref(unit.id,'channels',focusDate)}>Channel health · {channel.state.replace(/_/g,' ')} →</Link>}
            {upcomingBalance>0 && <Link className="block rounded-md bg-surface-ivory p-12" href={tabHref(unit.id,'reservations',focusDate)}>Outstanding guest payments · {money(upcomingBalance)} →</Link>}
            {tickets.length>0 && <Link className="block rounded-md bg-surface-ivory p-12" href={tabHref(unit.id,'operations',focusDate)}>Open issues · {tickets.length} →</Link>}
            {expiringRequests.length>0 && <Link className="block rounded-md bg-amber-50 p-12" href={tabHref(unit.id,'reservations',focusDate)}>Booking requests expiring soon · {expiringRequests.length} →</Link>}
            {expiringHolds.length>0 && <Link className="block rounded-md bg-amber-50 p-12" href={tabHref(unit.id,'reservations',focusDate)}>Payment holds expiring soon · {expiringHolds.length} →</Link>}
            {hasArrivalReadinessRisk && <Link className="block rounded-md bg-red-50 p-12" href={tabHref(unit.id,'operations',focusDate)}>Arrival today · property not ready →</Link>}
            {readiness.state==='ready' && channel.state==='healthy' && upcomingBalance===0 && tickets.length===0 && expiringRequests.length===0 && expiringHolds.length===0 && !hasArrivalReadinessRisk && <p className={small}>No operational exceptions.</p>}
          </div></div>
          <div className={card}><h2 className="font-display text-heading-2 font-semibold">Quick actions</h2><div className="mt-12 grid gap-8 sm:grid-cols-2">
            <Link className="rounded-md border border-border-line p-12 font-semibold" href={tabHref(unit.id,'calendar',focusDate)}>Block dates / rate override →</Link>
            <Link className="rounded-md border border-border-line p-12 font-semibold" href={`/ops/tasks?mc=1&unitId=${unit.id}`}>Open tasks →</Link>
            <Link className="rounded-md border border-border-line p-12 font-semibold" href={tabHref(unit.id,'reservations',focusDate)}>Reservations →</Link>
            <Link className="rounded-md border border-border-line p-12 font-semibold" href={`/ops/units/${unit.id}/edit`}>Property & media →</Link>
          </div></div>
        </section>
      </div>}

      {tab==='calendar' && <div className="space-y-16">
        <section className={card}>
          <div className="flex flex-wrap items-start justify-between gap-12">
            <div>
              <h2 className="font-display text-heading-2 font-semibold">Calendar & availability</h2>
              <p className="mt-8 text-body text-text-secondary">Confirmed stays and live payment holds lock inventory automatically. Manual closures are stored as canonical BlockedDate records.</p>
              {focusDate && <p className="mt-8 text-small font-semibold text-brand-andaman">Selected date: {focusDate}</p>}
            </div>
            <Link href={`/mc/calendar?projectId=${unit.projectId}&unitId=${unit.id}${focusDate?'&start='+focusDate:''}`} className="rounded-md bg-brand-deep px-16 py-12 text-small font-semibold text-white">Open portfolio calendar</Link>
          </div>
        </section>
        <AvailabilityPricingPanel unitId={unit.id} labels={calendarLabels} initialDate={focusDate} />
      </div>}

      {tab==='reservations' && <section className="space-y-16">
        <div className="flex items-center justify-between"><h2 className="font-display text-heading-2 font-semibold">Reservations & stays</h2><Link href="/mc" className="text-small font-semibold text-brand-andaman">PMS Today →</Link></div>
        {bookings.length===0?<div className={card}>No stays from {bangkokDate(recentStart)} to {bangkokDate(futureEnd)}.</div>:
          bookingGroups.map(([group,items]) => items.length ? <section key={group}>
            <h3 className="mb-8 text-small font-semibold uppercase tracking-[0.08em] text-text-secondary">{group} · {items.length}</h3>
            <div className="space-y-8">{items.map(b=><article key={b.id} className={card}>
              <div className="flex flex-wrap items-center justify-between gap-8">
                <div>
                  <p className="font-semibold">{b.guestIdentity.firstName} {b.guestIdentity.lastName}</p>
                  <p className={small}>{bangkokDate(b.startDate)} → {bangkokDate(b.endDate)} · {b.channel.replace(/_/g,' ')}</p>
                  <span className={pill}>{b.status.replace(/_/g,' ')}</span>
                </div>
                <div className="text-right"><p className="font-semibold">{money(b.totalThb)}</p><p className={small}>Due {money(b.balanceDueThb)}</p></div>
              </div>
              <Link href={`/ops/stays/${b.id}`} className="mt-8 inline-flex text-small font-semibold text-brand-andaman">Open booking →</Link>
            </article>)}</div>
          </section> : null)}
      </section>}

      {tab==='operations' && <div className="grid gap-16 xl:grid-cols-2">
        <section className={card}><div className="flex items-center justify-between"><h2 className="font-display text-heading-2 font-semibold">Tasks</h2><Link href={`/ops/tasks?mc=1&unitId=${unit.id}`} className="text-small font-semibold text-brand-andaman">Task queue →</Link></div><div className="mt-12 space-y-8">{tasks.length?tasks.map(t=><Link key={t.id} href={`/ops/tasks?mc=1&unitId=${unit.id}#task-${t.id}`} className="block rounded-md bg-surface-ivory p-12 hover:ring-1 hover:ring-brand-andaman"><p className="font-semibold">{t.title||t.taskType.replace(/_/g,' ')}</p><p className={small}>{t.status.replace(/_/g,' ')} · due {bangkokDateTime(t.dueAt)} · {t.priority}{t.blocksInventory?' · blocks inventory':''}</p></Link>):<p className={small}>No open operational tasks.</p>}</div></section>
        <section className={card}><h2 className="font-display text-heading-2 font-semibold">Issues</h2><div className="mt-12 space-y-8">{tickets.length?tickets.map(t=><Link key={t.id} href={`/tickets/${t.id}`} className="block rounded-md bg-surface-ivory p-12 hover:ring-1 hover:ring-brand-andaman"><p className="font-semibold">{t.title}</p><p className={small}>{t.status.replace(/_/g,' ')} · {t.priority} · {bangkokDateTime(t.createdAt)}</p></Link>):<p className={small}>No open issues.</p>}</div></section>
      </div>}

      {tab==='rates' && <section className={card}>
        <h2 className="font-display text-heading-2 font-semibold">Rates & restrictions</h2>
        <p className="mt-8 text-body text-text-secondary">The canonical quote engine determines the effective sell rate; unit rules are explicit overrides.</p>
        <div className="mt-12 grid gap-8 md:grid-cols-3">
          <div><p className={small}>Effective today</p><p className="font-semibold">{todayRate?money(todayRate.nightlyThb):'Unavailable'}</p><p className={small}>{todayRate?.source.replace(/_/g,' ')||'Quote unavailable'}</p></div>
          <div><p className={small}>Category base</p><p className="font-semibold">{money(unit.inventoryCategory?.baseNightlyThb)}</p><p className={small}>Currency · THB</p></div>
          <div><p className={small}>Minimum stay</p><p className="font-semibold">{activeRule?.minNightsOverride??unit.minNights} nights</p><p className={small}>{activeRule?'Current unit override':'Property default'}</p></div>
          <div><p className={small}>Booking mode</p><p className="font-semibold">{unit.instantBook?'Instant book':'Request to book'}</p><p className={small}>{unit.instantBook?'Guest can hold inventory immediately while paying.':'Host approval is required before dates are held.'}</p></div>
          <div><p className={small}>Current rule</p><p className="font-semibold">{activeRule?money(activeRule.nightlyThb):'None'}</p><p className={small}>{activeRule?.label||'No unit-specific override today'}</p></div>
          <div><p className={small}>Next rule</p><p className="font-semibold">{nextRule?bangkokDate(nextRule.startDate):'—'}</p><p className={small}>{nextRule?money(nextRule.nightlyThb)+(nextRule.label?' · '+nextRule.label:''):'No upcoming override'}</p></div>
        </div>
        <Link href={tabHref(unit.id,'calendar',focusDate)} className="mt-16 inline-flex rounded-md bg-brand-deep px-16 py-12 text-small font-semibold text-white">Manage rate overrides →</Link>
      </section>}

      {tab==='channels' && <section className={card}><h2 className="font-display text-heading-2 font-semibold">Channels</h2><p className="mt-8 text-body text-text-secondary">Health: <span className="font-semibold capitalize text-text-ink">{channel.state.replace(/_/g,' ')}</span></p><div className="mt-12 space-y-8">{channel.rows.length?channel.rows.map(row=><div key={row.channel} className="rounded-md bg-surface-ivory p-12">
        <div className="flex flex-wrap items-center justify-between gap-8"><p className="font-semibold capitalize">{row.channel.replace(/_/g,' ')}</p><span className={pill}>{row.state.replace(/_/g,' ')}</span></div>
        <div className="mt-8 grid gap-6 sm:grid-cols-3 text-small">
          <p><span className="text-text-secondary">Availability</span><br/><span className="font-semibold">{row.availability==='push'?'✓ Live':row.availability==='ical'?'iCal sync':'Manual'}</span></p>
          <p><span className="text-text-secondary">Rates</span><br/><span className="font-semibold">{row.rates==='push'?'✓ Live':'Manual'}</span></p>
          <p><span className="text-text-secondary">Restrictions</span><br/><span className="font-semibold">{row.restrictions==='push'?'✓ Live':'Manual'}</span></p>
        </div>
        {'lastSyncAt' in row && row.lastSyncAt ? <p className={small+' mt-8'}>Last synced {bangkokDateTime(new Date(row.lastSyncAt))}</p> : null}
        {'error' in row && row.error ? <p className="mt-6 text-small text-state-error">{String(row.error)}</p> : null}
      </div>):<p className={small}>No channel mapping. Inventory is manual-only.</p>}</div></section>}

      {tab==='financials' && <div className="grid gap-16 xl:grid-cols-2">
        <section className={card}><h2 className="font-display text-heading-2 font-semibold">Owner statements</h2><div className="mt-12 space-y-8">{statements.length?statements.map(s=><div key={s.id} className="rounded-md bg-surface-ivory p-12"><p className="font-semibold">{date(s.periodStart)} → {date(s.periodEnd)} · {s.status}</p><p className={small}>Revenue {money(s.grossRevenueTh)} · Costs {money(s.totalCostsTh)} · NOI {money(s.noiTh)} · Owner {money(s.ownerShareTh)}</p></div>):<p className={small}>No statements.</p>}</div></section>
        <section className={card}><h2 className="font-display text-heading-2 font-semibold">Ledger</h2><div className="mt-12 space-y-8">{ledger.length?ledger.map(l=><div key={l.id}><p className="font-semibold">{money(l.amountThb)} · {l.entryType.replace(/_/g,' ')}</p><p className={small}>{date(l.occurredOn)} · {l.description}</p></div>):<p className={small}>No ledger entries.</p>}</div></section>
      </div>}

      {tab==='owner' && <section className={card}><h2 className="font-display text-heading-2 font-semibold">Owner & management mandate</h2><div className="mt-12 grid gap-12 md:grid-cols-2"><div><p className={small}>Owner</p><p className="font-semibold">{unit.owner ? [unit.owner.firstName,unit.owner.lastName].filter(Boolean).join(' ') : 'Not assigned'}</p></div><div><p className={small}>Management organization</p><p className="font-semibold">{activeEngagement?.managementOrg?.name||'—'}</p></div><div><p className={small}>Engagement</p><p className="font-semibold">{activeEngagement?.engagementType.replace(/_/g,' ')||'—'}</p></div><div><p className={small}>Mandate period</p><p className="font-semibold">{activeEngagement ? date(activeEngagement.startsOn)+' → '+date(activeEngagement.endsOn) : '—'}</p></div><div><p className={small}>Fee override</p><p className="font-semibold">{activeEngagement?.feeOverridePct != null ? String(activeEngagement.feeOverridePct)+'%' : '—'}</p></div><div><p className={small}>NOI cap</p><p className="font-semibold">{activeEngagement?.noiCapAnnualThb == null ? 'No cap' : money(activeEngagement.noiCapAnnualThb)}</p></div></div></section>}

      {tab==='property' && <section className={card}><h2 className="font-display text-heading-2 font-semibold">Canonical property record</h2><div className="mt-12 grid gap-12 sm:grid-cols-2 lg:grid-cols-4"><div><p className={small}>Bedrooms</p><p className="font-semibold">{unit.bedrooms}</p></div><div><p className={small}>Bathrooms</p><p className="font-semibold">{unit.bathrooms}</p></div><div><p className={small}>Guests</p><p className="font-semibold">{unit.maxGuests}</p></div><div><p className={small}>Size</p><p className="font-semibold">{unit.sizeSqm||'—'} sqm</p></div><div><p className={small}>Floor</p><p className="font-semibold">{unit.floor||'—'}</p></div><div><p className={small}>Status</p><p className="font-semibold">{unit.status}</p></div><div><p className={small}>Asset status</p><p className="font-semibold">{unit.assetStatus}</p></div><div><p className={small}>Location</p><p className="font-semibold">{unit.addressSupplement}</p></div></div><Link href={`/ops/units/${unit.id}/edit`} className="mt-16 inline-flex rounded-md bg-brand-deep px-16 py-12 text-small font-semibold text-white">Edit canonical record →</Link></section>}

      {tab==='media' && <section className={card}>
        <h2 className="font-display text-heading-2 font-semibold">Media</h2>
        <p className="mt-8 text-body text-text-secondary">Public presentation composes canonical project, category and unit galleries without duplicating files.</p>
        <div className="mt-12 grid gap-8 sm:grid-cols-3">
          <div className="rounded-md bg-surface-ivory p-12"><p className={small}>Project gallery</p><p className="font-semibold">{unit.project._count.media} photos</p><p className={small}>{unit.project.coverMediaId?'Cover set':'Cover missing'}</p></div>
          <div className="rounded-md bg-surface-ivory p-12"><p className={small}>Category gallery</p><p className="font-semibold">{unit.inventoryCategory?unit.inventoryCategory._count.media:0} photos</p><p className={small}>{unit.inventoryCategory?.coverMediaId?'Cover set':'Cover missing'}</p></div>
          <div className="rounded-md bg-surface-ivory p-12"><p className={small}>Unit gallery</p><p className="font-semibold">{unit._count.media} photos</p><p className={small}>{unit.coverMediaId?'Cover set':'Cover missing'}</p></div>
        </div>
        {(unit._count.media===0||!unit.coverMediaId) && <p className="mt-12 rounded-md bg-amber-50 p-12 text-small text-amber-900">Unit presentation is incomplete. Add exact-unit photos and choose a cover before publishing.</p>}
        <Link href={`/ops/units/${unit.id}/edit`} className="mt-16 inline-flex rounded-md bg-brand-deep px-16 py-12 text-small font-semibold text-white">Manage media →</Link>
      </section>}

      {tab==='activity' && <section className={card}><h2 className="font-display text-heading-2 font-semibold">Activity</h2><div className="mt-12 space-y-8">{audit.length?audit.map(a=><div key={a.id} className="border-b border-border-line pb-8 last:border-0"><p className="font-semibold">{a.action}</p><p className={small}>{bangkokDateTime(a.at)} ICT · {a.entityType} · {a.actor ? [a.actor.firstName,a.actor.lastName].filter(Boolean).join(' ') : 'system'}</p></div>):<p className={small}>No unit-level audit events yet.</p>}</div></section>}
    </div>
  </main>;
}
