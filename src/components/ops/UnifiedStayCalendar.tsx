/* eslint-disable local-rules/no-literal-ui-text */
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { shiftCalendarDay } from '@/modules/booking/calendar-projection';
import type { CalendarCell, CalendarState } from '@/modules/booking/calendar-projection';

interface UnitRow {
  id: string;
  name: string;
  projectId: string;
  projectName: string;
  categoryId: string | null;
  categoryName: string;
  sellable: boolean;
  readiness: 'ready' | 'needs_cleaning' | 'needs_inspection' | 'in_progress';
  openTaskCount: number;
  channelState: 'healthy' | 'delayed' | 'error' | 'connected' | 'manual_only';
  channelRows: Array<{
    channel: string;
    state: 'healthy' | 'delayed' | 'error' | 'connected' | 'manual_only';
    availability: 'push' | 'ical' | 'manual';
    rates: 'push' | 'manual';
    restrictions: 'push' | 'manual';
    lastSyncAt: string | Date | null;
    error: string | null;
  }>;
}
interface EntryDetail { id: string; kind: 'booking' | 'block'; status: string; channel: string | null; label: string }
type Props = {
  mode?: 'staff' | 'mc'; organizationId?: string;
  labels: Record<string, string>;
  today: string; start: string; days: string[]; daysCount: number;
  projects: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  units: UnitRow[];
  allUnits: { id: string; name: string }[];
  projectId: string; categoryId: string; unitId: string;
  cells: Record<string, CalendarCell[]>;
  entries: Record<string, EntryDetail>;
  rates: Record<string, {
    error: string | null;
    byDate: Record<string, { nightlyThb: number; source: string }>;
  }>;
  arrivals: number; departures: number;
};
const stateClass: Record<CalendarState, string> = {
  free: 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800',
  request: 'bg-sky-50 hover:bg-sky-100 text-sky-800',
  hold: 'bg-amber-100 hover:bg-amber-200 text-amber-900',
  confirmed: 'bg-teal-600 hover:bg-teal-700 text-white',
  in_house: 'bg-teal-800 hover:bg-teal-900 text-white',
  past: 'bg-slate-100 text-slate-500',
  owner: 'bg-violet-100 hover:bg-violet-200 text-violet-900',
  maintenance: 'bg-orange-100 hover:bg-orange-200 text-orange-900',
  external: 'bg-indigo-100 hover:bg-indigo-200 text-indigo-900',
  blocked: 'bg-slate-200 hover:bg-slate-300 text-slate-800',
  conflict: 'bg-red-600 hover:bg-red-700 text-white',
};
const stateLabel: Record<CalendarState, string> = {
  free:'Available', request:'Booking request', hold:'Payment hold', confirmed:'Confirmed booking',
  in_house:'Guest in house', past:'Past stay', owner:'Owner hold', maintenance:'Maintenance',
  external:'OTA/imported', blocked:'Blocked', conflict:'Conflict',
};
const shortLabel: Record<CalendarState, string> = {
  free:'', request:'REQ', hold:'PAY', confirmed:'BKD', in_house:'IN', past:'·',
  owner:'OWN', maintenance:'MNT', external:'OTA', blocked:'×', conflict:'!',
};

