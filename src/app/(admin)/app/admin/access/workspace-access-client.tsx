'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { GOVERNED_DAILY_CAPABILITIES } from '@/modules/ops/operating-space-capabilities';
import { OPERATING_SPACE_CAPABILITIES } from '@/modules/ops/operating-space.service';

type Unit = { id: string; name: string; project: { name: string } };
type Person = { id: string; firstName: string; lastName: string; email: string | null; status: string };
type Member = { identityId: string; active: boolean; capabilities: string[]; identity: Omit<Person, 'id'> };
type Space = { id: string; name: string; organizationId: string; updatedAt: string; unitIds: string[]; currentUnits: Unit[]; members: Member[] };
type Organization = { id: string; name: string; units: Unit[] };

export default function WorkspaceAccessClient({ organizations, spaces, labels }: { organizations: Organization[]; spaces: Space[]; labels: Record<string, string> }) {
  const router = useRouter();
  const [organizationId, setOrganizationId] = useState('');
  const [name, setName] = useState(''); const [key, setKey] = useState('');
  const [newUnits, setNewUnits] = useState<string[]>([]);
  const [spaceId, setSpaceId] = useState(''); const [scopeUnits, setScopeUnits] = useState<string[]>([]);
  const [query, setQuery] = useState(''); const [people, setPeople] = useState<Person[]>([]);
  const [person, setPerson] = useState<Person | null>(null); const [capabilities, setCapabilities] = useState<string[]>([]);
  const [busy, setBusy] = useState(false); const [searching, setSearching] = useState(false);
  const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const searchVersion = useRef(0);
  const space = spaces.find(s => s.id === spaceId);
  useEffect(() => { setScopeUnits(space?.unitIds || []); }, [space]);
  const l = (key: string) => labels['admin.access.' + key];
  const toggle = (ids: string[], id: string) => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id];
  const chooseSpace = (id: string) => { setSpaceId(id); setPerson(null); setPeople([]); setCapabilities([]); setError(''); setNotice(''); setSearching(false); searchVersion.current++; };
  async function save(url: string, method: string, body: object) {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || l('failed'));
      if (data.space?.id) setSpaceId(data.space.id);
      setNotice(l('saved')); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : l('failed')); }
    finally { setBusy(false); }
  }
  async function search() {
    const version = ++searchVersion.current;
    setSearching(true); setError('');
    try {
      const response = await fetch('/api/admin/people/search?q=' + encodeURIComponent(query), { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || l('failed'));
      if (version === searchVersion.current) setPeople((data.identities || []).filter((p: Person) => p.status === 'active'));
    } catch (e) { if (version === searchVersion.current) setError(e instanceof Error ? e.message : l('failed')); }
    finally { if (version === searchVersion.current) setSearching(false); }
  }
  const choosePerson = (p: Person) => { setPerson(p); setCapabilities(space?.members.find(m => m.identityId === p.id)?.capabilities || []); };
  const memberBody = (identityId: string, active: boolean, caps: string[]) => ({ identityId, active, capabilities: caps, expectedUpdatedAt: space?.updatedAt });
  const unitChoices = (units: Unit[], selected: string[], update: (ids: string[]) => void) => <fieldset className="mt-12 space-y-8">
    <legend className="font-semibold">{l('units')}</legend>
    <p className="text-small text-text-secondary">{l('scope_note')}</p>
    {!units.length && <p className="text-small text-text-secondary">{l('no_units')}</p>}
    <div className="max-h-80 overflow-y-auto space-y-8">{units.map(u => <label key={u.id} className="flex items-center gap-8 text-small">
      <input type="checkbox" disabled={busy} checked={selected.includes(u.id)} onChange={() => update(toggle(selected, u.id))} />{u.project.name} · {u.name}
    </label>)}</div>
    <p className="text-small">{l('selected')}: {selected.length}</p>
  </fieldset>;
  return <div className="space-y-24">
    <header><h1 className="font-display text-display-xl font-semibold">{l('title')}</h1><p className="mt-8 text-text-secondary">{l('intro')}</p><p className="mt-8 text-small text-text-secondary">{l('daily_scope')}</p>
      <Link href="/app/admin/people" className="mt-12 inline-block text-brand-andaman underline">{l('people')}</Link></header>
    {error && <p role="alert" className="rounded-md bg-state-error-soft p-12 text-state-error">{error}</p>}
    {notice && <p role="status" className="rounded-md bg-surface-mint p-12">{notice}</p>}
    <section className="stitch-panel p-20">
      <h2 className="font-display text-heading-2 font-semibold">{l('create')}</h2>
      <label className="mt-12 block">{l('organization')}<select aria-label={l('organization')} value={organizationId} disabled={busy} onChange={e => { setOrganizationId(e.target.value); setNewUnits([]); }} className="mt-4 h-48 w-full rounded-md border border-border-line px-12">
        <option value="">{l('choose')}</option>{organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
      <div className="mt-12 grid gap-12 md:grid-cols-2"><label>{l('name')}<input value={name} maxLength={120} onChange={e => setName(e.target.value)} className="mt-4 h-48 w-full rounded-md border border-border-line px-12" /></label>
        <label>{l('key')}<input value={key} maxLength={64} pattern="[a-z0-9][a-z0-9-]{2,63}" onChange={e => setKey(e.target.value)} className="mt-4 h-48 w-full rounded-md border border-border-line px-12" /></label></div>
      {organizationId && unitChoices(organizations.find(o => o.id === organizationId)?.units || [], newUnits, setNewUnits)}
      <button type="button" disabled={busy || !organizationId || !name.trim() || !/^[a-z0-9][a-z0-9-]{2,63}$/.test(key) || !newUnits.length}
        onClick={() => void save('/api/admin/operating-spaces', 'POST', { organizationId, name, key, unitIds: newUnits })} className="mt-16 min-h-48 rounded-md bg-brand-deep px-16 text-white disabled:opacity-50">{busy ? l('saving') : l('create')}</button>
    </section>
    <section className="stitch-panel p-20">
      <label className="font-semibold">{l('select_space')}<select aria-label={l('select_space')} disabled={busy} value={spaceId} onChange={e => chooseSpace(e.target.value)} className="mt-8 h-48 w-full rounded-md border border-border-line px-12">
        <option value="">{l('choose')}</option>{spaces.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      {!spaces.length && <p className="mt-12 text-text-secondary">{l('empty')}</p>}
      {space && <>
        {unitChoices(Array.from(new Map([...(organizations.find(o => o.id === space.organizationId)?.units || []), ...space.currentUnits].map(u => [u.id, u])).values()), scopeUnits, setScopeUnits)}
        <button type="button" disabled={busy} onClick={() => void save(`/api/admin/operating-spaces/${encodeURIComponent(space.id)}/scope`, 'PUT', { unitIds: scopeUnits, expectedUpdatedAt: space.updatedAt })}
          className="mt-16 min-h-48 rounded-md bg-brand-deep px-16 text-white disabled:opacity-50">{busy ? l('saving') : l('save_scope')}</button>
        <h2 className="mt-24 font-display text-heading-2 font-semibold">{l('delegation')}</h2><p className="mt-8 text-small text-text-secondary">{l('prerequisite')}</p>
        <div className="mt-12 flex flex-wrap gap-8"><input aria-label={l('search')} value={query} onChange={e => setQuery(e.target.value)} className="h-48 min-w-0 flex-1 rounded-md border border-border-line px-12" />
          <button type="button" disabled={searching || busy || !query.trim()} onClick={() => void search()} className="min-h-48 rounded-md border border-border-line px-16">{searching ? l('loading') : l('search')}</button></div>
        <ul className="mt-8 space-y-8">{people.map(p => <li key={p.id}><button type="button" onClick={() => choosePerson(p)} className="min-h-48 rounded-md border border-border-line px-12 text-left">{p.firstName} {p.lastName} · {p.email}</button></li>)}</ul>
        {person && <fieldset className="mt-16"><legend className="font-semibold">{person.firstName} {person.lastName} · {l('capabilities')}</legend>
          <div className="mt-8 grid gap-8 md:grid-cols-2">{OPERATING_SPACE_CAPABILITIES.map(cap => <label key={cap} className="flex items-center gap-8 text-small"><input type="checkbox" disabled={busy || (!GOVERNED_DAILY_CAPABILITIES.includes(cap) && !capabilities.includes(cap))} checked={capabilities.includes(cap)} onChange={() => setCapabilities(toggle(capabilities, cap))} />{cap.replace(/_/g, ' ')}{!GOVERNED_DAILY_CAPABILITIES.includes(cap) && <span className="text-text-secondary"> · {l('unavailable')}</span>}</label>)}</div>
          <button type="button" disabled={busy || !capabilities.length} onClick={() => void save(`/api/admin/operating-spaces/${encodeURIComponent(space.id)}/members`, 'PUT', memberBody(person.id, true, capabilities))}
            className="mt-16 min-h-48 rounded-md bg-brand-deep px-16 text-white disabled:opacity-50">{busy ? l('saving') : l('save_member')}</button>
        </fieldset>}
        <ul className="mt-24 divide-y divide-border-line">{space.members.map(m => <li key={m.identityId} className="py-12">
          <button type="button" disabled={busy || m.identity.status !== 'active'} onClick={() => choosePerson({ ...m.identity, id: m.identityId })} className="text-left font-semibold">{m.identity.firstName} {m.identity.lastName} · {m.active ? l('active') : l('inactive')}</button>
          <p className="mt-4 text-small text-text-secondary">{m.capabilities.map(c => c.replace(/_/g, ' ')).join(', ')}</p>
          {m.active && <button type="button" disabled={busy} onClick={() => void save(`/api/admin/operating-spaces/${encodeURIComponent(space.id)}/members`, 'PUT', memberBody(m.identityId, false, m.capabilities))} className="mt-8 min-h-48 rounded-md border border-border-line px-12">{l('deactivate')}</button>}
        </li>)}</ul>
      </>}
    </section>
  </div>;
}
