'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  shiftCalendarDay,
  validCalendarDay,
  type CalendarCell,
} from '@/modules/booking/calendar-projection';
import type { TariffDraft } from '@/modules/core/tariff-editor';
import TariffEditorClient from '@/app/(admin)/app/admin/units/[id]/tariff-editor-client';
import styles from './pricing-desk.module.css';

type Unit = {
  id: string;
  name: string;
  projectId: string;
  categoryId: string | null;
  categoryName: string | null;
};
type Snapshot = {
  draft: TariffDraft;
  unitRevision: string;
  categoryRevision: string | null;
  categoryUnits: number;
};
type Data = {
  units: Array<{ id: string; name: string }>;
  days: string[];
  revision: string;
  snapshot: Snapshot;
  tariffs: Record<string, TariffDraft>;
  rates: Record<
    string,
    { error: string | null; lines: Array<{ date: string; nightlyThb: number; source: string }> }
  >;
  cells: Record<string, CalendarCell[]>;
  rules: Array<{
    id: string;
    unitId: string;
    startDate: string;
    endDate: string;
    nightlyThb: number;
  }>;
};
const money = (value: number, locale: string) =>
  new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value / 100);
const dateLabel = (value: string, locale: string) =>
  new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value + 'T00:00:00Z'));
const amount = (value: string) =>
  /^\d+(?:[.,]\d{1,2})?$/.test(value) ? Math.round(Number(value.replace(',', '.')) * 100) : NaN;

