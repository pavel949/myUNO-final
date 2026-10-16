'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/Button';
import { remainingAnnualWindows } from '@/modules/core/tariff-calendar';

type Step = { days: number; pct: number };
type Season = { sourceRateId?: string; seasonCode: string; windows: Array<{ start: string; end: string }>; amountSatang: number; minimumNights: number; cancellationSteps?: Step[] | null };
type Draft = {
  includesTaxes: boolean; includesServiceCharge: boolean; includesBreakfast: boolean;
  daily: Season[]; monthly: Season[]; yearly: { amountSatang: number; minimumNights: number } | null;
};
type Issue = { code: string; kind: string; season?: string; day?: string };
type EditPermissions = { canSave: boolean; canEditMonthly: boolean; canEditInclusions: boolean; canSaveCategory: boolean; reason: string | null };
type Validation = { errors: Issue[]; dailyGaps: string[]; monthlyGaps: string[] };

const fill = (t: string, v: Record<string, string | number>) =>
  Object.entries(v).reduce((s, [k, x]) => s.split('{' + k + '}').join(String(x)), t);
const toBaht = (satang: number) => (Number.isFinite(satang) ? satang / 100 : 0);
const toSatang = (baht: string) => Math.round(Number(baht) * 100);
const FLAGS = ['includesTaxes', 'includesServiceCharge', 'includesBreakfast'] as const;
const KINDS = ['daily', 'monthly'] as const;

/**
 * Seasons, monthly and 12-month rates for one villa — or every villa in its
 * category — without SQL. Saves to the grid the pricing engine quotes from;
 * the preview below reads the same rows.
 */
