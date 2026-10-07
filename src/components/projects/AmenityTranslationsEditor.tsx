'use client';
/* eslint-disable local-rules/no-literal-ui-text */

import { useCallback, useEffect, useState } from 'react';

type Row = {
  field: string;
  fallback: string | null;
  translations: Record<string, { value: string; status: string }>;
};
const LOCALES = ['en','ru','th'] as const;
const fieldLabels: Record<string,string> = {
  name: 'Amenity name',
  shortDescription: 'Short description',
  description: 'Full description',
  accessInstructions: 'Access instructions',
  terms: 'Terms of use',
};

export default function AmenityTranslationsEditor({
  projectId,
  amenityId,
}: {
  projectId: string;
  amenityId: string;
}) {
  const [locale, setLocale] = useState<(typeof LOCALES)[number]>('en');
  const [rows, setRows] = useState<Row[]>([]);
  const [drafts, setDrafts] = useState<Record<string,string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/projects/${projectId}/amenities/${amenityId}/content`, { cache: 'no-store' });
    const data = await res.json().catch(() => null);
    if (!res.ok) { setMessage(data?.error || 'Could not load translations.'); return; }
    const nextRows = data?.fields ?? [];
    setRows(nextRows);
    const next: Record<string,string> = {};
    for (const row of nextRows as Row[]) {
      for (const l of LOCALES) next[`${row.field}::${l}`] = row.translations?.[l]?.value ?? '';
    }
    setDrafts(next);
  }, [projectId, amenityId]);

  useEffect(() => { void load(); }, [load]);

  async function saveLocale() {
    setBusy(true); setMessage(null);
    try {
      for (const row of rows) {
        const value = drafts[`${row.field}::${locale}`] ?? '';
        const res = await fetch(`/api/admin/projects/${projectId}/amenities/${amenityId}/content`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ field: row.field, locale, value }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || 'Could not save translations.');
      }
      setMessage(`${locale.toUpperCase()} guest copy saved.`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save translations.');
    } finally { setBusy(false); }
  }

  return <section className="rounded-md border border-border-line bg-surface-paper p-20">
    <div className="flex flex-wrap items-start justify-between gap-12">
      <div>
        <h3 className="font-semibold">Guest copy · EN / RU / TH</h3>
        <p className="mt-4 text-small text-text-secondary">Translations use the same ContentKey system as the rest of myUNO. Empty language fields fall back through the platform locale chain.</p>
      </div>
      <div className="flex gap-4 rounded-lg bg-surface-ivory p-4">
        {LOCALES.map(l => <button key={l} type="button" onClick={()=>setLocale(l)} className={`rounded-md px-12 py-8 text-small font-semibold uppercase ${locale===l ? 'bg-brand-andaman text-white' : 'text-text-secondary'}`}>{l}</button>)}
      </div>
    </div>
    {message ? <p role="status" className="mt-12 rounded-md bg-surface-subtle p-12 text-small">{message}</p> : null}
    <div className="mt-16 space-y-12">
      {rows.map(row => {
        const id = `${row.field}::${locale}`;
        const isLong = ['description','accessInstructions','terms'].includes(row.field);
        return <label key={row.field} className="block text-small text-text-secondary">
          {fieldLabels[row.field] || row.field}
          <textarea
            rows={isLong ? 4 : 2}
            value={drafts[id] ?? ''}
            placeholder={row.fallback || ''}
            onChange={e=>setDrafts(prev=>({...prev,[id]:e.target.value}))}
            className="mt-4 w-full rounded-md border border-border-line bg-surface-ivory p-12 normal-case text-text-ink"
          />
        </label>;
      })}
    </div>
    <button type="button" disabled={busy} onClick={saveLocale} className="mt-16 min-h-40 rounded-md bg-brand-andaman px-16 font-semibold text-white disabled:opacity-50">{busy ? 'Saving…' : `Save ${locale.toUpperCase()}`}</button>
  </section>;
}
