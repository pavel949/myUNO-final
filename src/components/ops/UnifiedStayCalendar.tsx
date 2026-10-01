'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { shiftCalendarDay } from '@/modules/booking/calendar-projection';
import type { CalendarCell, CalendarState } from '@/modules/booking/calendar-projection';

interface UnitRow { id: string; name: string; projectId: string; projectName: string; categoryId: string | null; categoryName: string; sellable: boolean }
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
  free:'Available', request:'Request only', hold:'Hold', confirmed:'Reserved',
  in_house:'In house', past:'Past stay', owner:'Owner', maintenance:'Maintenance',
  external:'Imported', blocked:'Blocked', conflict:'Conflict',
};
const shortLabel: Record<CalendarState, string> = {
  free:'', request:'?', hold:'H', confirmed:'●', in_house:'IN', past:'·',
  owner:'O', maintenance:'M', external:'EXT', blocked:'×', conflict:'!',
};

export default function UnifiedStayCalendar(props: Props) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<{unitId:string; date:string; cell:CalendarCell}|null>(null);
  const [refreshRequestedAt, setRefreshRequestedAt] = useState<string|null>(null);
  const lastCursor = useRef<string|null|undefined>(undefined);
  const q = (patch: Record<string,string|null>) => {
    const params = new URLSearchParams();
    for (const [key,value] of Object.entries({
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
  const rows = useMemo(() => props.units.filter((unit) =>
    (unit.name + ' ' + unit.projectName + ' ' + unit.categoryName).toLocaleLowerCase()
      .includes(search.toLocaleLowerCase().trim()),
  ),[props.units,search]);
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
    [props.labels['staff.unified_calendar.arrivals'],String(props.arrivals)],
    [props.labels['staff.unified_calendar.departures'],String(props.departures)]];
  const inspect=selected && props.units.find((unit)=>unit.id===selected.unitId);
  return <main className="min-h-screen bg-surface-ivory p-16 md:p-32">
    <div className="mx-auto max-w-[1600px] space-y-24">
      <header className="flex flex-wrap items-start justify-between gap-16">
        <div className="space-y-8">
          <Link href={props.mode==='mc' ? '/mc/calendar' : '/ops'} className="text-small font-semibold text-brand-andaman hover:underline">
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
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-12 py-6 text-small font-semibold text-emerald-900">
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
      <section aria-label="Calendar filters" className="rounded-lg border border-border-line bg-surface-paper p-16 md:p-24">
        <div className="grid grid-cols-1 gap-12 sm:grid-cols-2 xl:grid-cols-4">
          <label className="text-small font-semibold text-text-secondary">
            {props.labels['staff.unified_calendar.project']}
            <select value={props.projectId} disabled={props.mode==='mc'} onChange={(event)=>router.push(q({projectId:event.target.value,categoryId:null,unitId:null}))}
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
            {[7,14,28].map((length)=><Link key={length} href={q({days:String(length)})}
              aria-current={props.daysCount===length?'page':undefined}
              className={props.daysCount===length
                ? 'rounded-md bg-brand-deep px-12 py-8 text-small font-bold text-white'
                : 'rounded-md border border-border-line px-12 py-8 text-small font-semibold text-text-ink'}>
              {length}{props.labels['staff.unified_calendar.days_suffix']}
            </Link>)}
          </div>
        </div>
      </section>

      <section aria-label="Unified occupancy grid" className="overflow-hidden rounded-lg border border-border-line bg-surface-paper">
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
                    {!unit.sellable && <span className="block text-[10px] font-semibold text-amber-900">{props.labels['staff.unified_calendar.not_sellable']}</span>}
                  </th>
                  {(props.cells[unit.id]||[]).map((cell,index)=><td key={props.days[index]} className="border-b border-l border-border-line p-[2px]">
                    <button type="button"
                      aria-label={unit.name+' · '+props.days[index]+' · '+(!unit.sellable&&cell.state==='free'?props.labels['staff.unified_calendar.not_sellable']:stateLabel[cell.state])}
                      title={unit.name+' · '+props.days[index]+' · '+(!unit.sellable&&cell.state==='free'?props.labels['staff.unified_calendar.not_sellable']:stateLabel[cell.state])}
                      onClick={()=>setSelected({unitId:unit.id,date:props.days[index],cell})}
                      className={'h-36 w-full rounded-sm text-[10px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-brand-andaman '+(!unit.sellable&&cell.state==='free'?'bg-slate-100 text-slate-500':stateClass[cell.state])}>
                      {!unit.sellable&&cell.state==='free'?'—':shortLabel[cell.state]}
                    </button>
                  </td>)}
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
        <p className="my-12 text-small font-semibold text-text-secondary">{stateLabel[selected.cell.state]}</p>
        {selected.cell.entryIds.length===0 ? <p className="text-small text-text-secondary">{props.labels['staff.unified_calendar.no_entries']}</p>
          : <ul className="space-y-8">{selected.cell.entryIds.map((id)=>{
            const item=props.entries[id];
            return item ? <li key={id} className="rounded-md bg-surface-ivory p-12 text-small text-text-ink">
              <span className="font-semibold">{item.label}</span>
              <span className="ml-8 text-text-secondary">{item.channel||item.status}</span>
              {item.kind === 'booking' ?
                <Link href={(props.mode==='mc'?'/mc/bookings/':'/ops/stays/')+encodeURIComponent(id)} className="mt-8 block text-small font-semibold text-brand-andaman underline underline-offset-4">{props.labels['staff.unified_calendar.open_stay']} →</Link> :
                <Link href={(props.mode==='mc'?'/mc/units/':'/ops/calendar/')+encodeURIComponent(inspect.id)} className="mt-8 block text-small font-semibold text-brand-andaman underline underline-offset-4">{props.labels['staff.unified_calendar.manage_block']} →</Link>}
            </li> : null;
          })}</ul>}
        <Link href={(props.mode==='mc'?'/mc/units/':'/ops/calendar/')+encodeURIComponent(inspect.id)+'?'+new URLSearchParams({projectId:inspect.projectId,categoryId:inspect.categoryId||'',start:props.start,days:String(props.daysCount)}).toString()} className="mt-16 inline-flex rounded-md bg-brand-deep px-16 py-8 text-small font-semibold text-white">
          {props.labels['staff.unified_calendar.open_unit']} →
        </Link>
      </aside>}
      <p className="text-small text-text-secondary">{props.labels['staff.unified_calendar.read_only']}</p>
    </div>
  </main>;
}
