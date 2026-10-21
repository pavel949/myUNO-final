'use client';
import { useCallback, useEffect, useState } from 'react';

type Grant = { id: string; role: string; scopeType: string; projectId: string; unitId: string | null;
  projectName: string; unitName: string | null; expiresAt: string | null };
type Assignment = { id: string; role: string; status: string; scopeType: string; parentGrantId: string;
  projectId: string; unitId: string | null; projectName: string; unitName: string | null; name: string; email: string | null;
  accountStatus: string; expiresAt: string | null; updatedAt: string };
export default function PropertyAccessClient({ labels }: { labels: Record<string, string> }) {
  const t = (key: string) => labels[`property.delegation.${key}`];
  const [data, setData] = useState<{ grants: Grant[]; assignments: Assignment[] } | null>(null);
  const [parentId, setParentId] = useState(''); const [email, setEmail] = useState('');
  const [scope, setScope] = useState('unit'); const [unitId, setUnitId] = useState('');
  const [query, setQuery] = useState(''); const [units, setUnits] = useState<Array<{ id: string; name: string }>>([]);
  const [hasMore, setHasMore] = useState(false); const [expires, setExpires] = useState('');
  const [confirmed, setConfirmed] = useState(false); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const parent = data?.grants.find(grant => grant.id === parentId);
  const refresh = useCallback(async () => {
    const res = await fetch('/api/property-access'); const body = await res.json();
    if (!res.ok) { setData(null); setParentId(''); setUnits([]); setConfirmed(false); throw new Error(body.error || labels['property.delegation.error']); }
    setData(body); setParentId(current => body.grants.some((grant: Grant) => grant.id === current) ? current : body.grants[0]?.id ?? '');
  }, [labels]);
  useEffect(() => { void refresh().catch(reason => setError(reason.message)); }, [refresh]);
  useEffect(() => {
    if (!parent) { setUnits([]); return; }
    let cancelled = false; setUnits([]); setUnitId(parent.scopeType === 'unit' ? parent.unitId! : '');
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/property-access?parentGrantId=${encodeURIComponent(parent.id)}&role=${parent.role}&q=${encodeURIComponent(query)}`);
        const body = await res.json(); if (!res.ok) {
          if (!cancelled && res.status === 403) { setData(null); setParentId(''); setUnits([]); setConfirmed(false); }
          throw new Error(body.error || labels['property.delegation.error']);
        }
        if (!cancelled) { setUnits(body.units); setHasMore(body.hasMore); }
      } catch (reason) { if (!cancelled) setError(reason instanceof Error ? reason.message : labels['property.delegation.error']); }
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [parent, query, labels]);
  const act = async (payload: Record<string, unknown>, noticeKey: string) => {
    if (busy) return; setBusy(true); setError(''); setNotice('');
    try {
      const res = await fetch('/api/property-access', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const body = await res.json(); if (!res.ok) {
        if (res.status === 403) { setData(null); setParentId(''); setUnits([]); setConfirmed(false); }
        throw new Error(body.error || t('error'));
      }
      await refresh(); setNotice(t(noticeKey)); setConfirmed(false);
    } catch (reason) { setError(reason instanceof Error ? reason.message : t('error')); }
    finally { setBusy(false); }
  };
  const grant = () => {
    if (!parent || !confirmed || (scope === 'unit' && !unitId)) return;
    if (expires && !Number.isFinite(new Date(expires).getTime())) { setError(t('error')); return; }
    const existing = data?.assignments.find(row => row.parentGrantId === parent.id && row.email?.toLowerCase() === email.trim().toLowerCase() &&
      row.scopeType === scope && row.projectId === parent.projectId && row.unitId === (scope === 'unit' ? unitId : null));
    void act({ action: 'grant', email: email.trim(), role: parent.role, parentGrantId: parent.id,
      scopeType: scope, projectId: parent.projectId, ...(scope === 'unit' ? { unitId } : {}),
      ...(expires ? { expiresAt: new Date(expires).toISOString() } : {}),
      ...(existing ? { expectedUpdatedAt: existing.updatedAt } : {}) }, 'saved');
  };
  const roleLabel = (role: string) => labels[`property.workspace.${role === 'pricing_editor' ? 'pricing' : 'booking-mode'}`];
  const field = 'mt-8 block h-48 w-full rounded-sm border border-border-line bg-surface-paper px-12';
  return <section className="mt-24 grid gap-24">
    {error && <p role="alert" className="text-state-error">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {!data && !error && <p role="status">{t('loading')}</p>}
    {data && <>
      <form className="stitch-panel grid gap-16 p-20" onSubmit={event => { event.preventDefault(); grant(); }}>
        <label>{t('email')}<input type="email" required value={email} className={field} maxLength={254} disabled={busy}
          onChange={event => { setEmail(event.target.value); setConfirmed(false); }} /></label>
        <label>{t('parent')}<select aria-label={t('parent')} value={parentId} disabled={busy} className={field} onChange={event => {
          setParentId(event.target.value); setScope('unit'); setQuery(''); setUnitId(''); setExpires(''); setConfirmed(false);
        }}>{data.grants.map(grant => <option key={grant.id} value={grant.id}>{roleLabel(grant.role)} · {grant.projectName}{grant.unitName ? ` / ${grant.unitName}` : ''}</option>)}</select></label>
        {parent && <p className="text-small text-text-secondary">{parent.expiresAt ? new Date(parent.expiresAt).toLocaleString() : t('unbounded')}</p>}
        <label>{t('scope')}<select aria-label={t('scope')} value={scope} disabled={busy || parent?.scopeType === 'unit'} className={field}
          onChange={event => { setScope(event.target.value); setConfirmed(false); }}>
          <option value="unit">{t('unit')}</option>{parent?.scopeType === 'project' && <option value="project">{t('project')}</option>}
        </select></label>
        {scope === 'unit' && <><label>{t('search')}<input value={query} disabled={busy} className={field} maxLength={200}
          onChange={event => { setQuery(event.target.value); setConfirmed(false); }} /></label>
          <label>{t('choose')}<select aria-label={t('choose')} value={unitId} disabled={busy} required className={field}
            onChange={event => { setUnitId(event.target.value); setConfirmed(false); }}><option value="">{t('choose')}</option>
            {units.map(unit => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></label>
          {hasMore && <p className="text-small">{t('more')}</p>}</>}
        <label>{t('expiry')}<input type="datetime-local" value={expires} disabled={busy} className={field}
          onChange={event => { setExpires(event.target.value); setConfirmed(false); }} /></label>
        <p className="text-small text-text-secondary">{t('expiry_note')}</p>
        <label className="flex gap-8"><input type="checkbox" checked={confirmed} disabled={busy}
          onChange={event => setConfirmed(event.target.checked)} />{t('confirm')}</label>
        <button type="submit" disabled={busy || !confirmed || !parent || (scope === 'unit' && !unitId)}
          className="h-48 rounded-sm bg-brand-andaman px-24 text-surface-ivory disabled:opacity-50">{busy ? t('busy') : t('grant')}</button>
      </form>
      <section><h2 className="font-semibold">{t('current')}</h2>
        {!data.assignments.length && <p className="mt-12">{t('none')}</p>}
        <ul className="mt-12 grid gap-12">{data.assignments.map(row => <li key={row.id} className="stitch-panel p-16">
          <p className="font-semibold">{row.name} · {row.email}</p>
          <p>{roleLabel(row.role)} · {row.projectName}{row.unitName ? ` / ${row.unitName}` : ''}</p>
          <p className="text-small">{row.status === 'active' && ['active', 'invited'].includes(row.accountStatus) ? t('active') : t('inactive')} · {row.expiresAt ? new Date(row.expiresAt).toLocaleString() : t('unbounded')}</p>
          <button type="button" disabled={busy || row.status !== 'active'} className="mt-12 text-state-error underline disabled:opacity-50"
            onClick={() => void act({ action: 'revoke', roleAssignmentId: row.id }, 'revoked')}>{t('revoke')}</button>
        </li>)}</ul>
      </section>
    </>}
  </section>;
}
