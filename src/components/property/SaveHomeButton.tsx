'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { StayUxCopy } from '@/modules/content/stay-ux.seed';

const SavedContext = createContext({ unitIds: [] as string[], ready: false, update: (_id: string, _saved: boolean) => {} });

/** One private read per screen, shared by all cards. No cross-account cache. */
export function SavedHomesProvider({ children, enabled = true }: { children: ReactNode; enabled?: boolean }) {
  const [unitIds, setUnitIds] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    fetch('/api/saved/units', { signal: controller.signal, cache: 'no-store' })
      .then(async response => response.ok ? response.json() : { unitIds: [] })
      .then(body => { if (!controller.signal.aborted) { setUnitIds(body.unitIds ?? []); setReady(true); } })
      .catch(() => { if (!controller.signal.aborted) setReady(true); });
    return () => controller.abort();
  }, [enabled]);
  return <SavedContext.Provider value={{ unitIds, ready, update: (id, saved) => {
    setUnitIds(previous => saved ? [...new Set([...previous, id])] : previous.filter(value => value !== id));
  } }}>{children}</SavedContext.Provider>;
}

export function SaveHomeButton({ unitId, copy }: { unitId: string; copy: StayUxCopy }) {
  const context = useContext(SavedContext);
  const saved = context.unitIds.includes(unitId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  return <div>
    <button type="button" aria-label={saved ? copy.saved : copy.save} aria-pressed={saved}
      disabled={busy || !context.ready} className="flex min-h-48 min-w-48 items-center justify-center rounded-full border border-border-line bg-surface-paper/95 text-title text-brand-andaman shadow-card disabled:opacity-50"
      onClick={async () => {
        setBusy(true); setError('');
        try {
          const response = await fetch('/api/saved/units', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ unitId, saved: !saved }) });
          if (response.status === 401) {
            router.push(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
            return;
          }
          if (!response.ok) throw new Error(copy.saveFailed);
          const body = await response.json();
          if (body.saved !== !saved) throw new Error(copy.saveFailed);
          context.update(unitId, body.saved);
        } catch { setError(copy.saveFailed); }
        finally { setBusy(false); }
      }}><span aria-hidden="true">{saved ? '♥' : '♡'}</span></button>
    {error && <p role="alert" className="max-w-[200px] rounded-lg bg-surface-paper p-8 text-small text-state-error">{error}</p>}
  </div>;
}
