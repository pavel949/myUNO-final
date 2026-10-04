/* eslint-disable local-rules/no-literal-ui-text */
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { hasManagedUnitMcAccess } from '@/app/libs/projectScope';
import { prisma } from '@/lib/prisma';
import { getUnitReadinessMap } from '@/modules/ops';
import { getChannelHealthForUnits } from '@/modules/integrations';

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
      project: { select: { name: true } },
      inventoryCategory: { select: { id: true, name: true, baseNightlyThb: true } },
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

  const [readinessMap, channelMap, bookings, tasks, tickets, blocks, rules, statements, ledger, audit] = await Promise.all([
    getUnitReadinessMap(prisma, [unit.id]),
    getChannelHealthForUnits(prisma, [unit.id]),
    prisma.booking.findMany({
      where: { unitId: unit.id, endDate: { gte: recentStart }, startDate: { lte: futureEnd } },
      select: {
        id: true, status: true, channel: true, startDate: true, endDate: true,
        totalThb: true, balanceDueThb: true, checkedInAt: true, checkedOutAt: true,
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
    prisma.blockedDate.findMany({
      where: { unitId: unit.id, endDate: { gte: now } },
      select: { id: true, startDate: true, endDate: true, reason: true, note: true },
      orderBy: { startDate: 'asc' }, take: 20,
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
  ]);

  const readiness = readinessMap[unit.id] ?? { state: 'ready', openTaskCount: 0 };
  const channel = channelMap[unit.id] ?? { state: 'manual_only', rows: [] };
  const activeBooking = bookings.find(b => b.startDate <= now && b.endDate > now && ['confirmed','checked_in'].includes(b.status));
  const nextBooking = bookings.find(b => b.startDate > now && ['requested','pending_payment','confirmed'].includes(b.status));
  const upcomingBalance = bookings.reduce((sum,b) => sum + Math.max(0,b.balanceDueThb),0);
  const activeEngagement = unit.engagements[0];

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
              {focusDate && <span className={pill}>Context date · {focusDate}</span>}
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

      <nav className="mb-20 overflow-x-auto border-b border-border-line">
        <div className="flex min-w-max gap-4">
          {TABS.map(item => <Link key={item} href={tabHref(unit.id,item,focusDate)}
            className={`px-12 py-10 text-small font-semibold capitalize ${tab===item?'border-b-2 border-brand-andaman text-brand-andaman':'text-text-secondary'}`}>
            {item}
          </Link>)}
        </div>
      </nav>

      {tab==='overview' && <div className="space-y-20">
        <section className="grid gap-12 md:grid-cols-2 xl:grid-cols-5">
          <div className={card}><p className={small}>Current stay</p><p className="mt-4 font-semibold">{activeBooking ? activeBooking.guestIdentity.firstName+' '+activeBooking.guestIdentity.lastName : 'Vacant'}</p></div>
          <div className={card}><p className={small}>Readiness</p><p className="mt-4 font-semibold capitalize">{readiness.state.replace(/_/g,' ')}</p><p className={small}>{readiness.openTaskCount} open tasks</p></div>
          <div className={card}><p className={small}>Channels</p><p className="mt-4 font-semibold capitalize">{channel.state.replace(/_/g,' ')}</p><p className={small}>{channel.rows.length} mapped channels</p></div>
          <div className={card}><p className={small}>Outstanding</p><p className="mt-4 font-semibold">{money(upcomingBalance)}</p><p className={small}>booking balance</p></div>
          <div className={card}><p className={small}>Next arrival</p><p className="mt-4 font-semibold">{nextBooking ? date(nextBooking.startDate) : '—'}</p><p className={small}>{nextBooking?.status.replace(/_/g,' ') || 'No upcoming stay'}</p></div>
        </section>
        <section className="grid gap-16 xl:grid-cols-2">
          <div className={card}><h2 className="font-display text-heading-2 font-semibold">Requires attention</h2><div className="mt-12 space-y-8">
            {readiness.state!=='ready' && <Link className="block rounded-md bg-surface-ivory p-12" href={tabHref(unit.id,'operations',focusDate)}>Readiness · {readiness.state.replace(/_/g,' ')} →</Link>}
            {channel.state!=='healthy' && <Link className="block rounded-md bg-surface-ivory p-12" href={tabHref(unit.id,'channels',focusDate)}>Channel health · {channel.state.replace(/_/g,' ')} →</Link>}
            {upcomingBalance>0 && <Link className="block rounded-md bg-surface-ivory p-12" href={tabHref(unit.id,'reservations',focusDate)}>Outstanding guest payments · {money(upcomingBalance)} →</Link>}
            {tickets.length>0 && <Link className="block rounded-md bg-surface-ivory p-12" href={tabHref(unit.id,'operations',focusDate)}>Open issues · {tickets.length} →</Link>}
            {readiness.state==='ready' && channel.state==='healthy' && upcomingBalance===0 && tickets.length===0 && <p className={small}>No operational exceptions.</p>}
          </div></div>
          <div className={card}><h2 className="font-display text-heading-2 font-semibold">Quick actions</h2><div className="mt-12 grid gap-8 sm:grid-cols-2">
            <Link className="rounded-md border border-border-line p-12 font-semibold" href={`/mc/units/${unit.id}`}>Block dates / rate override →</Link>
            <Link className="rounded-md border border-border-line p-12 font-semibold" href={`/ops/tasks?mc=1&unitId=${unit.id}`}>Open tasks →</Link>
            <Link className="rounded-md border border-border-line p-12 font-semibold" href={tabHref(unit.id,'reservations',focusDate)}>Reservations →</Link>
            <Link className="rounded-md border border-border-line p-12 font-semibold" href={`/ops/units/${unit.id}/edit`}>Property & media →</Link>
          </div></div>
        </section>
      </div>}

      {tab==='calendar' && <section className={card}>
        <h2 className="font-display text-heading-2 font-semibold">Calendar & availability</h2>
        <p className="mt-8 text-body text-text-secondary">The portfolio calendar remains the read projection. Availability blocks and one-off price changes write through the canonical unit actions.</p>
        <div className="mt-16 flex flex-wrap gap-8">
          <Link href={`/mc/calendar?projectId=${unit.projectId}&unitId=${unit.id}${focusDate?'&start='+focusDate:''}`} className="rounded-md bg-brand-deep px-16 py-12 text-small font-semibold text-white">Open portfolio calendar</Link>
          <Link href={`/mc/units/${unit.id}`} className="rounded-md border border-border-line px-16 py-12 text-small font-semibold">Manage availability & pricing</Link>
        </div>
        <div className="mt-20 grid gap-12 md:grid-cols-2">
          <div><h3 className="font-semibold">Upcoming blocks</h3><div className="mt-8 space-y-6">{blocks.length?blocks.map(b=><p key={b.id} className={small}>{date(b.startDate)} → {date(b.endDate)} · {b.reason.replace(/_/g,' ')}{b.note?' · '+b.note:''}</p>):<p className={small}>No future blocks.</p>}</div></div>
          <div><h3 className="font-semibold">Upcoming rate overrides</h3><div className="mt-8 space-y-6">{rules.length?rules.map(r=><p key={r.id} className={small}>{date(r.startDate)} → {date(r.endDate)} · {money(r.nightlyThb)}{r.minNightsOverride?' · min '+r.minNightsOverride+' nights':''}</p>):<p className={small}>No future overrides.</p>}</div></div>
        </div>
      </section>}

      {tab==='reservations' && <section className="space-y-12">
        <div className="flex items-center justify-between"><h2 className="font-display text-heading-2 font-semibold">Reservations & stays</h2><Link href="/ops/reservations" className="text-small font-semibold text-brand-andaman">All reservations →</Link></div>
        {bookings.length===0?<div className={card}>No bookings in the working window.</div>:bookings.map(b=><article key={b.id} className={card}>
          <div className="flex flex-wrap items-center justify-between gap-8"><div><p className="font-semibold">{b.guestIdentity.firstName} {b.guestIdentity.lastName}</p><p className={small}>{date(b.startDate)} → {date(b.endDate)} · {b.channel} · {b.status.replace(/_/g,' ')}</p></div><div className="text-right"><p className="font-semibold">{money(b.totalThb)}</p><p className={small}>Due {money(b.balanceDueThb)}</p></div></div>
          <Link href={`/ops/stays/${b.id}`} className="mt-10 inline-flex text-small font-semibold text-brand-andaman">Open canonical stay →</Link>
        </article>)}
      </section>}

      {tab==='operations' && <div className="grid gap-16 xl:grid-cols-2">
        <section className={card}><div className="flex items-center justify-between"><h2 className="font-display text-heading-2 font-semibold">Tasks</h2><Link href={`/ops/tasks?mc=1&unitId=${unit.id}`} className="text-small font-semibold text-brand-andaman">Task queue →</Link></div><div className="mt-12 space-y-8">{tasks.length?tasks.map(t=><div key={t.id} className="rounded-md bg-surface-ivory p-12"><p className="font-semibold">{t.title||t.taskType.replace(/_/g,' ')}</p><p className={small}>{t.status.replace(/_/g,' ')} · due {date(t.dueAt)} · {t.priority}{t.blocksInventory?' · blocks inventory':''}</p></div>):<p className={small}>No open operational tasks.</p>}</div></section>
        <section className={card}><h2 className="font-display text-heading-2 font-semibold">Issues</h2><div className="mt-12 space-y-8">{tickets.length?tickets.map(t=><div key={t.id} className="rounded-md bg-surface-ivory p-12"><p className="font-semibold">{t.title}</p><p className={small}>{t.status.replace(/_/g,' ')} · {t.priority} · {date(t.createdAt)}</p></div>):<p className={small}>No open issues.</p>}</div></section>
      </div>}

      {tab==='rates' && <section className={card}><h2 className="font-display text-heading-2 font-semibold">Rates & restrictions</h2><p className="mt-8 text-body text-text-secondary">Category base rate remains canonical; unit rules are explicit overrides.</p><div className="mt-12 grid gap-8 md:grid-cols-3"><div><p className={small}>Category base</p><p className="font-semibold">{money(unit.inventoryCategory?.baseNightlyThb)}</p></div><div><p className={small}>Minimum stay</p><p className="font-semibold">{unit.minNights} nights</p></div><div><p className={small}>Booking mode</p><p className="font-semibold">{unit.instantBook?'Instant':'Request'}</p></div></div><Link href={`/mc/units/${unit.id}`} className="mt-16 inline-flex rounded-md bg-brand-deep px-16 py-12 text-small font-semibold text-white">Manage rate overrides →</Link></section>}

      {tab==='channels' && <section className={card}><h2 className="font-display text-heading-2 font-semibold">Channels</h2><p className="mt-8 text-body text-text-secondary">Health: <span className="font-semibold capitalize text-text-ink">{channel.state.replace(/_/g,' ')}</span></p><div className="mt-12 space-y-8">{channel.rows.length?channel.rows.map(row=><div key={row.channel} className="rounded-md bg-surface-ivory p-12"><p className="font-semibold">{row.channel}</p><p className={small}>{row.state.replace(/_/g,' ')} · A:{String(row.availability)} R:{String(row.rates)} I:{String(row.restrictions)}</p></div>):<p className={small}>No channel mapping. Inventory is manual-only.</p>}</div></section>}

      {tab==='financials' && <div className="grid gap-16 xl:grid-cols-2">
        <section className={card}><h2 className="font-display text-heading-2 font-semibold">Owner statements</h2><div className="mt-12 space-y-8">{statements.length?statements.map(s=><div key={s.id} className="rounded-md bg-surface-ivory p-12"><p className="font-semibold">{date(s.periodStart)} → {date(s.periodEnd)} · {s.status}</p><p className={small}>Revenue {money(s.grossRevenueTh)} · Costs {money(s.totalCostsTh)} · NOI {money(s.noiTh)} · Owner {money(s.ownerShareTh)}</p></div>):<p className={small}>No statements.</p>}</div></section>
        <section className={card}><h2 className="font-display text-heading-2 font-semibold">Ledger</h2><div className="mt-12 space-y-8">{ledger.length?ledger.map(l=><div key={l.id}><p className="font-semibold">{money(l.amountThb)} · {l.entryType.replace(/_/g,' ')}</p><p className={small}>{date(l.occurredOn)} · {l.description}</p></div>):<p className={small}>No ledger entries.</p>}</div></section>
      </div>}

      {tab==='owner' && <section className={card}><h2 className="font-display text-heading-2 font-semibold">Owner & management mandate</h2><div className="mt-12 grid gap-12 md:grid-cols-2"><div><p className={small}>Owner</p><p className="font-semibold">{unit.owner ? [unit.owner.firstName,unit.owner.lastName].filter(Boolean).join(' ') : 'Not assigned'}</p></div><div><p className={small}>Management organization</p><p className="font-semibold">{activeEngagement?.managementOrg?.name||'—'}</p></div><div><p className={small}>Engagement</p><p className="font-semibold">{activeEngagement?.engagementType.replace(/_/g,' ')||'—'}</p></div><div><p className={small}>Mandate period</p><p className="font-semibold">{activeEngagement ? date(activeEngagement.startsOn)+' → '+date(activeEngagement.endsOn) : '—'}</p></div><div><p className={small}>Fee override</p><p className="font-semibold">{activeEngagement?.feeOverridePct ? String(activeEngagement.feeOverridePct)+'%' : '—'}</p></div><div><p className={small}>NOI cap</p><p className="font-semibold">{money(activeEngagement?.noiCapAnnualThb)}</p></div></div></section>}

      {tab==='property' && <section className={card}><h2 className="font-display text-heading-2 font-semibold">Canonical property record</h2><div className="mt-12 grid gap-12 sm:grid-cols-2 lg:grid-cols-4"><div><p className={small}>Bedrooms</p><p className="font-semibold">{unit.bedrooms}</p></div><div><p className={small}>Bathrooms</p><p className="font-semibold">{unit.bathrooms}</p></div><div><p className={small}>Guests</p><p className="font-semibold">{unit.maxGuests}</p></div><div><p className={small}>Size</p><p className="font-semibold">{unit.sizeSqm||'—'} sqm</p></div><div><p className={small}>Floor</p><p className="font-semibold">{unit.floor||'—'}</p></div><div><p className={small}>Status</p><p className="font-semibold">{unit.status}</p></div><div><p className={small}>Asset status</p><p className="font-semibold">{unit.assetStatus}</p></div><div><p className={small}>Location</p><p className="font-semibold">{unit.addressSupplement}</p></div></div><Link href={`/ops/units/${unit.id}/edit`} className="mt-16 inline-flex rounded-md bg-brand-deep px-16 py-12 text-small font-semibold text-white">Edit canonical record →</Link></section>}

      {tab==='media' && <section className={card}><h2 className="font-display text-heading-2 font-semibold">Media</h2><p className="mt-8 text-body text-text-secondary">Unit gallery uses the canonical three-level project/category/unit media model.</p><Link href={`/ops/units/${unit.id}/edit`} className="mt-16 inline-flex rounded-md bg-brand-deep px-16 py-12 text-small font-semibold text-white">Open unit gallery editor →</Link></section>}

      {tab==='activity' && <section className={card}><h2 className="font-display text-heading-2 font-semibold">Activity</h2><div className="mt-12 space-y-8">{audit.length?audit.map(a=><div key={a.id} className="border-b border-border-line pb-8 last:border-0"><p className="font-semibold">{a.action}</p><p className={small}>{a.at.toISOString().replace('T',' ').slice(0,16)} · {a.entityType} · {a.actor ? [a.actor.firstName,a.actor.lastName].filter(Boolean).join(' ') : 'system'}</p></div>):<p className={small}>No unit-level audit events yet.</p>}</div></section>}
    </div>
  </main>;
}
