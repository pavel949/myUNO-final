'use client';

import { useState, useCallback } from 'react';

const ROLES = [
  'owner', 'guest', 'resident', 'buyer',
  'provider_member', 'mc_member', 'juristic_member',
  'staff_ops', 'onsite_host',
] as const;

/** Platform scope is for the roles that genuinely span everything. */
const PLATFORM_SCOPED_ROLES = new Set(['staff_ops', 'onsite_host']);

interface Person { id: string; firstName: string; lastName: string; email: string | null; status: string }
interface Assignment {
  id: string; role: string; scopeType: string; status: string;
  projectName: string | null; unitName: string | null;
}

export default function PeopleAdminClient({
  projects,
  labels,
}: {
  projects: { id: string; name: string }[];
  labels: Record<string, string>;
}) {
  const [query, setQuery] = useState('');
  const [people, setPeople] = useState<Person[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  const [selected, setSelected] = useState<Person | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [role, setRole] = useState<string>(ROLES[0]);
  const [scopeType, setScopeType] = useState('project');
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async () => {
    setSearching(true);
    setError(null);
    const res = await fetch(`/api/admin/people/search?query=${encodeURIComponent(query)}`).catch(() => null);
    const body = await res?.json().catch(() => null);
    setPeople(res?.ok ? body?.identities ?? [] : []);
    if (!res?.ok) setError(body?.error ?? labels['admin.people.error']);
    setSearching(false);
    setSearched(true);
  }, [query, labels]);

  const open = useCallback(async (person: Person) => {
    setSelected(person);
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
    if (!selected) return;
    setBusy(true);
    setError(null);
    const res = await fetch('/api/admin/roles/grant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identityId: selected.id,
        role,
        scopeType,
        ...(scopeType === 'project' ? { projectId } : {}),
      }),
    }).catch(() => null);
    if (!res?.ok) {
      const body = await res?.json().catch(() => null);
      setError(body?.error ?? labels['admin.people.error']);
    } else {
      await refresh(selected.id);
    }
    setBusy(false);
  }, [selected, role, scopeType, projectId, refresh, labels]);

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

  return (
    <div>
      <h1 className="text-heading-1 font-bold text-text-ink mb-24">{labels['admin.people.title']}</h1>

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
          <div className="bg-surface-paper border border-border-line rounded-lg p-24">
            <h2 className="text-heading-3 font-semibold text-text-ink mb-16">
              {selected.firstName} {selected.lastName}
            </h2>

            <h3 className="text-small text-text-secondary mb-8">{labels['admin.people.roles_held']}</h3>
            {assignments.length === 0 ? (
              <p className="text-body text-text-secondary mb-16">{labels['admin.people.no_roles']}</p>
            ) : (
              <ul className="mb-16">
                {assignments.map((a) => (
                  <li key={a.id} className="flex items-center justify-between py-8 border-t border-border-line">
                    <span className="text-body text-text-ink">
                      {a.role}
                      <span className="text-small text-text-secondary">
                        {' · '}
                        {a.scopeType === 'platform'
                          ? labels['admin.people.scope_platform']
                          : a.unitName ?? a.projectName ?? a.scopeType}
                        {a.status !== 'active' && ` · ${a.status}`}
                      </span>
                    </span>
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
              <select
                value={role}
                onChange={(e) => {
                  setRole(e.target.value);
                  // A role that cannot span the platform must not offer it.
                  if (!PLATFORM_SCOPED_ROLES.has(e.target.value)) setScopeType('project');
                }}
                className="h-48 rounded-sm border border-border-line bg-surface-background px-12 text-body text-text-ink"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>

              <select
                value={scopeType}
                onChange={(e) => setScopeType(e.target.value)}
                className="h-48 rounded-sm border border-border-line bg-surface-background px-12 text-body text-text-ink"
              >
                <option value="project">{labels['admin.people.scope_project']}</option>
                {PLATFORM_SCOPED_ROLES.has(role) && (
                  <option value="platform">{labels['admin.people.scope_platform']}</option>
                )}
              </select>

              {scopeType === 'project' && (
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="h-48 rounded-sm border border-border-line bg-surface-background px-12 text-body text-text-ink"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              )}
            </div>
            <p className="text-small text-text-secondary mb-16">{labels['admin.people.scope_note']}</p>

            <button
              type="button"
              onClick={grant}
              disabled={busy || (scopeType === 'project' && !projectId)}
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
