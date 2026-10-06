'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/Button';

type Step = { days: number; pct: number };
type Season = { seasonCode: string; windows: Array<{ start: string; end: string }>; amountSatang: number; minimumNights: number; cancellationSteps?: Step[] | null };
type Draft = {
  includesTaxes: boolean; includesServiceCharge: boolean; includesBreakfast: boolean;
  daily: Season[]; monthly: Season[]; yearly: { amountSatang: number; minimumNights: number } | null;
};
type Issue = { code: string; kind: string; season?: string; day?: string };
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
  const [validation, setValidation] = useState<Validation | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'saving' | 'saved' | 'error'>('loading');
  const [savedCount, setSavedCount] = useState(0);

  useEffect(() => {
    fetch(`/api/admin/units/${unitId}/tariff`).then(r => r.json()).then(data => {
      setDraft(data.draft); setCategoryUnits(data.categoryUnits ?? 1); setValidation(data.validation ?? null); setState('idle');
    }).catch(() => setState('error'));
  }, [unitId]);

  if (!draft) {
    return <section className="stitch-panel mt-24 p-20"><p className="text-small text-text-secondary">{state === 'error' ? L('load_error') : L('loading')}</p></section>;
  }

  const update = (next: Draft) => { setDraft(next); setState('idle'); };
  const setSeason = (kind: typeof KINDS[number], i: number, patch: Partial<Season>) =>
    update({ ...draft, [kind]: draft[kind].map((s, j) => (j === i ? { ...s, ...patch } : s)) });

  async function save(scope: 'unit' | 'category') {
    setState('saving');
    const res = await fetch(`/api/admin/units/${unitId}/tariff`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ draft, scope }),
    });
    const data = await res.json().catch(() => null);
    if (data?.validation) setValidation(data.validation);
    if (res.ok) { setSavedCount(data.saved ?? 1); setState('saved'); } else setState('error');
  }

  const issueText = (e: Issue) => fill(L('error.' + e.code), { season: e.season ?? '', day: e.day ?? '', kind: L(e.kind) });

  return (
    <section className="stitch-panel mt-24 p-20" aria-labelledby="tariff-editor-title">
      <h2 id="tariff-editor-title" className="font-display text-heading-3 font-semibold text-text-ink">{L('title')}</h2>
      <p className="mt-8 max-w-3xl text-small text-text-secondary">{L('body')}</p>

      <fieldset className="mt-16 flex flex-wrap gap-16">
        <legend className="sr-only">{L('included')}</legend>
        {FLAGS.map(flag => (
          <label key={flag} className="inline-flex items-center gap-8 text-small text-text-ink">
            <input type="checkbox" checked={draft[flag]} onChange={e => update({ ...draft, [flag]: e.target.checked })} />
            {L(flag)}
          </label>
        ))}
      </fieldset>

      {KINDS.map(kind => (
        <div key={kind} className="mt-20">
          <h3 className="font-display text-title font-semibold text-text-ink">{L(kind + '_title')}</h3>
          <p className="text-small text-text-secondary">{L(kind + '_hint')}</p>
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
                </div>
                <label className="text-small text-text-secondary">{L(kind === 'daily' ? 'rate_night' : 'rate_30')}
                  <input type="number" min={0} step="1" className="stitch-control mt-4 w-full px-8 py-4 tabular-nums text-text-ink" value={toBaht(s.amountSatang)}
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
        </div>
      ))}

      <div className="mt-20">
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
              <input type="number" min={0} className="stitch-control mt-4 block w-96 px-8 py-4 tabular-nums text-text-ink" value={toBaht(draft.yearly.amountSatang)}
                onChange={e => update({ ...draft, yearly: { ...draft.yearly!, amountSatang: toSatang(e.target.value) } })} />
            </label>
            <label className="text-small text-text-secondary">{L('minimum')}
              <input type="number" min={365} className="stitch-control mt-4 block w-80 px-8 py-4 tabular-nums text-text-ink" value={draft.yearly.minimumNights}
                onChange={e => update({ ...draft, yearly: { ...draft.yearly!, minimumNights: Number(e.target.value) } })} />
            </label>
          </div>
        ) : null}
      </div>

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
        <Button type="button" onClick={() => save('unit')} disabled={state === 'saving'}>{L('save_unit')}</Button>
        {categoryUnits > 1 ? (
          <Button type="button" variant="secondary" onClick={() => save('category')} disabled={state === 'saving'}>
            {fill(L('save_category'), { count: categoryUnits })}
          </Button>
        ) : null}
        {state === 'saving' ? <span className="text-small text-text-secondary">{L('saving')}</span> : null}
        {state === 'saved' ? <span role="status" className="text-small text-state-success">{fill(L('saved'), { count: savedCount })}</span> : null}
        {state === 'error' && !validation?.errors.length ? <span role="alert" className="text-small text-state-error">{L('save_error')}</span> : null}
      </div>
    </section>
  );
}
