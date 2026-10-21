'use client';

import { useState, useCallback, useId } from 'react';
import Link from 'next/link';
import ContributorUnitPicker from './contributor-unit-picker';
import { isPropertyCapabilityRole } from '@/modules/core/property-capability-policy';

const ROLES = [
  'owner', 'guest', 'resident', 'buyer',
  'provider_member', 'mc_member', 'juristic_member',
  'staff_ops', 'onsite_host', 'content_contributor', 'pricing_editor', 'booking_mode_editor',
] as const;

/** Platform scope is for the roles that genuinely span everything. */
const EXACT_UNIT_ROLES = new Set(['content_contributor', 'pricing_editor', 'booking_mode_editor']);
const PLATFORM_SCOPED_ROLES = new Set(['staff_ops', 'onsite_host']);
const DEPARTMENTS = ['reservations','front_desk','housekeeping','maintenance','guest_care','finance','pricing','content','channels','owner_relations'] as const;

interface Person { id: string; firstName: string; lastName: string; email: string | null; status: string }
interface InviteResult {
  identity: Person;
  created: boolean;
  alreadyActive: boolean;
  emailed?: boolean;
  claimUrl: string | null;
}
interface Assignment {
  id: string; role: string; scopeType: string; status: string;
  projectName: string | null; unitName: string | null;
  projectId: string | null; unitId: string | null;
  canDelegate?: boolean; parentGrantId?: string | null; expiresAt?: string | null; updatedAt?: string;
}

