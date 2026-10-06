'use client';

import { useState } from 'react';
import { Button } from '@/components/Button';

/**
 * Instant booking vs request-to-book. Guests see the chosen mode on the villa
 * page; a request waits for the team to accept before any payment.
 */
export default function BookingModeClient({ unitId, instantBook, categoryUnits, labels }: {
  unitId: string; instantBook: boolean; categoryUnits: number; labels: Record<string, string>;
}) {
  const L = (k: string) => labels['admin.booking_mode.' + k] ?? k;
  const [mode, setMode] = useState(instantBook);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [count, setCount] = useState(0);

  async function save(scope: 'unit' | 'category') {
    setState('saving');
    const res = await fetch(`/api/admin/units/${unitId}/booking-mode`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ instantBook: mode, scope }),
    });
    const data = await res.json().catch(() => null);
    if (res.ok) { setCount(data?.updated ?? 1); setState('saved'); } else setState('error');
  }

  return (
    <section className="stitch-panel mt-24 p-20" aria-labelledby="booking-mode-title">
      <h2 id="booking-mode-title" className="font-display text-heading-3 font-semibold text-text-ink">{L('title')}</h2>
      <div className="stitch-segmented mt-12 inline-flex" role="radiogroup" aria-labelledby="booking-mode-title">
        {([true, false] as const).map(value => (
          <button key={String(value)} type="button" role="radio" aria-checked={mode === value}
            className={'px-16 py-8 text-small ' + (mode === value ? 'bg-brand-andaman text-surface-ivory' : 'text-text-ink')}
            onClick={() => { setMode(value); setState('idle'); }}>
            {L(value ? 'instant' : 'request')}
          </button>
        ))}
      </div>
      <p className="mt-8 max-w-2xl text-small text-text-secondary">{L(mode ? 'instant_hint' : 'request_hint')}</p>
      <div className="mt-12 flex flex-wrap items-center gap-12">
        <Button type="button" size="sm" onClick={() => save('unit')} disabled={state === 'saving' || mode === instantBook && state === 'idle'}>{L('save_unit')}</Button>
        {categoryUnits > 1 ? (
          <Button type="button" size="sm" variant="secondary" onClick={() => save('category')} disabled={state === 'saving'}>
            {L('save_category').replace('{count}', String(categoryUnits))}
          </Button>
        ) : null}
        {state === 'saved' ? <span role="status" className="text-small text-state-success">{L('saved').replace('{count}', String(count))}</span> : null}
        {state === 'error' ? <span role="alert" className="text-small text-state-error">{L('error')}</span> : null}
      </div>
    </section>
  );
}
