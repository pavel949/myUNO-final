'use client';
import { useState } from 'react';
import { Button } from '@/components/Button';
interface Preview { scope: 'unit' | 'category'; instantBook: boolean; baseline: string;
  units: Array<{ id: string; name: string; instantBook: boolean }>;
  blocked: Array<{ unitId: string; name: string; codes: string[] }> }

/** Every mode change uses a reviewed current target set and a fresh scoped server check. */
export default function BookingModeClient({ unitId, instantBook, categoryUnits, labels, applyUrl }: {
  unitId: string; instantBook: boolean; categoryUnits: number; labels: Record<string, string>; applyUrl?: string;
}) {
  const L = (key: string) => labels['admin.booking_mode.' + key] ?? key;
  const [mode, setMode] = useState(instantBook); const [savedMode, setSavedMode] = useState(instantBook);
  const [preview, setPreview] = useState<Preview | null>(null); const [confirmed, setConfirmed] = useState(false);
  const [requestId, setRequestId] = useState(''); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(''); const [count, setCount] = useState<number | null>(null);
  async function inspect(scope: 'unit' | 'category') {
    if (busy) return; setBusy(true); setError(''); setCount(null); setPreview(null); setConfirmed(false);
    try {
      const res = await fetch(`/api/property-booking-mode/${encodeURIComponent(unitId)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ instantBook: mode, scope }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || data?.instantBook !== mode || !Array.isArray(data.units) || typeof data.baseline !== 'string')
        throw new Error(data?.error || L('error'));
      setPreview(data); setRequestId(crypto.randomUUID());
    } catch (reason) { setError(reason instanceof Error ? reason.message : L('error')); }
    finally { setBusy(false); }
  }
  async function apply() {
    if (busy || !preview || !confirmed || preview.blocked.length || preview.instantBook !== mode) return;
    setBusy(true); setError('');
    try {
      const res = await fetch(applyUrl ?? `/api/property-booking-mode/${encodeURIComponent(unitId)}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ instantBook: mode,
          scope: preview.scope, baseline: preview.baseline, requestId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || data?.instantBook !== mode) {
        if (res.status === 409 || res.status === 403) { setPreview(null); setConfirmed(false); }
        throw new Error(data?.error || L('error'));
      }
      setSavedMode(data.instantBook); setCount(data.updated); setPreview(null); setConfirmed(false);
    } catch (reason) { setError(reason instanceof Error ? reason.message : L('error')); }
    finally { setBusy(false); }
  }
  return <section className="stitch-panel mt-24 p-20" aria-labelledby="booking-mode-title">
    <h2 id="booking-mode-title" className="font-display text-heading-3 font-semibold text-text-ink">{L('title')}</h2>
    <div className="stitch-segmented mt-12 inline-flex" role="radiogroup" aria-labelledby="booking-mode-title">
      {([true, false] as const).map(value => <button key={String(value)} type="button" role="radio" aria-checked={mode === value} disabled={busy}
        className={'px-16 py-8 text-small ' + (mode === value ? 'bg-brand-andaman text-surface-ivory' : 'text-text-ink')}
        onClick={() => { setMode(value); setPreview(null); setConfirmed(false); setError(''); setCount(null); }}>
        {L(value ? 'instant' : 'request')}
      </button>)}
    </div>
    <p className="mt-8 max-w-2xl text-small text-text-secondary">{L(mode ? 'instant_hint' : 'request_hint')}</p>
    <p className="mt-8 text-small text-text-secondary">{L('no_price_change')}</p>
    <div className="mt-12 flex flex-wrap gap-12">
      <Button type="button" size="sm" onClick={() => void inspect('unit')} disabled={busy || mode === savedMode}>{L('preview_unit')}</Button>
      {categoryUnits > 1 && <Button type="button" size="sm" variant="secondary" onClick={() => void inspect('category')} disabled={busy}>
        {L('preview_category').replace('{count}', String(categoryUnits))}</Button>}
    </div>
    {busy && <p role="status" className="mt-12 text-small">{L('loading')}</p>}
    {error && <p role="alert" className="mt-12 text-small text-state-error">{error}</p>}
    {count !== null && <p role="status" className="mt-12 text-small text-state-success">{L('saved_units').replace('{count}', String(count))}</p>}
    {preview && <div className="mt-20 border-t border-border-line pt-16">
      <h3 className="font-semibold">{L('affected')}</h3>
      <ul className="mt-8 grid gap-4">{preview.units.map(unit => <li key={unit.id}>{unit.name} · {L(unit.instantBook ? 'instant' : 'request')} → {L(mode ? 'instant' : 'request')}</li>)}</ul>
      {preview.blocked.length > 0 ? <div role="alert" className="mt-16 text-state-error"><p>{L('blocked')}</p>
        <ul>{preview.blocked.map(unit => <li key={unit.unitId}>{unit.name}</li>)}</ul></div> : <>
        <label className="mt-16 flex gap-8 text-small"><input type="checkbox" checked={confirmed} disabled={busy}
          onChange={event => setConfirmed(event.target.checked)} />{L('confirm')}</label>
        <Button type="button" className="mt-12" disabled={busy || !confirmed} onClick={() => void apply()}>{L('apply')}</Button>
      </>}
    </div>}
  </section>;
}