export default function PeopleAdminClient({
  projects,
  labels,
}: {
  projects: { id: string; name: string }[];
  labels: Record<string, string>;
}) {
  const assignmentFormId = useId();
  const [query, setQuery] = useState('');
  const [people, setPeople] = useState<Person[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  const [selected, setSelected] = useState<Person | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [role, setRole] = useState<string>(ROLES[0]);
  const [scopeType, setScopeType] = useState('project');
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '');
  const [unitId, setUnitId] = useState('');
  const [canDelegate, setCanDelegate] = useState(false);
  const [expiresAt, setExpiresAt] = useState('');
  const [editing, setEditing] = useState<Assignment | null>(null);
  const [busy, setBusy] = useState(false);
  const [teamProjectId, setTeamProjectId] = useState(projects[0]?.id ?? '');
  const [teamMembers, setTeamMembers] = useState<Array<{ identityId:string;name:string;email:string|null;role:string;departments:string[] }>>([]);
  const [teamLoaded, setTeamLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [inviteForm, setInviteForm] = useState({ firstName: '', lastName: '', email: '', destination: 'property' });
  const [inviteResult, setInviteResult] = useState<InviteResult | null>(null);

  const search = useCallback(async () => {
    setSearching(true);
    setError(null);
    const res = await fetch(`/api/admin/people/search?q=${encodeURIComponent(query)}`).catch(() => null);
    const body = await res?.json().catch(() => null);
    setPeople(res?.ok ? body?.identities ?? [] : []);
    if (!res?.ok) setError(body?.error ?? labels['admin.people.error']);
    setSearching(false);
    setSearched(true);
  }, [query, labels]);

  const open = useCallback(async (person: Person) => {
    setSelected(person);
    setEditing(null); setCanDelegate(false); setExpiresAt('');
    setUnitId('');
    setError(null);
    const res = await fetch(`/api/admin/people/${person.id}/roles`).catch(() => null);
    const body = await res?.json().catch(() => null);
    setAssignments(res?.ok ? body?.assignments ?? [] : []);
  }, []);

  const refresh = useCallback(async (identityId: string) => {
    const res = await fetch(`/api/admin/people/${identityId}/roles`).catch(() => null);
    const body = await res?.json().catch(() => null);
    if (res?.ok) {
      setAssignments(body?.assignments ?? []);
      if (body?.identity) setSelected(body.identity);
    }
  }, []);

  const grant = useCallback(async () => {
    if (!selected || busy || (scopeType !== 'platform' && !projectId) || (scopeType === 'unit' && !unitId)) return;
    if (EXACT_UNIT_ROLES.has(role) && !['project', 'unit'].includes(scopeType)) return;
    if (expiresAt && !Number.isFinite(new Date(expiresAt).getTime())) { setError(labels['admin.people.error']); return; }
    setBusy(true);
    setError(null);
    const res = await fetch('/api/admin/roles/grant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identityId: selected.id,
        role,
        scopeType,
        ...(scopeType !== 'platform' ? { projectId } : {}),
        ...(scopeType === 'unit' ? { unitId } : {}),
        ...(isPropertyCapabilityRole(role) ? { canDelegate, expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
          ...(editing?.updatedAt ? { expectedUpdatedAt: editing.updatedAt } : {}) } : {}),
      }),
    }).catch(() => null);
    if (!res?.ok) {
      const body = await res?.json().catch(() => null);
      setError(body?.error ?? labels['admin.people.error']);
    } else {
      await refresh(selected.id);
      setEditing(null); setCanDelegate(false); setExpiresAt('');
    }
    setBusy(false);
  }, [selected, role, scopeType, projectId, unitId, canDelegate, expiresAt, editing, busy, refresh, labels]);

  const revoke = useCallback(async (roleAssignmentId: string) => {
    if (!selected) return;
    setBusy(true);
    const res = await fetch('/api/admin/roles/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roleAssignmentId }),
    }).catch(() => null);
    if (!res?.ok) setError(labels['admin.people.error']);
    else await refresh(selected.id);
    setBusy(false);
  }, [selected, refresh, labels]);

  const setBlocked = useCallback(async (blocked: boolean) => {
    if (!selected) return;
    setBusy(true);
    const res = await fetch(`/api/admin/people/${selected.id}/${blocked ? 'block' : 'unblock'}`, {
      method: 'POST',
    }).catch(() => null);
    if (!res?.ok) setError(labels['admin.people.error']);
    else await refresh(selected.id);
    setBusy(false);
  }, [selected, refresh, labels]);

  const invite = useCallback(async () => {
    setBusy(true);
    setError(null);
    setInviteResult(null);
    const res = await fetch('/api/admin/people/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inviteForm),
    }).catch(() => null);
    const payload = await res?.json().catch(() => null);

    if (res?.ok) {
      setInviteResult(payload);
      if (!payload?.alreadyActive) setInviteForm(current => ({ ...current, firstName: '', lastName: '', email: '' }));
      // Put them straight into the list so a role can be granted immediately —
      // an invitation with no role attached is an account that opens onto
      // nothing.
      if (payload?.identity) {
        setPeople([payload.identity]);
        setSearched(true);
        await open(payload.identity);
      }
    } else {
      setError(payload?.error ?? labels['admin.people.error']);
    }
    setBusy(false);
  }, [inviteForm, labels, open]);

  const loadProjectTeam = async (id:string) => {
    setTeamProjectId(id);setTeamLoaded(false);setError(null);
    const response=await fetch('/api/admin/project-team?projectId='+encodeURIComponent(id));
    const data=await response.json().catch(()=>null);
    if(!response.ok){setError(data?.error||labels['admin.people.error']);return;}
    setTeamMembers(data.items||[]);setTeamLoaded(true);
  };
  const saveTeam = async (identityId:string,departments:string[]) => {
    setBusy(true);setError(null);
    const response=await fetch('/api/admin/project-team',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({projectId:teamProjectId,identityId,departments})});
    const data=await response.json().catch(()=>null);
    if(!response.ok)setError(data?.error||labels['admin.people.error']);
    else setTeamMembers(current=>current.map(member=>member.identityId===identityId?{...member,departments:data.departments}:member));
    setBusy(false);
  };

  const canInvite =
    inviteForm.firstName.trim() !== '' &&
    inviteForm.lastName.trim() !== '' &&
    inviteForm.email.includes('@') &&
    !busy;

  return (
    <div>
      <h1 className="font-display text-display-xl font-semibold text-text-ink mb-24">{labels['admin.people.title']}</h1>

      <p className="mb-24"><Link href="/app/admin/access" className="text-brand-andaman underline">{labels['admin.people.workspace_access']}</Link></p>
      <section className="stitch-panel p-24 mb-24">
        <h2 className="text-heading-3 font-semibold text-text-ink mb-8">{labels['admin.people.project_teams']}</h2>
        <p className="text-small text-text-secondary mb-12">{labels['admin.people.project_teams_hint']}</p>
        <div className="flex flex-wrap gap-8">
          <select className="h-40 rounded-sm border border-border-line px-12" value={teamProjectId} onChange={e=>{setTeamProjectId(e.target.value);setTeamLoaded(false);}}>
            {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button type="button" disabled={!teamProjectId||busy} onClick={()=>loadProjectTeam(teamProjectId)} className="rounded-md bg-brand-deep px-16 py-8 text-small text-white">{labels['admin.people.load_team']}</button>
        </div>
        {teamLoaded && <div className="mt-12 space-y-12">
          {teamMembers.length===0 && <p className="text-small text-text-secondary">{labels['admin.people.no_project_team']}</p>}
          {teamMembers.map(member=><div key={member.identityId} className="rounded-md border border-border-line p-12">
            <p className="font-semibold text-text-ink">{member.name} · {member.role}</p>
            <p className="mb-8 text-small text-text-secondary">{member.email}</p>
            <div className="grid grid-cols-2 gap-8 md:grid-cols-5">
              {DEPARTMENTS.map(dept=><label key={dept} className="flex items-center gap-4 text-small">
                <input type="checkbox" disabled={busy} checked={member.departments.includes(dept)}
                  onChange={e=>saveTeam(member.identityId,e.target.checked?[...member.departments,dept]:member.departments.filter(d=>d!==dept))}/>
                {dept.replace(/_/g,' ')}
              </label>)}
            </div>
          </div>)}
        </div>}
      </section>

      <section className="stitch-panel p-24 mb-24 max-w-2xl">
        <h2 className="text-heading-3 font-semibold text-text-ink mb-8">
          {labels['admin.people.invite']}
        </h2>
        <p className="text-small text-text-secondary mb-16">{labels['admin.people.invite_note']}</p>
        <p className="text-small text-text-secondary mb-16">{labels['admin.people.employee_steps']}</p>
        <p className="mb-16"><Link href="/login?next=%2Fproperty" className="text-brand-andaman underline">{labels['admin.people.employee_login']}</Link></p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          <input
            value={inviteForm.firstName}
            onChange={(e) => setInviteForm({ ...inviteForm, firstName: e.target.value })}
            placeholder={labels['admin.people.invite_first_name']}
            aria-label={labels['admin.people.invite_first_name']}
            className="h-48 rounded-sm border border-border-line bg-surface-ivory px-12 text-body text-text-ink"
          />
          <input
            value={inviteForm.lastName}
            onChange={(e) => setInviteForm({ ...inviteForm, lastName: e.target.value })}
            placeholder={labels['admin.people.invite_last_name']}
            aria-label={labels['admin.people.invite_last_name']}
            className="h-48 rounded-sm border border-border-line bg-surface-ivory px-12 text-body text-text-ink"
          />
          <input
            type="email"
            value={inviteForm.email}
            onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
            placeholder={labels['admin.people.invite_email']}
            aria-label={labels['admin.people.invite_email']}
            className="h-48 rounded-sm border border-border-line bg-surface-ivory px-12 text-body text-text-ink"
          />
        </div>

        <label className="mb-16 block text-small text-text-secondary">
          {labels['admin.people.invite_destination']}
          <select aria-label={labels['admin.people.invite_destination']} value={inviteForm.destination} onChange={e => setInviteForm({ ...inviteForm, destination: e.target.value })}
            className="mt-8 block h-48 w-full rounded-sm border border-border-line bg-surface-ivory px-12">
            <option value="property">{labels['admin.people.invite_property']}</option>
            <option value="account">{labels['admin.people.invite_account']}</option>
          </select>
        </label>
        <button
          type="button"
          onClick={invite}
          disabled={!canInvite}
          className="h-48 px-24 rounded-sm bg-brand-andaman text-surface-ivory font-semibold hover:opacity-90 transition disabled:opacity-50"
        >
          {labels['admin.people.invite_submit']}
        </button>

        {inviteResult?.alreadyActive ? (
          <p className="mt-16 text-body text-text-ink">{labels['admin.people.invite_already_active']}</p>
        ) : null}

        {inviteResult?.claimUrl ? (
          <div className="mt-16">
            <p className="text-small text-text-secondary mb-4">
              {inviteResult.emailed
                ? labels['admin.people.invite_queued']
                : labels['admin.people.invite_not_emailed']}
            </p>
            {/* Shown so an operator can pass it on by Telegram or WhatsApp,
                which is how this clientele actually receives things. */}
            <p className="text-small text-text-ink font-mono break-all">{inviteResult.claimUrl}</p>
            <p className="text-small text-text-secondary mt-4">
              {labels['admin.people.invite_link_note']}
            </p>
          </div>
        ) : null}
      </section>

      <div className="flex gap-8 mb-24">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search()}
          placeholder={labels['admin.people.search']}
          className="flex-1 h-48 rounded-sm border border-border-line bg-surface-paper px-12 text-body text-text-ink"
        />
        <button
          type="button"
          onClick={search}
          disabled={searching}
          className="h-48 px-24 rounded-sm bg-brand-andaman text-surface-ivory font-semibold hover:opacity-90 transition disabled:opacity-50"
        >
          {searching ? labels['admin.people.searching'] : labels['admin.people.search']}
        </button>
      </div>

      {error && <p className="text-small text-state-error mb-16">{error}</p>}

      {searched && people.length === 0 && (
        <p className="text-body text-text-secondary mb-24">{labels['admin.people.none']}</p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-24">
        <div>
          {people.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => open(p)}
              disabled={busy}
              className={`w-full text-left bg-surface-paper border rounded-lg p-16 mb-8 transition ${
                selected?.id === p.id ? 'border-brand-andaman' : 'border-border-line hover:border-brand-andaman/50'
              }`}
            >
              <span className="text-body text-text-ink font-semibold">
                {p.firstName} {p.lastName}
              </span>
              {p.status === 'blocked' && (
                <span className="ml-8 text-small text-state-error">{labels['admin.people.blocked']}</span>
              )}
              <br />
              <span className="text-small text-text-secondary">{p.email ?? '—'}</span>
            </button>
          ))}
        </div>

        {selected && (
          <div className="stitch-panel p-24">
            <h2 className="text-heading-3 font-semibold text-text-ink mb-16">
              {selected.firstName} {selected.lastName}
            </h2>
            <p className="mb-16"><Link className="text-brand-andaman underline" href={'/app/admin/people/' + encodeURIComponent(selected.id)}>
              {labels['administration.manageAccount'] || 'Manage account'}
            </Link></p>

            <h3 className="text-small text-text-secondary mb-8">{labels['admin.people.roles_held']}</h3>
            {assignments.length === 0 ? (
              <p className="text-body text-text-secondary mb-16">{labels['admin.people.no_roles']}</p>
            ) : (
              <ul className="mb-16">
                {assignments.map((a) => (
                  <li key={a.id} className="flex items-center justify-between py-8 border-t border-border-line">
                    <span className="text-body text-text-ink">
                      {EXACT_UNIT_ROLES.has(a.role) ? labels[`admin.people.${a.role}`] : a.role}
                      <span className="text-small text-text-secondary">
                        {' · '}
                        {a.scopeType === 'platform'
                          ? labels['admin.people.scope_platform']
                          : a.unitName ?? a.projectName ?? a.scopeType}
                        {a.role === 'content_contributor' && a.scopeType === 'project' && ` · ${labels['admin.people.scope_shared_content']}`}
                        {a.role === 'pricing_editor' && ` · ${labels[a.scopeType === 'unit' ? 'admin.people.scope_pricing_unit' : 'admin.people.scope_pricing_project']}`}
                        {a.status !== 'active' && ` · ${a.status}`}
                        {a.canDelegate && ` · ${labels['admin.people.delegable']}`}
                        {a.parentGrantId && ` · ${labels['admin.people.delegated']}`}
                        {a.expiresAt && ` · ${new Date(a.expiresAt).toLocaleString()}`}
                      </span>
                    </span>
                    {isPropertyCapabilityRole(a.role) && !a.parentGrantId && a.updatedAt && <button
                      type="button" disabled={busy} className="mx-12 text-small text-brand-andaman underline"
                      onClick={() => {
                        setEditing(a); setRole(a.role); setScopeType(a.scopeType); setProjectId(a.projectId ?? '');
                        setUnitId(a.unitId ?? ''); setCanDelegate(a.canDelegate ?? false);
                        const date = a.expiresAt ? new Date(a.expiresAt) : null;
                        setExpiresAt(date ? new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');
                      }}>{labels['admin.people.edit_capability']}</button>}
                    <button
                      type="button"
                      onClick={() => revoke(a.id)}
                      disabled={busy || a.status !== 'active'}
                      className="text-small text-state-error hover:underline disabled:opacity-40"
                    >
                      {labels['admin.people.revoke']}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <h3 className="text-small text-text-secondary mb-8">{labels['admin.people.grant']}</h3>
            <div className="grid grid-cols-1 gap-8 mb-8">
              <label htmlFor={`${assignmentFormId}-role`} className="text-small text-text-secondary">
                {labels['admin.people.role']}
              </label>
              <select
                id={`${assignmentFormId}-role`}
                disabled={busy || editing !== null}
                value={role}
                onChange={(e) => {
                  setRole(e.target.value);
                  // Restricted employee roles default to one exact unit; project scope is explicit.
                  setUnitId('');
                  if (EXACT_UNIT_ROLES.has(e.target.value)) setScopeType('unit');
                  else if (scopeType === 'unit' || !PLATFORM_SCOPED_ROLES.has(e.target.value)) setScopeType('project');
                }}
                className="h-48 rounded-sm border border-border-line bg-surface-ivory px-12 text-body text-text-ink"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{EXACT_UNIT_ROLES.has(r) ? labels[`admin.people.${r}`] : r}</option>
                ))}
              </select>

              <label htmlFor={`${assignmentFormId}-scope`} className="text-small text-text-secondary">
                {labels['admin.people.scope']}
              </label>
              <select
                id={`${assignmentFormId}-scope`}
                disabled={busy || editing !== null}
                value={scopeType}
                onChange={(e) => { setScopeType(e.target.value); setUnitId(''); }}
                className="h-48 rounded-sm border border-border-line bg-surface-ivory px-12 text-body text-text-ink"
              >
                <option value="project">{labels[role === 'content_contributor' ? 'admin.people.scope_shared_content' : role === 'pricing_editor' ? 'admin.people.scope_pricing_project' : 'admin.people.scope_project']}</option>
                {EXACT_UNIT_ROLES.has(role) && <option value="unit">{labels[role === 'pricing_editor' ? 'admin.people.scope_pricing_unit' : 'admin.people.scope_unit']}</option>}
                {PLATFORM_SCOPED_ROLES.has(role) && (
                  <option value="platform">{labels['admin.people.scope_platform']}</option>
                )}
              </select>

              {scopeType !== 'platform' && (
                <>
                  <label htmlFor={`${assignmentFormId}-project`} className="text-small text-text-secondary">
                    {labels['admin.people.project']}
                  </label>
                  <select
                    id={`${assignmentFormId}-project`}
                    disabled={busy || editing !== null}
                    value={projectId}
                    onChange={(e) => { setProjectId(e.target.value); setUnitId(''); }}
                    className="h-48 rounded-sm border border-border-line bg-surface-ivory px-12 text-body text-text-ink"
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </>
              )}
              {EXACT_UNIT_ROLES.has(role) && scopeType === 'unit' && projectId && <ContributorUnitPicker
                key={`${role}:${projectId}`}
                projectId={projectId}
                unitId={unitId}
                onChange={setUnitId}
                disabled={busy || editing !== null}
                labels={labels}
              />}
            </div>
            <p className="text-small text-text-secondary mb-16">{labels[role === 'content_contributor' ? 'admin.people.content_scope_note' : role === 'pricing_editor' ? 'admin.people.pricing_scope_note' : role === 'booking_mode_editor' ? 'admin.people.booking_scope_note' : 'admin.people.scope_note']}</p>

            {isPropertyCapabilityRole(role) && <div className="mb-16 grid gap-12">
              <label className="flex items-start gap-8 text-small"><input type="checkbox" checked={canDelegate}
                onChange={e => setCanDelegate(e.target.checked)} disabled={busy} />{labels['admin.people.can_delegate']}</label>
              <p className="text-small text-text-secondary">{labels['admin.people.delegate_note']}</p>
              <label className="text-small">{labels['admin.people.grant_expiry']}<input type="datetime-local" value={expiresAt}
                onChange={e => setExpiresAt(e.target.value)} disabled={busy}
                className="mt-8 block h-48 w-full rounded-sm border border-border-line bg-surface-ivory px-12" /></label>
              <p className="text-small text-text-secondary">{labels['admin.people.grant_expiry_note']}</p>
              {editing && <button type="button" className="text-small text-brand-andaman underline" onClick={() => {
                setEditing(null); setCanDelegate(false); setExpiresAt('');
              }}>{labels['admin.people.cancel_edit']}</button>}
            </div>}
            {(role === 'content_contributor' || assignments.some(a => a.role === 'content_contributor' && a.status === 'active')) && <Link href="/property/content" className="mb-16 block text-small text-brand-andaman underline">{labels['admin.people.content_workspace_link']}</Link>}
            {(role === 'pricing_editor' || assignments.some(a => a.role === 'pricing_editor' && a.status === 'active')) && <Link href="/property/pricing" className="mb-16 block text-small text-brand-andaman underline">{labels['admin.people.pricing_workspace_link']}</Link>}

            <button
              type="button"
              onClick={grant}
              disabled={busy || (scopeType !== 'platform' && !projectId) || (scopeType === 'unit' && !unitId)}
              className="h-48 px-24 rounded-sm bg-brand-andaman text-surface-ivory font-semibold hover:opacity-90 transition disabled:opacity-50 mb-24"
            >
              {busy ? labels['admin.people.granting'] : labels['admin.people.grant_submit']}
            </button>

            <div className="border-t border-border-line pt-16">
              <p className="text-small text-text-secondary mb-8">{labels['admin.people.block_warning']}</p>
              <button
                type="button"
                onClick={() => setBlocked(selected.status !== 'blocked')}
                disabled={busy}
                className="h-48 px-24 rounded-sm border border-state-error text-state-error font-semibold hover:bg-state-error/10 transition disabled:opacity-50"
              >
                {selected.status === 'blocked' ? labels['admin.people.unblock'] : labels['admin.people.block']}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

