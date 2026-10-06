'use client';

import { useState } from 'react';
import { Button } from '@/components/Button';

type SourceResult = { source: string; created: number; reused: number; attached: number; errors: string[] };
type RunResult = { finished: boolean; next: { si: number; offset: number } | null; sources: SourceResult[] };

/**
 * Imports the managed condo photo folders (Yandex Disk) through
 * /api/admin/media/import-managed, calling again with the returned cursor
 * until the run is finished, and shows per-folder totals and errors.
 */
export function ManagedMediaImport({ labels }: { labels: Record<string, string> }) {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [totals, setTotals] = useState<Record<string, SourceResult>>({});

  async function run() {
    setRunning(true);
    setError(null);
    setDone(false);
    setTotals({});
    let cursor: { si: number; offset: number } | null = { si: 0, offset: 0 };
    try {
      while (cursor) {
        const res = await fetch('/api/admin/media/import-managed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cursor),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data) throw new Error(data?.error || labels['admin.media_import.error']);
        const result = data as RunResult;
        setTotals(prev => {
          const nextTotals = { ...prev };
          for (const s of result.sources) {
            const old = nextTotals[s.source] ?? { source: s.source, created: 0, reused: 0, attached: 0, errors: [] };
            nextTotals[s.source] = {
              source: s.source,
              created: old.created + s.created,
              reused: old.reused + s.reused,
              attached: old.attached + s.attached,
              errors: [...old.errors, ...s.errors].slice(0, 5),
            };
          }
          return nextTotals;
        });
        cursor = result.next;
      }
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : labels['admin.media_import.error']);
    } finally {
      setRunning(false);
    }
  }

  const rows = Object.values(totals);
  return (
    <section className="stitch-panel p-20">
      <h2 className="font-display text-title font-semibold text-text-ink">{labels['admin.media_import.title']}</h2>
      <p className="mt-8 text-small text-text-secondary">{labels['admin.media_import.body']}</p>
      <Button type="button" className="mt-16" onClick={run} disabled={running}>
        {running ? labels['admin.media_import.running'] : labels['admin.media_import.run']}
      </Button>
      {error ? <p role="alert" className="mt-12 text-small text-state-error">{error}</p> : null}
      {done ? <p role="status" className="mt-12 text-small text-state-success">{labels['admin.media_import.done']}</p> : null}
      {rows.length ? (
        <ul className="mt-16 divide-y divide-border-line text-small">
          {rows.map(row => (
            <li key={row.source} className="py-8">
              <span className="font-semibold text-text-ink">{row.source}</span>
              <span className="ml-8 font-tabular text-text-secondary">
                {labels['admin.media_import.counts']
                  .replace('{created}', String(row.created))
                  .replace('{reused}', String(row.reused))
                  .replace('{attached}', String(row.attached))}
              </span>
              {row.errors.map(err => <p key={err} className="mt-4 text-state-error">{err}</p>)}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