export default function UnifiedStayCalendar(props: Props) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [inventoryFilter, setInventoryFilter] = useState<'all'|'available'|'occupied'|'holds'|'blocked'|'not_sellable'>('all');
  const [readinessFilter, setReadinessFilter] = useState<'all'|'ready'|'attention'>('all');
  const [channelFilter, setChannelFilter] = useState<'all'|'healthy'|'attention'>('all');
  const [selected, setSelected] = useState<{unitId:string; date:string; cell:CalendarCell}|null>(null);
  const [mobileDate, setMobileDate] = useState(
    props.days.includes(props.today) ? props.today : (props.days[0] || props.start)
  );
  const [refreshRequestedAt, setRefreshRequestedAt] = useState<string|null>(null);
  const lastCursor = useRef<string|null|undefined>(undefined);
  const q = (patch: Record<string,string|null>) => {
    const params = new URLSearchParams();
    for (const [key,value] of Object.entries({
      mc:props.mode==='mc' ? '1' : '',
      projectId:props.projectId, organizationId:props.organizationId || '',
      categoryId:props.categoryId, unitId:props.unitId,
      start:props.start, days:String(props.daysCount), ...patch,
    })) if (value) params.set(key,value);
    return '/ops/calendar/board?' + params.toString();
  };
  const refresh = () => {
    router.refresh();
    setRefreshRequestedAt(new Date().toLocaleTimeString());
  };
  useEffect(() => {
    // Periodic revalidation is a fallback, not a claimed external push subscription.
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh();
    }, 15000);
    const onFocus = () => router.refresh();
    // The outbox cursor is a lightweight fallback to database notifications in
    // serverless deployments. Only actual changes trigger an extra full refresh.
    const watch = window.setInterval(async () => {
      // The event cursor is staff-scoped. MC users rely on the normal 15s
      // projection refresh, not a globally scoped event stream.
      if (props.mode === 'mc' || document.visibilityState !== 'visible') return;
      try {
        const response = await fetch('/api/ops/calendar/changes',{cache:'no-store'});
        if (!response.ok) return;
        const data = await response.json() as {cursor:string|null};
        if (lastCursor.current!==undefined && lastCursor.current!==data.cursor) router.refresh();
        lastCursor.current=data.cursor;
      } catch { /* the 15-second canonical refresh remains the fallback */ }
    }, 4000);
    window.addEventListener('focus',onFocus);
    window.addEventListener('myuno:calendar-changed',onFocus);
    return () => {
      window.clearInterval(interval);
      window.clearInterval(watch);
      window.removeEventListener('focus',onFocus);
      window.removeEventListener('myuno:calendar-changed',onFocus);
    };
  },[router, props.mode]);
  const rows = useMemo(() => props.units.filter((unit) => {
    const matchesSearch = (unit.name + ' ' + unit.projectName + ' ' + unit.categoryName)
      .toLocaleLowerCase().includes(search.toLocaleLowerCase().trim());
    if (!matchesSearch) return false;
    if (readinessFilter === 'ready' && unit.readiness !== 'ready') return false;
    if (readinessFilter === 'attention' && unit.readiness === 'ready') return false;
    if (channelFilter === 'healthy' && unit.channelState !== 'healthy') return false;
    if (channelFilter === 'attention' && unit.channelState === 'healthy') return false;
    if (inventoryFilter === 'all') return true;
    if (inventoryFilter === 'not_sellable') return !unit.sellable;
    const cells = props.cells[unit.id] || [];
    if (inventoryFilter === 'available') return unit.sellable && cells.some(cell => cell.state === 'free');
    if (inventoryFilter === 'occupied') return cells.some(cell => ['confirmed','in_house','external'].includes(cell.state));
    if (inventoryFilter === 'holds') return cells.some(cell => cell.state === 'hold');
    if (inventoryFilter === 'blocked') return cells.some(cell => ['owner','maintenance','blocked','conflict'].includes(cell.state));
    return true;
  }),[props.units,props.cells,search,inventoryFilter,readinessFilter,channelFilter]);
  useEffect(() => {
    if (!props.days.includes(mobileDate)) {
      setMobileDate(props.days.includes(props.today) ? props.today : (props.days[0] || props.start));
    }
  }, [mobileDate, props.days, props.start, props.today]);
  const mobileIndex = Math.max(0, props.days.indexOf(mobileDate));
  let booked=0, available=0, holds=0, conflicts=0;
  for (const unit of rows) for (const cell of props.cells[unit.id] || []) {
    if (cell.state==='free' && unit.sellable) available++;
    if (cell.state==='confirmed'||cell.state==='in_house'||cell.state==='external') booked++;
    if (cell.state==='hold') holds++;
    if (cell.state==='conflict') conflicts++;
  }
  const stats=[['Homes',String(rows.length)], [props.labels['staff.unified_calendar.available'],String(available)],
    [props.labels['staff.unified_calendar.not_sellable'],String(rows.filter(unit=>!unit.sellable).length)],
    [props.labels['staff.unified_calendar.booked'],String(booked)], [props.labels['staff.unified_calendar.holds'],String(holds)],
    [props.labels['staff.unified_calendar.ready'],String(rows.filter(unit=>unit.readiness==='ready').length)],
    [props.labels['staff.unified_calendar.readiness'],String(rows.filter(unit=>unit.readiness!=='ready').length)],
    [props.labels['staff.unified_calendar.arrivals'],String(props.arrivals)],
    [props.labels['staff.unified_calendar.departures'],String(props.departures)]];
  const channelAttention = rows.filter((unit) => unit.channelState !== 'healthy').length;
  const inspect=selected && props.units.find((unit)=>unit.id===selected.unitId);
  return <main className="min-h-screen bg-surface-ivory p-16 md:p-32">
    <div className="mx-auto max-w-[1600px] space-y-24">
      <header className="flex flex-wrap items-start justify-between gap-16">
        <div className="space-y-8">
          <Link href={props.mode==='mc' ? '/mc' : '/ops'} className="text-small font-semibold text-brand-andaman hover:underline">
            {props.labels['staff.unified_calendar.back']}
          </Link>
          <p className="text-kicker font-bold tracking-widest text-brand-andaman">
            {props.labels['staff.unified_calendar.kicker']}
          </p>
          <h1 className="font-display text-display-xl font-semibold text-text-ink">
            {props.labels['staff.unified_calendar.title']}
          </h1>
          <p className="max-w-2xl text-body text-text-secondary">{props.labels['staff.unified_calendar.subtitle']}</p>
        </div>
        <div className="flex flex-col items-end gap-8">
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-12 py-4 text-small font-semibold text-emerald-900">
            {props.labels['staff.unified_calendar.source']}
          </span>
          {props.mode!=='mc' && <Link href="/ops/stays" className="rounded-md bg-brand-deep px-16 py-8 text-small font-semibold text-white">
            {props.labels['staff.unified_calendar.work_queue']}
          </Link>}
          <button type="button" onClick={refresh} className="rounded-md border border-border-line bg-surface-paper px-16 py-8 text-small font-semibold text-text-ink hover:bg-surface-ivory">
            ↻ {props.labels['staff.unified_calendar.refresh']}
          </button>
          {refreshRequestedAt && <span className="text-small text-text-secondary">{props.labels['staff.unified_calendar.refresh_requested']} {refreshRequestedAt}</span>}
        </div>
      </header>

      <section aria-label="Calendar summary" className="grid grid-cols-2 gap-8 md:grid-cols-3 xl:grid-cols-6">
        {stats.map(([label,value]) => <div key={label} className="rounded-lg border border-border-line bg-surface-paper p-16">
          <p className="text-small text-text-secondary">{label}</p>
          <p className="mt-4 font-display text-heading-2 font-bold text-text-ink">{value}</p>
        </div>)}
      </section>
      {conflicts>0 && <div role="alert" className="rounded-md border border-red-300 bg-red-50 p-16 text-red-900">
        {conflicts} {props.labels['staff.unified_calendar.conflict_warning']}
      </div>}
      {channelAttention>0 && <div role="alert" className="rounded-md border border-amber-300 bg-amber-50 p-16 text-amber-950">
        {channelAttention} {props.labels['staff.unified_calendar.channel_warning']}
      </div>}
      <section aria-label="Calendar filters" className="rounded-lg border border-border-line bg-surface-paper p-16 md:p-24">
        <div className="grid grid-cols-1 gap-12 sm:grid-cols-2 xl:grid-cols-7">
          <label className="text-small font-semibold text-text-secondary">
            {props.labels['staff.unified_calendar.project']}
            <select value={props.projectId} onChange={(event)=>router.push(q({projectId:event.target.value,organizationId:null,categoryId:null,unitId:null}))}
              className="mt-4 h-40 w-full rounded-md border border-border-line bg-white px-12 text-text-ink">
              <option value="">{props.labels['staff.unified_calendar.all_projects']}</option>
              {props.projects.map((item)=><option value={item.id} key={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label className="text-small font-semibold text-text-secondary">
            {props.labels['staff.unified_calendar.category']}
            <select value={props.categoryId} onChange={(event)=>router.push(q({categoryId:event.target.value,unitId:null}))}
              className="mt-4 h-40 w-full rounded-md border border-border-line bg-white px-12 text-text-ink">
              <option value="">{props.labels['staff.unified_calendar.all_categories']}</option>
              {props.categories.map((item)=><option value={item.id} key={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label className="text-small font-semibold text-text-secondary">
            {props.labels['staff.unified_calendar.home']}
            <select value={props.unitId} onChange={(event)=>router.push(q({unitId:event.target.value}))}
              className="mt-4 h-40 w-full rounded-md border border-border-line bg-white px-12 text-text-ink">
              <option value="">{props.labels['staff.unified_calendar.all_homes']}</option>
              {props.allUnits.map((item)=><option value={item.id} key={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label className="text-small font-semibold text-text-secondary">
            {props.labels['staff.unified_calendar.search']}
            <input type="search" value={search} onChange={(event)=>setSearch(event.target.value)}
              placeholder={props.labels['staff.unified_calendar.search']}
              className="mt-4 h-40 w-full rounded-md border border-border-line bg-white px-12 text-text-ink"/>
          </label>
          <label className="text-small font-semibold text-text-secondary">
            Inventory
            <select value={inventoryFilter} onChange={(event)=>setInventoryFilter(event.target.value as typeof inventoryFilter)}
              className="mt-4 h-40 w-full rounded-md border border-border-line bg-white px-12 text-text-ink">
              <option value="all">All states</option><option value="available">Available</option>
              <option value="occupied">Occupied</option><option value="holds">Holds</option>
              <option value="blocked">Blocked / conflict</option><option value="not_sellable">Not sellable</option>
            </select>
          </label>
          <label className="text-small font-semibold text-text-secondary">
            Readiness
            <select value={readinessFilter} onChange={(event)=>setReadinessFilter(event.target.value as typeof readinessFilter)}
              className="mt-4 h-40 w-full rounded-md border border-border-line bg-white px-12 text-text-ink">
              <option value="all">All</option><option value="ready">Ready</option><option value="attention">Needs attention</option>
            </select>
          </label>
          <label className="text-small font-semibold text-text-secondary">
            Channels
            <select value={channelFilter} onChange={(event)=>setChannelFilter(event.target.value as typeof channelFilter)}
              className="mt-4 h-40 w-full rounded-md border border-border-line bg-white px-12 text-text-ink">
              <option value="all">All</option><option value="healthy">Healthy</option><option value="attention">Needs attention</option>
            </select>
          </label>
        </div>
        <div className="mt-16 flex flex-wrap items-center justify-between gap-12">
          <div className="flex flex-wrap items-center gap-8">
            <Link href={q({start:shiftCalendarDay(props.start,-props.daysCount)})} className="rounded-md border border-border-line px-12 py-8 text-small font-semibold">
              ← {props.labels['staff.unified_calendar.prev']}
            </Link>
            <Link href={q({start:props.today})} className="rounded-md border border-border-line px-12 py-8 text-small font-semibold">
              {props.labels['staff.unified_calendar.today']}
            </Link>
            <Link href={q({start:shiftCalendarDay(props.start,props.daysCount)})} className="rounded-md border border-border-line px-12 py-8 text-small font-semibold">
              {props.labels['staff.unified_calendar.next']} →
            </Link>
            <span className="text-small font-semibold text-text-ink">{props.days[0]} — {props.days[props.days.length-1]}</span>
          </div>
          <div className="flex gap-4" aria-label="Calendar range">
            {[7,14,30].map((length)=><Link key={length} href={q({days:String(length)})}
              aria-current={props.daysCount===length?'page':undefined}
              className={props.daysCount===length
                ? 'rounded-md bg-brand-deep px-12 py-8 text-small font-bold text-white'
                : 'rounded-md border border-border-line px-12 py-8 text-small font-semibold text-text-ink'}>
              {length}{props.labels['staff.unified_calendar.days_suffix']}
            </Link>)}
          </div>
        </div>
      </section>

      <section aria-label="Mobile occupancy agenda" className="rounded-lg border border-border-line bg-surface-paper p-12 md:hidden">
        <div className="mb-12 flex items-center justify-between gap-8">
          <button type="button" disabled={mobileIndex<=0}
            onClick={()=>mobileIndex>0 && setMobileDate(props.days[mobileIndex-1])}
            className="rounded-md border border-border-line px-12 py-8 text-small font-semibold disabled:opacity-40">←</button>
          <div className="text-center">
            <p className="font-semibold text-text-ink">{mobileDate}</p>
            <p className="text-[11px] text-text-secondary">
              {new Date(mobileDate+'T00:00:00Z').toLocaleDateString('en-GB',{weekday:'long',timeZone:'UTC'})}
            </p>
          </div>
          <button type="button" disabled={mobileIndex>=props.days.length-1}
            onClick={()=>mobileIndex<props.days.length-1 && setMobileDate(props.days[mobileIndex+1])}
            className="rounded-md border border-border-line px-12 py-8 text-small font-semibold disabled:opacity-40">→</button>
        </div>
        <div className="space-y-8">
          {rows.length===0 ? <p className="p-12 text-small text-text-secondary">{props.labels['staff.unified_calendar.empty']}</p> :
            rows.map((unit)=>{
              const cell=(props.cells[unit.id]||[])[mobileIndex];
              if (!cell) return null;
              const state=!unit.sellable&&cell.state==='free'
                ? props.labels['staff.unified_calendar.not_sellable']
                : stateLabel[cell.state];
              const rate=props.rates[unit.id]?.byDate[mobileDate];
              return <button key={unit.id} type="button"
                onClick={()=>setSelected({unitId:unit.id,date:mobileDate,cell})}
                className="flex w-full items-center justify-between gap-12 rounded-md border border-border-line bg-surface-ivory p-12 text-left">
                <span>
                  <span className="block font-semibold text-text-ink">{unit.name}</span>
                  <span className="block text-[11px] text-text-secondary">{unit.projectName} · {unit.categoryName}</span>
                  <span className="block text-[10px] text-text-secondary">
                    {props.labels['staff.unified_calendar.readiness']}: {props.labels['staff.unified_calendar.'+unit.readiness] || unit.readiness}
                    {' · '}{props.labels['staff.unified_calendar.channel_health']}: {unit.channelState.replace(/_/g,' ')}
                  </span>
                </span>
                <span className="text-right">
                  <span className={'block shrink-0 rounded-md px-12 py-8 text-[11px] font-semibold '+(!unit.sellable&&cell.state==='free'?'bg-slate-100 text-slate-500':stateClass[cell.state])}>
                    {state}
                  </span>
                  <span className="mt-4 block text-[10px] font-semibold text-text-secondary">
                    {rate ? '฿'+Math.round(rate.nightlyThb/100).toLocaleString() : '—'}
                  </span>
                </span>
              </button>;
            })}
        </div>
      </section>

      <section aria-label="Unified occupancy grid" className="hidden overflow-hidden rounded-lg border border-border-line bg-surface-paper md:block">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-small" style={{minWidth:Math.max(780,220+props.days.length*52)}}>
            <thead><tr>
              <th scope="col" className="sticky left-0 z-20 w-[220px] border-b border-r border-border-line bg-surface-paper p-12 text-left text-text-ink">{props.labels['staff.unified_calendar.project_home']}</th>
              {props.days.map((day)=><th key={day} scope="col"
                className={day===props.today?'border-b border-l border-emerald-300 bg-emerald-100 p-8 text-center text-emerald-900':'border-b border-l border-border-line bg-surface-ivory p-8 text-center text-text-secondary'}>
                <span className="block font-semibold">{day.slice(8)}</span>
                <span className="block text-[10px]">{new Date(day+'T00:00:00Z').toLocaleDateString('en-GB',{weekday:'short',timeZone:'UTC'})}</span>
              </th>)}
            </tr></thead>
            <tbody>
              {rows.length===0 ? <tr><td colSpan={props.days.length+1} className="p-24 text-text-secondary">{props.labels['staff.unified_calendar.empty']}</td></tr> :
                rows.map((unit)=><tr key={unit.id}>
                  <th scope="row" className="sticky left-0 z-10 border-b border-r border-border-line bg-surface-paper p-12 text-left">
                    <span className="block font-semibold text-text-ink">{unit.name}</span>
                    <span className="block text-[11px] font-normal text-text-secondary">{unit.projectName} · {unit.categoryName}</span>
                    <span className="block text-[10px] font-semibold text-text-secondary">
                      {props.labels['staff.unified_calendar.readiness']}: {props.labels['staff.unified_calendar.'+unit.readiness] || unit.readiness}
                      {' · '}{props.labels['staff.unified_calendar.channel_health']}: {unit.channelState.replace(/_/g,' ')}
                    </span>
                    {!unit.sellable && <span className="block text-[10px] font-semibold text-amber-900">{props.labels['staff.unified_calendar.not_sellable']}</span>}
                  </th>
                  {(props.cells[unit.id]||[]).map((cell,index)=>{
                    const day=props.days[index];
                    const rate=props.rates[unit.id]?.byDate[day];
                    const occupancy=!unit.sellable&&cell.state==='free'
                      ? props.labels['staff.unified_calendar.not_sellable']
                      : stateLabel[cell.state];
                    const rateLabel=rate
                      ? '฿'+Math.round(rate.nightlyThb/100).toLocaleString()+' · '+rate.source
                      : (props.rates[unit.id]?.error || props.labels['staff.unified_calendar.rate_unavailable']);
                    return <td key={day} className="border-b border-l border-border-line p-[2px]">
                      <button type="button"
                        aria-label={unit.name+' · '+day+' · '+occupancy+' · '+rateLabel}
                        title={unit.name+' · '+day+' · '+occupancy+' · '+rateLabel}
                        onClick={()=>setSelected({unitId:unit.id,date:day,cell})}
                        className={'h-48 w-full rounded-sm text-[10px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-brand-andaman '+(!unit.sellable&&cell.state==='free'?'bg-slate-100 text-slate-500':stateClass[cell.state])}>
                        <span className="block">{!unit.sellable&&cell.state==='free'?'—':shortLabel[cell.state]}</span>
                        <span className="block text-[9px] font-medium opacity-80">{rate ? '฿'+Math.round(rate.nightlyThb/100).toLocaleString() : '—'}</span>
                      </button>
                    </td>;
                  })}
                </tr>)}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap gap-12 border-t border-border-line p-12">
          {(['free','confirmed','in_house','hold','request','external','owner','maintenance','conflict'] as CalendarState[]).map((state)=>
            <span key={state} className="flex items-center gap-4 text-[11px] text-text-secondary">
              <span className={'inline-block h-12 w-12 rounded-sm '+stateClass[state]}/>{stateLabel[state]}
            </span>)}
        </div>
      </section>
      {selected && inspect && <aside role="region" aria-label={props.labels['staff.unified_calendar.inspect']}
        className="rounded-lg border border-border-line bg-surface-paper p-20">
        <div className="flex items-center justify-between gap-12">
          <div><p className="text-kicker font-semibold text-brand-andaman">{props.labels['staff.unified_calendar.inspect']}</p>
            <h2 className="font-display text-heading-3 font-semibold text-text-ink">{inspect.name} · {selected.date}</h2>
          </div>
          <button type="button" onClick={()=>setSelected(null)} aria-label="Close details" className="rounded-md border border-border-line px-12 py-8">×</button>
        </div>
        <div className="my-12 flex flex-wrap items-center gap-8">
          <span className={'rounded-full px-10 py-4 text-small font-semibold '+stateClass[selected.cell.state]}>
            {stateLabel[selected.cell.state]}
          </span>
          <span className={selected.cell.blocking
            ? 'rounded-full bg-slate-900 px-10 py-4 text-small font-semibold text-white'
            : 'rounded-full bg-emerald-50 px-10 py-4 text-small font-semibold text-emerald-900'}>
            {selected.cell.blocking ? 'Dates locked' : 'Dates still sellable'}
          </span>
        </div>
        {selected.cell.state==='request' && <p className="mb-12 text-small text-text-secondary">A guest has requested these dates, but inventory remains available until the request is approved.</p>}
        {selected.cell.state==='hold' && <p className="mb-12 text-small text-text-secondary">Payment is pending. These dates are temporarily held and cannot be sold to another guest.</p>}
        {selected.cell.state==='confirmed' && <p className="mb-12 text-small text-text-secondary">Payment/confirmation is complete. These dates are reserved for this booking.</p>}
        <div className="mb-12 grid gap-8 sm:grid-cols-3">
          <div className="rounded-md bg-surface-ivory p-12 text-small">
            <span className="block text-text-secondary">{props.labels['staff.unified_calendar.readiness']}</span>
            <span className="font-semibold text-text-ink">{props.labels['staff.unified_calendar.'+inspect.readiness] || inspect.readiness}</span>
          </div>
          <div className="rounded-md bg-surface-ivory p-12 text-small">
            <span className="block text-text-secondary">{props.labels['staff.unified_calendar.channel_health']}</span>
            <span className="font-semibold text-text-ink">{inspect.channelState.replace(/_/g,' ')}</span>
          </div>
          <div className="rounded-md bg-surface-ivory p-12 text-small">
            <span className="block text-text-secondary">{props.labels['staff.unified_calendar.effective_rate']}</span>
            {props.rates[inspect.id]?.byDate[selected.date]
              ? <span className="font-semibold text-text-ink">
                  ฿{Math.round(props.rates[inspect.id].byDate[selected.date].nightlyThb/100).toLocaleString()}
                  {' · '}{props.rates[inspect.id].byDate[selected.date].source}
                </span>
              : <span className="font-semibold text-amber-900">{props.rates[inspect.id]?.error || props.labels['staff.unified_calendar.rate_unavailable']}</span>}
          </div>
        </div>
        {inspect.channelRows.length>0 && <div className="mb-12 space-y-4">
          {inspect.channelRows.map((channel)=><p key={channel.channel} className="text-[11px] text-text-secondary">
            <span className="font-semibold text-text-ink">{channel.channel}</span>
            {' · '}{channel.state.replace(/_/g,' ')}
            {' · A:'}{channel.availability}{' R:'}{channel.rates}{' I:'}{channel.restrictions}
          </p>)}
        </div>}
        {selected.cell.entryIds.length===0 ? <p className="text-small text-text-secondary">{props.labels['staff.unified_calendar.no_entries']}</p>
          : <ul className="space-y-8">{selected.cell.entryIds.map((id)=>{
            const item=props.entries[id];
            return item ? <li key={id} className="rounded-md border border-border-line bg-surface-ivory p-12 text-small text-text-ink">
              <div className="flex flex-wrap items-center justify-between gap-8">
                <span className="font-semibold">{item.label}</span>
                <span className="rounded-full bg-surface-paper px-8 py-4 text-[11px] font-semibold text-text-secondary">{(item.channel||item.status).replace(/_/g,' ')}</span>
              </div>
              {item.kind === 'booking' ?
                <Link href={'/ops/stays/'+encodeURIComponent(id)} className="mt-8 block text-small font-semibold text-brand-andaman underline underline-offset-4">Open booking details →</Link> :
                <Link href={props.mode==='mc'
                  ? '/mc/properties/'+encodeURIComponent(inspect.id)+'?'+new URLSearchParams({tab:'calendar',date:selected.date}).toString()
                  : '/ops/calendar/'+encodeURIComponent(inspect.id)}
                  className="mt-8 block text-small font-semibold text-brand-andaman underline underline-offset-4">{props.labels['staff.unified_calendar.manage_block']} →</Link>}
            </li> : null;
          })}</ul>}
        <div className="mt-16 flex flex-wrap gap-8">
          <Link href={props.mode==='mc' ? '/mc/properties/'+encodeURIComponent(inspect.id)+'?'+new URLSearchParams({date:selected?.date||props.start,tab:'overview'}).toString() : '/ops/calendar/'+encodeURIComponent(inspect.id)+'?'+new URLSearchParams({projectId:inspect.projectId,categoryId:inspect.categoryId||'',start:props.start,days:String(props.daysCount)}).toString()} className="inline-flex rounded-md bg-brand-deep px-16 py-8 text-small font-semibold text-white">
            {props.labels['staff.unified_calendar.open_unit']} →
          </Link>
          <Link
            href={props.mode==='mc'
              ? '/mc/properties/'+encodeURIComponent(inspect.id)+'?'+new URLSearchParams({tab:'calendar',date:selected.date}).toString()
              : '/ops/calendar/'+encodeURIComponent(inspect.id)}
            className="inline-flex rounded-md border border-border-line px-16 py-8 text-small font-semibold text-brand-andaman"
          >
            {props.labels['staff.unified_calendar.manage_block']} →
          </Link>
          <Link
            href={'/ops/tasks?'+new URLSearchParams({
              unitId: inspect.id,
              ...(props.mode==='mc' ? { mc:'1' } : {}),
            }).toString()}
            className="inline-flex rounded-md border border-border-line px-16 py-8 text-small font-semibold text-brand-andaman"
          >
            {props.labels['staff.unified_calendar.tasks']}
          </Link>
        </div>
      </aside>}
      <p className="text-small text-text-secondary">{props.labels['staff.unified_calendar.read_only']}</p>
    </div>
  </main>;
}
