'use client';

import { useState } from 'react';
import { Button } from '@/components/Button';
import { LocalDate } from '@/components/LocalDate';
import { MoneyAmount } from '@/components/MoneyAmount';

type Action = 'create' | 'create_cancelled' | 'change' | 'cancel' | 'unchanged' | 'skip';
type Stay = {
  key: string; ref: string; unitCode: string; guestName: string; channel: string; sourceChannelName: string | null;
  startDate: string; endDate: string; totalSatang: number; paidSatang: number; action: Action; reason: string | null;
  completeAfterImport: boolean;
};
type Applied = { key: string; status: string; code?: string };
type Result = {
  mode: 'preview' | 'apply';
  summary: Record<Action, number> & { reservations: number; problems: number };
  problems: Array<{ rowNumber: number; ref: string | null; message: string }>;
  untouchedProtections: Array<{ unitCode: string; startDate: string; endDate: string; reason: string }>;
  stays: Stay[];
  applied?: Applied[];
  groups?: number;
  completed?: number;
};

const XLSX_ACCEPT = '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const ACTIONS: Action[] = ['create', 'create_cancelled', 'change', 'cancel', 'unchanged', 'skip'];
const fill = (t: string, v: Record<string, string | number>) =>
  Object.entries(v).reduce((s, [k, x]) => s.split('{' + k + '}').join(String(x)), t);

/**
 * Admin import of the Layantara reservations workbook: check the file
 * (nothing is written), review every stay, then import. Re-uploading a later
 * workbook applies only what changed.
 */
