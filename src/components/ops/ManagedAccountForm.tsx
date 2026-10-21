'use client';

import { useState } from 'react';

export interface ManagedAccount {
  firstName: string; lastName: string; preferredLocale?: string;
  displayName?: string | null; active?: boolean; status?: string; updatedAt: string;
}

export default function ManagedAccountForm({ endpoint, kind, initial, canManage = true, canDisable = true, labels }: {
  endpoint: string; kind: 'platform' | 'workspace'; initial: ManagedAccount;
  canManage?: boolean; canDisable?: boolean; labels: Record<string, string>;
}) {
  const [account, setAccount] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const active = kind === 'workspace' ? account.active : account.status !== 'blocked';
  const field = 'block rounded-sm border border-border-line bg-surface-paper p-8 w-full';
  async function save(action: string) {
    if (busy) return;
    if ((action === 'block' || action === 'disable') && !window.confirm(labels.confirmDisable)) return;
    setBusy(true); setMessage('');
    try {
      const response = await fetch(endpoint, { method: 'PATCH', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, expectedUpdatedAt: account.updatedAt, ...(action !== 'profile' ? {} : kind === 'workspace'
          ? { displayName: account.displayName || `${account.firstName} ${account.lastName}` }
          : { firstName: account.firstName, lastName: account.lastName, preferredLocale: account.preferredLocale || 'en' }) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || labels.failed);
      setAccount(current => ({ ...current, ...(data.account || data.member) }));
      setMessage(labels.saved);
    } catch (error) { setMessage(error instanceof Error ? error.message : labels.failed); }
    finally { setBusy(false); }
  }
  return <form className="stitch-panel space-y-12 p-16" onSubmit={event => { event.preventDefault(); void save('profile'); }}>
    <p className="font-semibold">{initial.firstName} {initial.lastName} · {active ? labels.active : labels.disabled}</p>
    <p className="text-small text-text-secondary">{kind === 'workspace' ? labels.localHint : labels.globalHint}</p>
    {kind === 'workspace' ? <label className="block">{labels.displayName}<input className={field} maxLength={100}
      value={account.displayName ?? `${account.firstName} ${account.lastName}`} disabled={!canManage || busy}
      onChange={event => setAccount(current => ({ ...current, displayName: event.target.value }))} /></label>
      : <>
        <label className="block">{labels.firstName}<input required className={field} maxLength={100} value={account.firstName}
          disabled={!canManage || busy} onChange={event => setAccount(current => ({ ...current, firstName: event.target.value }))} /></label>
        <label className="block">{labels.lastName}<input required className={field} maxLength={100} value={account.lastName}
          disabled={!canManage || busy} onChange={event => setAccount(current => ({ ...current, lastName: event.target.value }))} /></label>
        <label className="block">{labels.language}<select className={field} value={account.preferredLocale || 'en'} disabled={!canManage || busy}
          onChange={event => setAccount(current => ({ ...current, preferredLocale: event.target.value }))}>
          <option value="en">{labels.languageEn}</option><option value="ru">{labels.languageRu}</option><option value="th">{labels.languageTh}</option><option value="zh">{labels.languageZh}</option>
        </select></label>
      </>}
    <div className="flex gap-12">
      <button className="rounded-sm border border-border-line px-12 py-8" disabled={!canManage || busy}>{labels.save}</button>
      <button type="button" className="rounded-sm border border-border-line px-12 py-8" disabled={!canManage || !canDisable || busy}
        onClick={() => void save(kind === 'workspace' ? active ? 'disable' : 'enable' : active ? 'block' : 'unblock')}>
        {active ? labels.disable : labels.enable}
      </button>
    </div>
    <p role="status" className="text-small">{message}</p>
  </form>;
}
