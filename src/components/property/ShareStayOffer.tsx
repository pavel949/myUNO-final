'use client';

import { useState } from 'react';
import { formatBahtExact } from '@/lib/money';
import type { StayUxCopy } from '@/modules/content/stay-ux.seed';

/** A shared estimate is never a confirmed booking or a frozen commercial quote. */
export function ShareStayOffer({ name, unitId, startDate, endDate, guests, totalSatang, copy }: {
  name: string; unitId: string; startDate?: string | null; endDate?: string | null;
  guests: number; totalSatang?: number; copy: StayUxCopy;
}) {
  const [status, setStatus] = useState('');
  const offer = () => {
    const url = new URL(`/units/${encodeURIComponent(unitId)}`, window.location.origin);
    const current = new URLSearchParams(window.location.search);
    // Public stay intent only: never include arbitrary tokens or private URL state.
    for (const key of ['adults', 'children', 'stayMode']) {
      const value = current.get(key);
      if (value) url.searchParams.set(key, value);
    }
    if (startDate) url.searchParams.set('startDate', startDate);
    if (endDate) url.searchParams.set('endDate', endDate);
    const text = [name, startDate && endDate ? `${startDate} → ${endDate} · ${guests}` : '',
      totalSatang !== undefined ? `${copy.totalStay}: ${formatBahtExact(totalSatang)}` : '', copy.shareNote, url.href].filter(Boolean).join('\n');
    return { url: url.href, text };
  };
  return <div className="flex flex-wrap items-center gap-8">
    <button type="button" className="min-h-44 rounded-lg border border-border-line px-12 text-small text-brand-andaman" onClick={async () => {
      setStatus('');
      const data = offer();
      try {
        if (navigator.share) await navigator.share({ title: name, text: data.text });
        else { await navigator.clipboard.writeText(data.text); setStatus(copy.copied); }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) setStatus(copy.copyFailed);
      }
    }}>{copy.share}</button>
    <button type="button" className="min-h-44 px-12 text-small text-brand-andaman" onClick={() => {
      window.open(`https://wa.me/?text=${encodeURIComponent(offer().text)}`, '_blank', 'noopener,noreferrer');
    }}>{copy.whatsapp}</button>
    {status && <p role="status" className="w-full text-small text-text-secondary">{status}</p>}
  </div>;
}