export function ReservationsImport({ labels }: { labels: Record<string, string> }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<'preview' | 'apply' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const L = (key: string) => labels[key] ?? key;
  const reason = (code: string) => labels['admin.layantara_import.reason.' + code] ??
    fill(L('admin.layantara_import.reason.other'), { code });

  async function send(mode: 'preview' | 'apply') {
    if (!file) return;
    setBusy(mode);
    setError(null);
    try {
      const form = new FormData();
      form.set('file', file);
      form.set('mode', mode);
      const res = await fetch('/api/admin/layantara/reservations-import', { method: 'POST', body: form });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        const code = typeof data?.error === 'string' ? data.error : 'import_failed';
        throw new Error(labels['admin.layantara_import.error.' + code.split(':')[0].toLowerCase()] ?? L('admin.layantara_import.error.import_failed'));
      }
      setResult(data as Result);
    } catch (e) {
      setError(e instanceof Error ? e.message : L('admin.layantara_import.error.import_failed'));
    } finally {
      setBusy(null);
    }
  }

  const outcome = new Map((result?.applied ?? []).map(a => [a.key, a]));
  const writes = result ? result.summary.create + result.summary.create_cancelled + result.summary.change + result.summary.cancel : 0;
  const failed = (result?.applied ?? []).filter(a => a.status === 'quarantined');

  return (
    <section className="stitch-panel p-20" aria-labelledby="layantara-import-title">
      <h2 id="layantara-import-title" className="font-display text-heading-3 font-semibold text-text-ink">{L('admin.layantara_import.title')}</h2>
      <p className="mt-8 max-w-3xl text-small text-text-secondary">{L('admin.layantara_import.body')}</p>

      <div className="mt-16 flex flex-wrap items-center gap-12">
        <label className="stitch-control inline-flex cursor-pointer items-center gap-8 px-16 py-8 text-small text-text-ink">
          <span>{file ? file.name : L('admin.layantara_import.choose')}</span>
          <input
            type="file"
            accept={XLSX_ACCEPT}
            className="sr-only"
            onChange={e => { setFile(e.target.files?.[0] ?? null); setResult(null); setError(null); }}
          />
        </label>
        <Button type="button" variant="secondary" onClick={() => send('preview')} disabled={!file || busy !== null}>
          {busy === 'preview' ? L('admin.layantara_import.checking') : L('admin.layantara_import.check')}
        </Button>
        {result?.mode === 'preview' && writes > 0 ? (
          <Button type="button" onClick={() => send('apply')} disabled={busy !== null}>
            {busy === 'apply' ? L('admin.layantara_import.importing') : fill(L('admin.layantara_import.apply'), { count: writes })}
          </Button>
        ) : null}
      </div>

      {error ? <p role="alert" className="mt-12 text-small text-state-error">{error}</p> : null}

      {result ? (
        <div className="mt-20 space-y-16">
          {result.mode === 'apply' ? (
            <p role="status" className={'text-small font-semibold ' + (failed.length ? 'text-state-error' : 'text-state-success')}>
              {fill(L(failed.length ? 'admin.layantara_import.done_with_issues' : 'admin.layantara_import.done'), {
                groups: result.groups ?? 0, completed: result.completed ?? 0, failed: failed.length,
              })}
            </p>
          ) : null}
          <dl className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-6">
            {ACTIONS.map(a => (
              <div key={a} className="stitch-panel-soft p-12">
                <dt className="text-small text-text-secondary">{L('admin.layantara_import.action.' + a)}</dt>
                <dd className="mt-4 font-display text-title font-semibold tabular-nums text-text-ink">{result.summary[a]}</dd>
              </div>
            ))}
          </dl>

          {result.problems.length ? (
            <ul className="text-small text-state-error">
              {result.problems.map(p => (
                <li key={p.rowNumber + p.message}>{fill(L('admin.layantara_import.problem'), { row: p.rowNumber, ref: p.ref ?? '—', problem: L('admin.layantara_import.problem.' + p.message) })}</li>
              ))}
            </ul>
          ) : null}

          {result.untouchedProtections.length ? (
            <div className="text-small text-text-secondary">
              <p className="font-semibold text-text-ink">{L('admin.layantara_import.untouched')}</p>
              <ul className="mt-4">
                {result.untouchedProtections.map(b => (
                  <li key={b.unitCode + b.startDate} className="tabular-nums">
                    {b.unitCode} · <LocalDate value={b.startDate} /> – <LocalDate value={b.endDate} />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-small">
              <thead>
                <tr className="border-b border-border-line text-text-secondary">
                  <th className="py-8 pr-12">{L('admin.layantara_import.col.ref')}</th>
                  <th className="py-8 pr-12">{L('admin.layantara_import.col.villa')}</th>
                  <th className="py-8 pr-12">{L('admin.layantara_import.col.guest')}</th>
                  <th className="py-8 pr-12">{L('admin.layantara_import.col.channel')}</th>
                  <th className="py-8 pr-12">{L('admin.layantara_import.col.dates')}</th>
                  <th className="py-8 pr-12 text-right">{L('admin.layantara_import.col.total')}</th>
                  <th className="py-8 pr-12 text-right">{L('admin.layantara_import.col.paid')}</th>
                  <th className="py-8">{L('admin.layantara_import.col.result')}</th>
                </tr>
              </thead>
              <tbody>
                {result.stays.map(s => {
                  const done = outcome.get(s.key);
                  const problem = done?.status === 'quarantined' ? done.code : s.reason;
                  return (
                    <tr key={s.key} className="stitch-list-row border-b border-border-line last:border-0">
                      <td className="py-8 pr-12 font-semibold text-text-ink">{s.ref}</td>
                      <td className="py-8 pr-12">{s.unitCode}</td>
                      <td className="py-8 pr-12">{s.guestName}</td>
                      <td className="py-8 pr-12">{s.sourceChannelName ?? L('common.channel.' + s.channel)}</td>
                      <td className="py-8 pr-12 tabular-nums"><LocalDate value={s.startDate} /> – <LocalDate value={s.endDate} /></td>
                      <td className="py-8 pr-12 text-right"><MoneyAmount satang={s.totalSatang} /></td>
                      <td className="py-8 pr-12 text-right">{s.paidSatang ? <MoneyAmount satang={s.paidSatang} /> : '—'}</td>
                      <td className="py-8">
                        <span className={problem ? 'text-state-warning' : 'text-text-ink'}>
                          {L('admin.layantara_import.action.' + s.action)}
                          {s.completeAfterImport ? ' · ' + L('admin.layantara_import.past') : ''}
                        </span>
                        {problem ? <span className="block text-text-secondary">{reason(problem)}</span> : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}