export default function TariffEditorClient({ unitId, labels }: { unitId: string; labels: Record<string, string> }) {
  const L = (k: string) => labels['admin.tariff_editor.' + k] ?? k;
  const [draft, setDraft] = useState<Draft | null>(null);
  const [categoryUnits, setCategoryUnits] = useState(1);
  const [unitRevision, setUnitRevision] = useState<string | null>(null);
  const [categoryRevision, setCategoryRevision] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [conflict, setConflict] = useState(false);
  const [permissions, setPermissions] = useState<EditPermissions | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [validation, setValidation] = useState<Validation | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'saving' | 'saved' | 'error'>('loading');
  const [savedCount, setSavedCount] = useState(0);
  const saving = useRef<AbortController | null>(null);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<{ kind: 'daily' | 'monthly'; index: number; windows: Season['windows'] } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setDraft(null); setPermissions(null); setServerError(null); setUnitRevision(null); setCategoryRevision(null); setConflict(false);
    setValidation(null);
    setState('loading');
    setRemaining(null); setCalendarError(null);
    saving.current?.abort(); saving.current = null;
    fetch(`/api/admin/units/${unitId}/tariff`, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('Tariff load failed');
        const data = await response.json();
        if (!data?.draft || !Array.isArray(data.draft.daily) || !Array.isArray(data.draft.monthly) || !/^[a-f0-9]{64}$/.test(data.unitRevision ?? '')) {
          throw new Error('Invalid tariff response');
        }
        return data;
      })
      .then(data => {
        if (controller.signal.aborted) return;
        setPermissions(data.permissions ?? null);
        setUnitRevision(data.unitRevision); setCategoryRevision(data.categoryRevision ?? null);
        setDraft(data.draft); setCategoryUnits(data.categoryUnits ?? 1); setValidation(data.validation ?? null); setState('idle');
      })
      .catch(() => { if (!controller.signal.aborted) setState('error'); });
    return () => { controller.abort(); saving.current?.abort(); };
  }, [unitId, reload]);

  if (!draft) {
    return <section className="stitch-panel mt-24 p-20"><p role={state === 'error' ? 'alert' : 'status'} className="text-small text-text-secondary">{state === 'error' ? L('load_error') : L('loading')}</p></section>;
  }

  const update = (next: Draft) => { setDraft(next); setState('idle'); setServerError(null); setRemaining(null); setCalendarError(null); };
  const previewRemaining = (kind: 'daily' | 'monthly', index: number) => {
    setRemaining(null); setCalendarError(null);
    try { setRemaining({ kind, index, windows: remainingAnnualWindows(draft[kind], index) }); }
    catch (error) { setCalendarError(L(error instanceof Error ? error.message : 'invalid_dates')); }
  };
  const setSeason = (kind: typeof KINDS[number], i: number, patch: Partial<Season>) =>
    update({ ...draft, [kind]: draft[kind].map((s, j) => (j === i ? { ...s, ...patch } : s)) });

  async function save(scope: 'unit' | 'category') {
    const expectedRevision = scope === 'unit' ? unitRevision : categoryRevision;
    if (!expectedRevision || conflict || saving.current || remaining || permissions?.canSave === false || (scope === 'category' && permissions?.canSaveCategory === false)) return;
    const controller = new AbortController();
    saving.current = controller;
    setState('saving'); setServerError(null);
    setValidation(null);
    try {
      const res = await fetch(`/api/admin/units/${unitId}/tariff`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ draft, scope, expectedRevision }), signal: controller.signal,
      });
      const data = await res.json().catch(() => null);
      if (controller.signal.aborted || saving.current !== controller) return;
      if (data?.validation) setValidation(data.validation);
      if (!res.ok || !data || !Number.isInteger(data.saved) || data.saved < 1 || !/^[a-f0-9]{64}$/.test(data.revision ?? '')) {
        if (res.status === 409) { setConflict(true); setUnitRevision(null); setCategoryRevision(null); }
        setServerError(typeof data?.error === 'string' ? data.error : null);
        setState('error');
        return;
      }
      setUnitRevision(scope === 'unit' ? data.revision : null);
      setCategoryRevision(scope === 'category' ? data.revision : null);
      setSavedCount(data.saved);
      setState('saved');
      window.dispatchEvent(new CustomEvent('tariff-saved', { detail: { unitId } }));
    } catch {
      if (!controller.signal.aborted) setState('error');
    } finally {
      if (saving.current === controller) saving.current = null;
    }
  }

  const issueText = (e: Issue) => fill(L('error.' + e.code), { season: e.season ?? '', day: e.day ?? '', kind: L(e.kind) });

  return (
    <section className="stitch-panel mt-24 p-20" aria-labelledby="tariff-editor-title">
      <h2 id="tariff-editor-title" className="font-display text-heading-3 font-semibold text-text-ink">{L('title')}</h2>
      <p className="mt-8 max-w-3xl text-small text-text-secondary">{L('body')}</p>
      <p className="mt-8 max-w-3xl text-small text-text-secondary">{L('grid_precedence')}</p>

      {conflict && <p role="alert" className="mt-12 text-small text-state-error">{L('conflict')}</p>}
      <Button type="button" variant="secondary" className="mt-12" disabled={state === 'saving'} onClick={() => setReload(value => value + 1)}>{L('reload_current')}</Button>
      {permissions && <p role={permissions.canSave ? undefined : 'alert'} className="mt-8 text-small text-text-secondary">{permissions.reason || L('scoped_hint')}</p>}
      <fieldset disabled={state === 'saving' || permissions?.canSave === false} className="min-w-0">
      <fieldset disabled={permissions?.canEditInclusions === false} className="mt-16 flex flex-wrap gap-16">
        <legend className="sr-only">{L('included')}</legend>
        {FLAGS.map(flag => (
          <label key={flag} className="inline-flex items-center gap-8 text-small text-text-ink">
            <input type="checkbox" checked={draft[flag]} onChange={e => update({ ...draft, [flag]: e.target.checked })} />
            {L(flag)}
          </label>
        ))}
      </fieldset>

      {KINDS.map(kind => (
        <fieldset key={kind} disabled={kind === 'monthly' && permissions?.canEditMonthly === false} className="mt-20">
          <h3 className="font-display text-title font-semibold text-text-ink">{L(kind + '_title')}</h3>
          <p className="text-small text-text-secondary">{L(kind + '_hint')}</p>
          {kind === 'daily' && <p className="text-small text-text-secondary">{L('base_hint')}</p>}
          {!draft[kind].length && <Button type="button" variant="secondary" size="sm" className="mt-8"
            onClick={() => update({ ...draft, [kind]: [{ seasonCode: 'BASE', windows: [{ start: '01-01', end: '12-31' }], amountSatang: 0, minimumNights: kind === 'monthly' ? 30 : 1 }] })}>{L('add_base')}</Button>}
          <div className="mt-8 space-y-12">
            {draft[kind].map((s, i) => (
              <div key={i} className="stitch-panel-soft grid gap-12 p-12 md:grid-cols-[8rem_1fr_8rem_7rem_auto]">
                <label className="text-small text-text-secondary">{L('season')}
                  <input className="stitch-control mt-4 w-full px-8 py-4 uppercase text-text-ink" value={s.seasonCode}
                    onChange={e => setSeason(kind, i, { seasonCode: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') })} />
                </label>
                <div className="text-small text-text-secondary">{L('windows')}
                  {s.windows.map((w, wi) => (
                    <div key={wi} className="mt-4 flex items-center gap-4">
                      <input aria-label={L('from')} placeholder={L('mm_dd')} className="stitch-control w-80 px-8 py-4 tabular-nums text-text-ink" value={w.start}
                        onChange={e => setSeason(kind, i, { windows: s.windows.map((x, k) => (k === wi ? { ...x, start: e.target.value } : x)) })} />
                      <span aria-hidden="true">–</span>
                      <input aria-label={L('to')} placeholder={L('mm_dd')} className="stitch-control w-80 px-8 py-4 tabular-nums text-text-ink" value={w.end}
                        onChange={e => setSeason(kind, i, { windows: s.windows.map((x, k) => (k === wi ? { ...x, end: e.target.value } : x)) })} />
                      {s.windows.length > 1 ? (
                        <Button type="button" variant="ghost" size="sm" onClick={() => setSeason(kind, i, { windows: s.windows.filter((_, k) => k !== wi) })}>{L('remove')}</Button>
                      ) : null}
                    </div>
                  ))}
                  <Button type="button" variant="ghost" size="sm" className="mt-4" onClick={() => setSeason(kind, i, { windows: [...s.windows, { start: '', end: '' }] })}>{L('add_window')}</Button>
                  <Button type="button" variant="ghost" size="sm" className="mt-4" onClick={() => previewRemaining(kind, i)}>{L('remaining_dates')}</Button>
                </div>
                <label className="text-small text-text-secondary">{L(kind === 'daily' ? 'rate_night' : 'rate_30')}
                  <input type="number" min={0} step="0.01" className="stitch-control mt-4 w-full px-8 py-4 tabular-nums text-text-ink" value={toBaht(s.amountSatang)}
                    onChange={e => setSeason(kind, i, { amountSatang: toSatang(e.target.value) })} />
                </label>
                <label className="text-small text-text-secondary">{L('minimum')}
                  <input type="number" min={kind === 'monthly' ? 30 : 1} step="1" className="stitch-control mt-4 w-full px-8 py-4 tabular-nums text-text-ink" value={s.minimumNights}
                    onChange={e => setSeason(kind, i, { minimumNights: Number(e.target.value) })} />
                </label>
                <div className="flex items-start justify-end">
                  <Button type="button" variant="ghost" size="sm" onClick={() => update({ ...draft, [kind]: draft[kind].filter((_, j) => j !== i) })}>{L('remove_season')}</Button>
                </div>
                <div className="md:col-span-5 text-small text-text-secondary">
                  {L('cancellation')}
                  <div className="mt-4 flex flex-wrap gap-8">
                    {(s.cancellationSteps ?? []).map((st, si) => (
                      <span key={si} className="inline-flex items-center gap-4">
                        <input type="number" min={0} aria-label={L('days_before')} className="stitch-control w-64 px-8 py-4 tabular-nums text-text-ink" value={st.days}
                          onChange={e => setSeason(kind, i, { cancellationSteps: (s.cancellationSteps ?? []).map((x, k) => (k === si ? { ...x, days: Number(e.target.value) } : x)) })} />
                        {L('days_short')}
                        <input type="number" min={0} max={100} aria-label={L('refund_pct')} className="stitch-control w-64 px-8 py-4 tabular-nums text-text-ink" value={st.pct}
                          onChange={e => setSeason(kind, i, { cancellationSteps: (s.cancellationSteps ?? []).map((x, k) => (k === si ? { ...x, pct: Number(e.target.value) } : x)) })} />
                        %
                      </span>
                    ))}
                    <Button type="button" variant="ghost" size="sm" onClick={() => setSeason(kind, i, { cancellationSteps: [...(s.cancellationSteps ?? []), { days: 0, pct: 0 }] })}>{L('add_step')}</Button>
                    {s.cancellationSteps?.length ? (
                      <Button type="button" variant="ghost" size="sm" onClick={() => setSeason(kind, i, { cancellationSteps: null })}>{L('clear_steps')}</Button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <Button type="button" variant="secondary" size="sm" className="mt-8"
            onClick={() => update({ ...draft, [kind]: [...draft[kind], { seasonCode: '', windows: [{ start: '', end: '' }], amountSatang: 0, minimumNights: kind === 'monthly' ? 30 : 1 }] })}>
            {L('add_season')}
          </Button>
        </fieldset>
      ))}

      <fieldset disabled={permissions?.canEditMonthly === false} className="mt-20">
        <h3 className="font-display text-title font-semibold text-text-ink">{L('yearly_title')}</h3>
        <p className="text-small text-text-secondary">{L('yearly_hint')}</p>
        <label className="mt-8 inline-flex items-center gap-8 text-small text-text-ink">
          <input type="checkbox" checked={draft.yearly !== null}
            onChange={e => update({ ...draft, yearly: e.target.checked ? { amountSatang: 0, minimumNights: 365 } : null })} />
          {L('yearly_enabled')}
        </label>
        {draft.yearly ? (
          <div className="mt-8 flex flex-wrap gap-12">
            <label className="text-small text-text-secondary">{L('rate_month')}
              <input type="number" min={0} step="0.01" className="stitch-control mt-4 block w-96 px-8 py-4 tabular-nums text-text-ink" value={toBaht(draft.yearly.amountSatang)}
                onChange={e => update({ ...draft, yearly: { ...draft.yearly!, amountSatang: toSatang(e.target.value) } })} />
            </label>
            <label className="text-small text-text-secondary">{L('minimum')}
              <input type="number" min={365} className="stitch-control mt-4 block w-80 px-8 py-4 tabular-nums text-text-ink" value={draft.yearly.minimumNights}
                onChange={e => update({ ...draft, yearly: { ...draft.yearly!, minimumNights: Number(e.target.value) } })} />
            </label>
          </div>
        ) : null}
      </fieldset>

      {calendarError && <p role="alert" className="mt-12 text-small text-state-error">{calendarError}</p>}
      {remaining && <div role="region" aria-label={L('remaining_preview')} className="mt-16 rounded-md border border-border-line p-16 text-small">
        <p>{fill(L('remaining_summary'), { season: draft[remaining.kind][remaining.index].seasonCode })}</p>
        <p>{L('previous_dates')}: {draft[remaining.kind][remaining.index].windows.map(w => w.start + ' – ' + w.end).join(', ')}</p>
        <p>{L('new_dates')}: {remaining.windows.map(w => w.start + ' – ' + w.end).join(', ')}</p>
        <div className="mt-8 flex gap-8">
          <Button type="button" size="sm" onClick={() => setSeason(remaining.kind, remaining.index, { windows: remaining.windows })}>{L('apply_dates')}</Button>
          <Button type="button" variant="secondary" size="sm" onClick={() => setRemaining(null)}>{L('cancel_dates')}</Button>
        </div>
      </div>}
      </fieldset>

      {validation?.errors.length ? (
        <ul role="alert" className="mt-16 list-disc pl-20 text-small text-state-error">
          {validation.errors.map((e, i) => <li key={i}>{issueText(e)}</li>)}
        </ul>
      ) : null}
      {validation && !validation.errors.length && validation.dailyGaps.length ? (
        <p className="mt-16 text-small text-state-warning">
          {fill(L('gaps'), { count: validation.dailyGaps.length, days: validation.dailyGaps.slice(0, 4).join(', ') })}
        </p>
      ) : null}

      <div className="mt-20 flex flex-wrap items-center gap-12">
        <Button type="button" onClick={() => save('unit')} disabled={state === 'saving' || remaining !== null || permissions?.canSave === false || !unitRevision || conflict}>{L('save_unit')}</Button>
        {categoryUnits > 1 && permissions?.canSaveCategory !== false ? (
          <Button type="button" variant="secondary" onClick={() => save('category')} disabled={state === 'saving' || remaining !== null || !categoryRevision || conflict}>
            {fill(L('save_category'), { count: categoryUnits })}
          </Button>
        ) : null}
        {state === 'saving' ? <span className="text-small text-text-secondary">{L('saving')}</span> : null}
        {state === 'saved' ? <span role="status" className="text-small text-state-success">{fill(L('saved'), { count: savedCount })}</span> : null}
        {state === 'error' && !validation?.errors.length ? <span role="alert" className="text-small text-state-error">{serverError || L('save_error')}</span> : null}
      </div>
    </section>
  );
}