export default function PricingDesk({
  projects,
  units,
  projectId,
  initialUnitId,
  initialView,
  initialStart,
  today,
  locale,
  labels,
}: {
  projects: Array<{ id: string; name: string }>;
  units: Unit[];
  projectId: string;
  initialUnitId?: string;
  initialView: 'rates' | 'calendar';
  initialStart: string;
  today: string;
  locale: string;
  labels: Record<string, string>;
}) {
  const router = useRouter();
  const L = (key: string) => labels['pricing.desk.' + key] ?? labels['pricing.desk.load_failed'];
  const seasonLabel = (code: string) => labels['pricing.desk.season_' + code.toLowerCase()] ?? code;
  const fill = (key: string, count: number) => L(key).replace('{count}', String(count));
  const initial = units.find((unit) => unit.id === initialUnitId) ?? units[0];
  const pendingSeason = useRef<{ code: string; mode: 'daily' | 'monthly' } | null>(null);
  const [unitId, setUnitId] = useState(initial?.id ?? '');
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? '');
  const [scope, setScope] = useState<'unit' | 'category'>(
    initial?.categoryId && !initialUnitId ? 'category' : 'unit'
  );
  const [rateMode, setRateMode] = useState<'daily' | 'monthly'>('daily');
  const [view, setView] = useState(initialView);
  const [start, setStart] = useState(initialStart);
  const [data, setData] = useState<Data | null>(null);
  const [draft, setDraft] = useState<TariffDraft | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'saving' | 'error'>('loading');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reload, setReload] = useState(0);
  const [search, setSearch] = useState('');
  const [selection, setSelection] = useState<{
    from: string;
    through: string;
    complete: boolean;
  } | null>(null);
  const [price, setPrice] = useState('');
  const [minimum, setMinimum] = useState('');
  const [editing, setEditing] = useState<number | null>(null);
  const [rateText, setRateText] = useState('');
  const [dirty, setDirty] = useState(false);
  const [stale, setStale] = useState(false);
  const selectedUnit = units.find((unit) => unit.id === unitId);
  const categories = Array.from(
    new Map(
      units
        .filter((unit) => unit.categoryId)
        .map((unit) => [unit.categoryId!, unit.categoryName ?? unit.categoryId!])
    ).entries()
  );
  const pickerUnits = units.filter((unit) => !categoryId || unit.categoryId === categoryId);
  const locked = status === 'saving' || dirty;

  useEffect(() => {
    if (!unitId) return;
    const controller = new AbortController();
    setStatus('loading');
    setError('');
    setData(null);
    setDraft(null);
    setStale(false);
    setEditing(null);
    setDirty(false);
    fetch('/api/admin/pricing-calendar?' + new URLSearchParams({ unitId, start, scope }), {
      signal: controller.signal,
      cache: 'no-store',
    })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        if (!result.snapshot?.draft || !Array.isArray(result.units) || !Array.isArray(result.days))
          throw new Error('load_failed');
        return result as Data;
      })
      .then((result) => {
        if (!controller.signal.aborted) {
          setData(result);
          setDraft(result.snapshot.draft);
          setStatus('ready');
          if (pendingSeason.current) {
            const index = result.snapshot.draft[pendingSeason.current.mode].findIndex(
              (season) => season.seasonCode === pendingSeason.current?.code
            );
            if (index >= 0) {
              setEditing(index);
              setRateText(
                String(result.snapshot.draft[pendingSeason.current.mode][index].amountSatang / 100)
              );
            }
            pendingSeason.current = null;
          }
        }
      })
      .catch((reason) => {
        if (!controller.signal.aborted) {
          setError(reason.message);
          setStatus('error');
        }
      });
    return () => controller.abort();
  }, [unitId, start, scope, reload]);
  useEffect(() => {
    const refresh = () => {
      if (dirty) setStale(true);
      else setReload((value) => value + 1);
    };
    window.addEventListener('tariff-saved', refresh);
    window.addEventListener('myuno:calendar-changed', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      window.removeEventListener('tariff-saved', refresh);
      window.removeEventListener('myuno:calendar-changed', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [dirty]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const reset = () => {
    setDirty(false);
    setEditing(null);
    setSelection(null);
    setPrice('');
    setMinimum('');
    setError('');
    setNotice('');
    if (data) setDraft(data.snapshot.draft);
  };
  const chooseUnit = (id: string) => {
    reset();
    setUnitId(id);
  };
  const selectDate = (id: string, day: string) => {
    if (locked || status !== 'ready') return;
    if (scope === 'unit' && id !== unitId) {
      chooseUnit(id);
      setSelection({ from: day, through: day, complete: false });
      return;
    }
    if (!selection || selection.complete) {
      setSelection({ from: day, through: day, complete: false });
      const rate = data?.rates[id]?.lines.find((line) => line.date === day);
      setPrice(rate ? String(rate.nightlyThb / 100) : '');
      setMinimum('');
    } else
      setSelection({
        from: day < selection.from ? day : selection.from,
        through: day < selection.from ? selection.from : day,
        complete: true,
      });
    setError('');
    setNotice('');
  };
  const calendarQuery = new URLSearchParams({
    projectId,
    ...(categoryId ? { categoryId } : {}),
    ...(scope === 'unit' ? { unitId } : {}),
    start,
    days: '14',
  });
  const changed = () => {
    setDirty(false);
    setEditing(null);
    setSelection(null);
    setPrice('');
    setMinimum('');
    setReload((value) => value + 1);
    window.dispatchEvent(new Event('myuno:calendar-changed'));
    router.refresh();
  };
  async function saveDates() {
    if (!selection || !data || status !== 'ready' || stale) return;
    const amountSatang = amount(price);
    if (
      !Number.isSafeInteger(amountSatang) ||
      amountSatang <= 0 ||
      !validCalendarDay(selection.from) ||
      !validCalendarDay(selection.through) ||
      selection.from > selection.through ||
      (minimum && (!/^\d+$/.test(minimum) || Number(minimum) < 1 || Number(minimum) > 366))
    ) {
      setError('invalid_range');
      return;
    }
    setStatus('saving');
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/admin/pricing-calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unitId,
          scope,
          start: selection.from,
          end: shiftCalendarDay(selection.through, 1),
          amountSatang,
          ...(minimum ? { minimumNights: Number(minimum) } : {}),
          expectedRevision: data.revision,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 409) setStale(true);
        throw new Error(result.error);
      }
      setNotice(fill('saved', result.saved));
      changed();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'load_failed');
      setStatus('ready');
    }
  }
  async function saveTariff() {
    if (!data || !draft || status !== 'ready' || stale) return;
    const nextAmount = amount(rateText);
    if (editing === null || !Number.isSafeInteger(nextAmount) || nextAmount <= 0) {
      setError('invalid_range');
      return;
    }

    setStatus('saving');
    setError('');
    setNotice('');
    try {
      const response = await fetch(`/api/admin/units/${unitId}/tariff`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: rateMode,
          seasonCode: draft[rateMode][editing].seasonCode,
          amountSatang: nextAmount,
          scope,
          expectedRevision:
            scope === 'category' ? data.snapshot.categoryRevision : data.snapshot.unitRevision,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 409) setStale(true);
        throw new Error(
          result.error === 'season_missing'
            ? 'season_missing'
            : response.status === 409
              ? 'conflict'
              : 'load_failed'
        );
      }
      setNotice(fill('saved', result.saved));
      changed();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'load_failed');
      setStatus('ready');
    }
  }
  const rows =
    data?.units.filter((unit) =>
      unit.name.toLocaleLowerCase().includes(search.toLocaleLowerCase().trim())
    ) ?? [];
  const seasonCodes = Array.from(
    new Set(
      Object.values(data?.tariffs ?? {}).flatMap((tariff) =>
        tariff[rateMode].map((season) => season.seasonCode)
      )
    )
  );
  const count = scope === 'category' ? (data?.snapshot.categoryUnits ?? 0) : 1;
  return (
    <section className={styles.desk} aria-label={L('title')}>
      <header className={styles.heading}>
        <div>
          <h1>{L('title')}</h1>
          <p>{L('intro')}</p>
        </div>
        <Link className={styles.secondary} href={'/ops/calendar/board?' + calendarQuery}>
          {L('full_calendar')}
        </Link>
      </header>
      <div className={styles.filters}>
        <label>
          {L('project')}
          <select
            value={projectId}
            disabled={locked}
            onChange={(event) =>
              router.push(
                '/app/admin/config?' + new URLSearchParams({ projectId: event.target.value })
              )
            }
          >
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {L('category')}
          <select
            value={categoryId}
            disabled={locked}
            onChange={(event) => {
              reset();
              setCategoryId(event.target.value);
              setScope('unit');
              setUnitId(
                units.find((unit) => !event.target.value || unit.categoryId === event.target.value)
                  ?.id ?? ''
              );
            }}
          >
            <option value="">{L('all_categories')}</option>
            {categories.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {L('unit')}
          <select
            value={unitId}
            disabled={locked}
            onChange={(event) => chooseUnit(event.target.value)}
          >
            {pickerUnits.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {!units.length ? (
        <p role="status" className={styles.empty}>
          {L('empty')}
        </p>
      ) : (
        <>
          <div className={styles.toolbar}>
            <div className={styles.switcher} aria-label={L('rates')}>
              {(['rates', 'calendar'] as const).map((mode) => (
                <button
                  type="button"
                  key={mode}
                  aria-pressed={view === mode}
                  disabled={locked}
                  onClick={() => {
                    reset();
                    setView(mode);
                  }}
                >
                  {L(mode)}
                </button>
              ))}
            </div>
            <label className={styles.scope}>
              {L('scope')}
              <select
                value={scope}
                disabled={locked}
                onChange={(event) => {
                  reset();
                  setScope(event.target.value as 'unit' | 'category');
                }}
              >
                <option value="unit">
                  {L('scope_unit')} · {selectedUnit?.name}
                </option>
                <option value="category" disabled={!selectedUnit?.categoryId}>
                  {L('scope_category')} · {selectedUnit?.categoryName ?? L('no_category')}
                </option>
              </select>
            </label>
          </div>
          {stale && (
            <div role="status" className={styles.warning}>
              {L('conflict')}{' '}
              <button
                type="button"
                disabled={status === 'saving'}
                onClick={() => {
                  reset();
                  setReload((value) => value + 1);
                }}
              >
                {L('retry')}
              </button>
            </div>
          )}
          {notice && (
            <p role="status" className={styles.notice}>
              {notice}
            </p>
          )}
          {status === 'loading' && (
            <p role="status" className={styles.empty}>
              {L('loading')}
            </p>
          )}
          {status === 'error' && (
            <p role="alert" className={styles.warning}>
              {L(error)}{' '}
              <button type="button" onClick={() => setReload((value) => value + 1)}>
                {L('retry')}
              </button>
            </p>
          )}
          {data && draft && (
            <div className={styles.layout}>
              <div className={styles.content}>
                {view === 'rates' ? (
                  <>
                    <div className={styles.calendarToolbar}>
                      <h2>{L('annual')}</h2>
                      <div className={styles.switcher}>
                        {(['daily', 'monthly'] as const).map((mode) => (
                          <button
                            type="button"
                            key={mode}
                            aria-pressed={rateMode === mode}
                            disabled={locked}
                            onClick={() => {
                              reset();
                              setRateMode(mode);
                            }}
                          >
                            {L(mode === 'daily' ? 'nightly' : 'monthly')}
                          </button>
                        ))}
                      </div>
                    </div>
                    <p className={styles.hint}>{L('annual_hint')}</p>
                    {seasonCodes.length ? (
                      <div className={styles.scroll}>
                        <table className={styles.matrix}>
                          <thead>
                            <tr>
                              <th scope="col">
                                {scope === 'category' ? selectedUnit?.categoryName : L('unit')}
                              </th>
                              {seasonCodes.map((code) => (
                                <th scope="col" key={code}>
                                  {seasonLabel(code)}
                                  <span>{L(rateMode === 'daily' ? 'nightly' : 'monthly')}</span>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((unit) => (
                              <tr key={unit.id}>
                                <th scope="row">
                                  {unit.name}
                                  <span>{selectedUnit?.categoryName}</span>
                                </th>
                                {seasonCodes.map((code) => {
                                  const season = data.tariffs[unit.id]?.[rateMode].find(
                                    (item) => item.seasonCode === code
                                  );
                                  return (
                                    <td key={code}>
                                      {season ? (
                                        <button
                                          type="button"
                                          disabled={locked || status !== 'ready'}
                                          onClick={() => {
                                            if (unit.id !== unitId) {
                                              pendingSeason.current = { code, mode: rateMode };
                                              chooseUnit(unit.id);
                                              return;
                                            }
                                            setEditing(
                                              draft[rateMode].findIndex(
                                                (item) => item.seasonCode === code
                                              )
                                            );
                                            setRateText(String(season.amountSatang / 100));
                                            setError('');
                                          }}
                                          aria-label={L('edit') + ' ' + unit.name + ' ' + code}
                                        >
                                          {money(season.amountSatang, locale)} ฿
                                        </button>
                                      ) : (
                                        '—'
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className={styles.empty}>{L('empty_rates')}</p>
                    )}
                    <p className={styles.hint}>{L('edit_hint')}</p>
                    <div className={styles.seasons}>
                      <h2>{L('dates')}</h2>
                      {draft[rateMode].map((season, index) => (
                        <div className={styles.season} key={season.seasonCode}>
                          <strong>{seasonLabel(season.seasonCode)}</strong>
                          <span>
                            {season.windows
                              .map(
                                (window) =>
                                  window.start.split('-').reverse().join('.') +
                                  ' – ' +
                                  window.end.split('-').reverse().join('.')
                              )
                              .join(', ')}
                          </span>
                          <span>
                            {L('minimum')}: {season.minimumNights}
                          </span>
                          <button
                            type="button"
                            disabled={locked}
                            onClick={() => {
                              setEditing(index);
                              setRateText(String(season.amountSatang / 100));
                            }}
                          >
                            {L('edit')}
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <div className={styles.calendarToolbar}>
                      <div className={styles.dateNav}>
                        <button
                          type="button"
                          disabled={locked}
                          onClick={() => {
                            reset();
                            setStart(shiftCalendarDay(start, -14));
                          }}
                        >
                          {L('prev')}
                        </button>
                        <label className={styles.srOnly} htmlFor="pricing-start">
                          {L('from')}
                        </label>
                        <input
                          id="pricing-start"
                          type="date"
                          value={start}
                          disabled={locked}
                          onChange={(event) => {
                            if (validCalendarDay(event.target.value)) {
                              reset();
                              setStart(event.target.value);
                            }
                          }}
                        />
                        <button
                          type="button"
                          disabled={locked}
                          onClick={() => {
                            reset();
                            setStart(shiftCalendarDay(start, 14));
                          }}
                        >
                          {L('next')}
                        </button>
                        <button
                          type="button"
                          disabled={locked}
                          onClick={() => {
                            reset();
                            setStart(today);
                          }}
                        >
                          {L('today')}
                        </button>
                      </div>
                      <label>
                        <span className={styles.srOnly}>{L('search')}</span>
                        <input
                          type="search"
                          placeholder={L('search')}
                          value={search}
                          onChange={(event) => setSearch(event.target.value)}
                        />
                      </label>
                    </div>
                    <p className={styles.hint}>{L('select_dates')}</p>
                    <div className={styles.scroll}>
                      <table className={styles.calendar}>
                        <thead>
                          <tr>
                            <th scope="col">{L('unit')}</th>
                            {data.days.map((day) => (
                              <th
                                key={day}
                                scope="col"
                                className={day === today ? styles.today : ''}
                              >
                                <span>
                                  {day.slice(8)}.{day.slice(5, 7)}
                                </span>
                                <small>
                                  {new Intl.DateTimeFormat(locale, {
                                    weekday: 'short',
                                    timeZone: 'UTC',
                                  }).format(new Date(day))}
                                </small>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((unit) => (
                            <tr key={unit.id}>
                              <th scope="row">{unit.name}</th>
                              {data.days.map((day, index) => {
                                const rate = data.rates[unit.id]?.lines.find(
                                  (line) => line.date === day
                                );
                                const cell = data.cells[unit.id]?.[index];
                                const occupied =
                                  cell && !['free', 'request', 'past'].includes(cell.state);
                                const isSelected =
                                  selection && day >= selection.from && day <= selection.through;
                                return (
                                  <td key={day}>
                                    <button
                                      type="button"
                                      disabled={locked || status !== 'ready'}
                                      aria-pressed={Boolean(isSelected)}
                                      aria-label={
                                        unit.name +
                                        ' · ' +
                                        dateLabel(day, locale) +
                                        ' · ' +
                                        (rate
                                          ? money(rate.nightlyThb, locale) + ' ฿'
                                          : L('unknown')) +
                                        ' · ' +
                                        L(occupied ? 'occupied' : 'free')
                                      }
                                      className={[
                                        isSelected ? styles.selected : '',
                                        occupied ? styles.occupied : '',
                                        rate?.source === 'rule' ? styles.overridden : '',
                                      ].join(' ')}
                                      onClick={() => selectDate(unit.id, day)}
                                    >
                                      <span>{rate ? money(rate.nightlyThb, locale) : '—'}</span>
                                      <small>
                                        {occupied
                                          ? L('occupied_short')
                                          : rate?.source === 'rule'
                                            ? L('rule_short')
                                            : '฿'}
                                      </small>
                                    </button>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className={styles.hint}>
                      {L('source')} · {L('nightly')}. {L('occupied')} / {L('rule')}
                    </p>
                    {Object.entries(data.rates)
                      .filter(([, rate]) => rate.error)
                      .map(([id]) => (
                        <p key={id} role="status" className={styles.warning}>
                          {data.units.find((unit) => unit.id === id)?.name}: {L('unknown')}
                        </p>
                      ))}
                  </>
                )}
              </div>
              <aside className={styles.inspector}>
                <p className={styles.eyebrow}>
                  {scope === 'category' ? L('scope_category') : L('scope_unit')}
                </p>
                <h2>{scope === 'category' ? selectedUnit?.categoryName : selectedUnit?.name}</h2>
                {scope === 'category' && (
                  <details className={styles.explanation}>
                    <summary>{fill('bulk_summary', count)}</summary>
                    <p className={styles.hint}>{L('bulk_hint')}</p>
                  </details>
                )}
                {view === 'rates' && editing !== null && draft[rateMode][editing] ? (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      void saveTariff();
                    }}
                  >
                    <h3>{seasonLabel(draft[rateMode][editing].seasonCode)}</h3>
                    <p className={styles.hint}>{L('annual_hint')}</p>
                    <label>
                      {L(rateMode === 'daily' ? 'nightly' : 'monthly')}
                      <input
                        inputMode="decimal"
                        value={rateText}
                        disabled={status === 'saving'}
                        onChange={(event) => {
                          setRateText(event.target.value);
                          setDirty(true);
                        }}
                        required
                      />
                    </label>
                    <button
                      type="submit"
                      className={styles.primary}
                      disabled={status !== 'ready' || stale}
                    >
                      {status === 'saving' ? L('saving') : fill('apply', count)}
                    </button>
                  </form>
                ) : view === 'calendar' && selection ? (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      void saveDates();
                    }}
                  >
                    <h3>{L('dates')}</h3>
                    <div className={styles.dateFields}>
                      <label>
                        {L('from')}
                        <input
                          type="date"
                          value={selection.from}
                          disabled={status === 'saving'}
                          onChange={(event) => {
                            setSelection({
                              ...selection,
                              from: event.target.value,
                              complete: true,
                            });
                            setDirty(true);
                          }}
                          required
                        />
                      </label>
                      <label>
                        {L('through')}
                        <input
                          type="date"
                          value={selection.through}
                          disabled={status === 'saving'}
                          onChange={(event) => {
                            setSelection({
                              ...selection,
                              through: event.target.value,
                              complete: true,
                            });
                            setDirty(true);
                          }}
                          required
                        />
                      </label>
                    </div>
                    <label>
                      {L('nightly')}
                      <input
                        inputMode="decimal"
                        value={price}
                        disabled={status === 'saving'}
                        onChange={(event) => {
                          setPrice(event.target.value);
                          setDirty(true);
                        }}
                        required
                      />
                    </label>
                    <details className={styles.explanation}>
                      <summary>{L('minimum')}</summary>
                      <label>
                        {L('minimum')}
                        <input
                          type="number"
                          min="1"
                          max="366"
                          step="1"
                          value={minimum}
                          disabled={status === 'saving'}
                          onChange={(event) => {
                            setMinimum(event.target.value);
                            setDirty(true);
                          }}
                        />
                      </label>
                    </details>
                    <details className={styles.explanation}>
                      <summary>{L('dated_details')}</summary>
                      <p className={styles.hint}>{L('dated_hint')}</p>
                    </details>
                    <button
                      type="submit"
                      className={styles.primary}
                      disabled={status !== 'ready' || stale}
                    >
                      {status === 'saving' ? L('saving') : fill('apply', count)}
                    </button>
                  </form>
                ) : (
                  <p className={styles.hint}>
                    {L(view === 'calendar' ? 'select_dates' : 'edit_hint')}
                  </p>
                )}
                {(editing !== null || selection) && (
                  <button
                    type="button"
                    className={styles.secondary}
                    disabled={status === 'saving'}
                    onClick={reset}
                  >
                    {L('cancel')}
                  </button>
                )}
                {dirty && (
                  <p role="status" className={styles.hint}>
                    {L('dirty')}
                  </p>
                )}
                {error && status !== 'error' && (
                  <p role="alert" className={styles.warning}>
                    {L(error)}
                  </p>
                )}
                <Link className={styles.textLink} href={'/ops/calendar/' + unitId}>
                  {L('open_unit')}
                </Link>
              </aside>
            </div>
          )}
          <details className={styles.advanced}>
            <summary>{L('advanced')}</summary>
            <TariffEditorClient key={unitId} unitId={unitId} labels={labels} />
          </details>
        </>
      )}
    </section>
  );
}
