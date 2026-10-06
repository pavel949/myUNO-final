'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

const CAPABILITIES = [
  'view_calendar',
  'manage_reservations',
  'manage_tasks',
  'assign_tasks',
  'manage_housekeeping',
  'manage_maintenance',
  'manage_pricing',
  'manage_availability',
  'view_finance',
  'record_expense',
  'generate_owner_report',
  'manage_team',
  'manage_channels',
] as const;

type Capability = typeof CAPABILITIES[number];

const PRESETS: Record<string, Capability[]> = {
  portfolio_manager: [...CAPABILITIES],
  resort_manager: [
    'view_calendar','manage_reservations','manage_tasks','assign_tasks',
    'manage_housekeeping','manage_maintenance','manage_pricing','manage_availability',
    'view_finance','record_expense','manage_team','manage_channels',
  ],
  reservations_manager: ['view_calendar','manage_reservations','manage_availability'],
  housekeeping_manager: ['view_calendar','manage_tasks','assign_tasks','manage_housekeeping'],
  maintenance_manager: ['view_calendar','manage_tasks','assign_tasks','manage_maintenance'],
  revenue_manager: ['view_calendar','manage_pricing','manage_availability','manage_channels'],
  finance_manager: ['view_finance','record_expense','generate_owner_report'],
  custom: [],
};

const PRESET_LABELS: Record<string, string> = {
  portfolio_manager: 'Portfolio manager',
  resort_manager: 'Resort manager',
  reservations_manager: 'Reservations lead',
  housekeeping_manager: 'Housekeeping lead',
  maintenance_manager: 'Maintenance lead',
  revenue_manager: 'Revenue & distribution',
  finance_manager: 'Finance & owner reporting',
  custom: 'Custom access',
};

interface Person {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  status?: string;
  isAdmin?: boolean;
}

interface Project {
  id: string;
  name: string;
  status: string;
  units: Array<{ id: string; name: string; status: string }>;
}

interface SpaceMember {
  identityId: string;
  active: boolean;
  capabilities: string[];
  preset: string;
  identity: Person;
}

interface Space {
  id: string;
  key: string;
  name: string;
  timezone: string;
  organizationId: string;
  organization: { name: string };
  units: Array<{
    unitId: string;
    unit: { id: string; name: string; projectId: string; project: { name: string } };
  }>;
  members: SpaceMember[];
  teams: Array<{
    id: string;
    name: string;
    teamType: string;
    members: Array<{ identityId: string }>;
  }>;
}

export default function FounderGovernanceClient({
  admins,
  organizations,
  projects,
  spaces,
  labels,
}: {
  admins: Person[];
  organizations: Array<{ id: string; name: string }>;
  projects: Project[];
  spaces: Space[];
  labels: Record<string, string>;
}) {
  const router = useRouter();
  const [selectedSpaceId, setSelectedSpaceId] = useState(spaces[0]?.id ?? '');
  const selectedSpace = spaces.find((space) => space.id === selectedSpaceId) ?? spaces[0] ?? null;

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scopeDraft, setScopeDraft] = useState<string[]>(
    selectedSpace?.units.map((row) => row.unitId) ?? [],
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Person[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [preset, setPreset] = useState('resort_manager');
  const [capabilities, setCapabilities] = useState<Capability[]>(PRESETS.resort_manager);

  const [createForm, setCreateForm] = useState({
    key: '',
    name: '',
    organizationId: organizations[0]?.id ?? '',
    timezone: 'Asia/Bangkok',
  });

  const activeMember = selectedPerson && selectedSpace
    ? selectedSpace.members.find((member) => member.identityId === selectedPerson.id)
    : null;

  const selectedProjectNames = useMemo(() => {
    if (!selectedSpace) return [];
    return Array.from(new Set(selectedSpace.units.map((row) => row.unit.project.name))).sort();
  }, [selectedSpace]);

  const resetForSpace = (spaceId: string) => {
    setSelectedSpaceId(spaceId);
    const space = spaces.find((candidate) => candidate.id === spaceId);
    setScopeDraft(space?.units.map((row) => row.unitId) ?? []);
    setSelectedPerson(null);
    setSearchResults([]);
    setSearchQuery('');
    setPreset('resort_manager');
    setCapabilities(PRESETS.resort_manager);
    setError(null);
  };

  const choosePerson = (person: Person) => {
    setSelectedPerson(person);
    const existing = selectedSpace?.members.find((member) => member.identityId === person.id);
    if (existing) {
      const nextPreset = PRESETS[existing.preset] ? existing.preset : 'custom';
      setPreset(nextPreset);
      setCapabilities(existing.capabilities.filter((value): value is Capability =>
        CAPABILITIES.includes(value as Capability)
      ));
    } else {
      setPreset('resort_manager');
      setCapabilities(PRESETS.resort_manager);
    }
  };

  const searchPeople = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/people/search?q=' + encodeURIComponent(searchQuery) + '&limit=20');
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'Could not search people');
      setSearchResults(payload.identities ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not search people');
    } finally {
      setBusy(false);
    }
  };

  const createSpace = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/operating-spaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'Could not create operating space');
      router.refresh();
      setSelectedSpaceId(payload.space.id);
      setCreateForm({
        key: '',
        name: '',
        organizationId: organizations[0]?.id ?? '',
        timezone: 'Asia/Bangkok',
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create operating space');
    } finally {
      setBusy(false);
    }
  };

  const saveScope = async () => {
    if (!selectedSpace) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/operating-spaces/' + encodeURIComponent(selectedSpace.id) + '/scope', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unitIds: scopeDraft }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'Could not save scope');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save scope');
    } finally {
      setBusy(false);
    }
  };

  const saveMember = async (active: boolean) => {
    if (!selectedSpace || !selectedPerson) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/operating-spaces/' + encodeURIComponent(selectedSpace.id) + '/members', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identityId: selectedPerson.id,
          active,
          preset,
          capabilities: active ? capabilities : [],
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'Could not save access');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save access');
    } finally {
      setBusy(false);
    }
  };

  const applyPreset = (value: string) => {
    setPreset(value);
    if (value !== 'custom') setCapabilities(PRESETS[value] ?? []);
  };

  const toggleCapability = (capability: Capability) => {
    setPreset('custom');
    setCapabilities((current) =>
      current.includes(capability)
        ? current.filter((value) => value !== capability)
        : [...current, capability]
    );
  };

  return (
    <main className="space-y-24">
      <header className="stitch-hero-dark p-24 md:p-32">
        <p className="stitch-kicker text-brand-sun-soft">{labels['admin.governance.kicker']}</p>
        <h1 className="mt-8 font-display text-display-xl font-semibold tracking-[-0.025em] text-white">
          {labels['admin.governance.title']}
        </h1>
        <p className="mt-8 max-w-4xl text-body text-white/70">
          {labels['admin.governance.subtitle']}
        </p>
        <div className="mt-20 flex flex-wrap gap-8">
          <Link href="/app/admin/people" className="rounded-md bg-white px-14 py-10 text-small font-semibold text-brand-deep">
            {labels['admin.governance.people_link']} →
          </Link>
          <Link href="/app/admin/projects" className="rounded-md border border-white/20 px-14 py-10 text-small font-semibold text-white">
            {labels['admin.governance.projects_link']} →
          </Link>
          <Link href="/app/admin/audit" className="rounded-md border border-white/20 px-14 py-10 text-small font-semibold text-white">
            {labels['admin.governance.audit_link']} →
          </Link>
        </div>
      </header>

      {error ? (
        <div className="rounded-md border border-state-error/40 bg-state-error/5 p-16 text-small text-state-error">
          {error}
        </div>
      ) : null}

      <section className="stitch-panel p-20">
        <h2 className="font-display text-title font-semibold text-text-ink">{labels['admin.governance.root_title']}</h2>
        <p className="mt-4 text-small text-text-secondary">{labels['admin.governance.root_hint']}</p>
        <div className="mt-16 grid gap-8 md:grid-cols-2 xl:grid-cols-3">
          {admins.map((admin) => (
            <div key={admin.id} className="rounded-md border border-brand-sun/40 bg-surface-ivory p-12">
              <p className="font-semibold text-text-ink">{admin.firstName} {admin.lastName}</p>
              <p className="text-small text-text-secondary">{admin.email ?? '—'}</p>
              <p className="mt-6 text-kicker font-semibold uppercase tracking-wider text-brand-andaman">
                {labels['admin.governance.root_badge']}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-16 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="stitch-panel p-16">
          <h2 className="font-display text-title font-semibold text-text-ink">{labels['admin.governance.spaces_title']}</h2>
          <div className="mt-12 space-y-8">
            {spaces.map((space) => (
              <button
                key={space.id}
                type="button"
                onClick={() => resetForSpace(space.id)}
                className={
                  'w-full rounded-md border p-12 text-left transition ' +
                  (selectedSpace?.id === space.id
                    ? 'border-brand-andaman bg-surface-mint'
                    : 'border-border-line bg-surface-paper hover:border-brand-andaman/40')
                }
              >
                <p className="font-semibold text-text-ink">{space.name}</p>
                <p className="mt-2 text-small text-text-secondary">{space.organization.name}</p>
                <p className="mt-6 text-kicker uppercase tracking-wider text-text-secondary">
                  {space.units.length} {labels['admin.governance.metrics_homes']} · {space.members.filter((member) => member.active).length} {labels['admin.governance.metrics_people']}
                </p>
              </button>
            ))}
          </div>

          <div className="mt-20 border-t border-border-line pt-16">
            <h3 className="font-semibold text-text-ink">{labels['admin.governance.create_title']}</h3>
            <p className="mt-4 text-small text-text-secondary">{labels['admin.governance.create_hint']}</p>
            <div className="mt-12 space-y-8">
              <input
                value={createForm.name}
                onChange={(event) => setCreateForm({ ...createForm, name: event.target.value })}
                placeholder="Portfolio / resort name"
                className="h-40 w-full rounded-sm border border-border-line px-10"
              />
              <input
                value={createForm.key}
                onChange={(event) => setCreateForm({ ...createForm, key: event.target.value })}
                placeholder="stable-key"
                className="h-40 w-full rounded-sm border border-border-line px-10 font-mono text-small"
              />
              <select
                value={createForm.organizationId}
                onChange={(event) => setCreateForm({ ...createForm, organizationId: event.target.value })}
                className="h-40 w-full rounded-sm border border-border-line px-10"
              >
                {organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>{organization.name}</option>
                ))}
              </select>
              <button
                type="button"
                disabled={busy || !createForm.name.trim() || !createForm.key.trim() || !createForm.organizationId}
                onClick={createSpace}
                className="w-full rounded-md bg-brand-deep px-12 py-10 text-small font-semibold text-white disabled:opacity-50"
              >
                {labels['admin.governance.create_action']}
              </button>
            </div>
          </div>
        </aside>

        {selectedSpace ? (
          <div className="space-y-16">
            <section className="stitch-panel p-20">
              <p className="stitch-kicker">{selectedSpace.key}</p>
              <div className="mt-4 flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2 className="font-display text-heading-2 font-semibold text-text-ink">{selectedSpace.name}</h2>
                  <p className="mt-4 text-small text-text-secondary">
                    {selectedSpace.organization.name} · {selectedSpace.timezone}
                  </p>
                  <p className="mt-4 text-small text-text-secondary">
                    {selectedProjectNames.length ? selectedProjectNames.join(' · ') : labels['admin.governance.no_inventory']}
                  </p>
                </div>
                <Link
                  href={'/ops/spaces/' + encodeURIComponent(selectedSpace.id)}
                  className="text-small font-semibold text-brand-andaman"
                >
                  {labels['admin.governance.open_workspace']} →
                </Link>
              </div>
            </section>

            <section className="stitch-panel p-20">
              <div className="flex items-center justify-between gap-12">
                <div>
                  <h2 className="font-display text-title font-semibold text-text-ink">{labels['admin.governance.scope_title']}</h2>
                  <p className="mt-4 text-small text-text-secondary">
                    {labels['admin.governance.scope_hint']}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={saveScope}
                  className="rounded-md bg-brand-andaman px-14 py-10 text-small font-semibold text-white disabled:opacity-50"
                >
                  {labels['admin.governance.scope_save']}
                </button>
              </div>
              <div className="mt-16 space-y-16">
                {projects.filter((project) => project.units.length).map((project) => (
                  <div key={project.id}>
                    <div className="flex items-center justify-between gap-8">
                      <h3 className="font-semibold text-text-ink">{project.name}</h3>
                      <button
                        type="button"
                        className="text-small font-semibold text-brand-andaman"
                        onClick={() => {
                          const ids = project.units.map((unit) => unit.id);
                          const allSelected = ids.every((id) => scopeDraft.includes(id));
                          setScopeDraft((current) =>
                            allSelected
                              ? current.filter((id) => !ids.includes(id))
                              : Array.from(new Set([...current, ...ids]))
                          );
                        }}
                      >
                        {labels['admin.governance.toggle_project']}
                      </button>
                    </div>
                    <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                      {project.units.map((unit) => (
                        <label key={unit.id} className="flex items-center gap-8 rounded-md border border-border-line p-10 text-small">
                          <input
                            type="checkbox"
                            checked={scopeDraft.includes(unit.id)}
                            onChange={() => setScopeDraft((current) =>
                              current.includes(unit.id)
                                ? current.filter((id) => id !== unit.id)
                                : [...current, unit.id]
                            )}
                          />
                          <span>{unit.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="stitch-panel p-20">
              <h2 className="font-display text-title font-semibold text-text-ink">{labels['admin.governance.people_title']}</h2>
              <p className="mt-4 text-small text-text-secondary">
                {labels['admin.governance.people_hint']}
              </p>

              <div className="mt-16 grid gap-16 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                <div>
                  <h3 className="text-small font-semibold uppercase tracking-wider text-text-secondary">{labels['admin.governance.current_team']}</h3>
                  <div className="mt-8 space-y-8">
                    {selectedSpace.members.filter((member) => member.active).map((member) => (
                      <button
                        key={member.identityId}
                        type="button"
                        onClick={() => choosePerson(member.identity)}
                        className={
                          'w-full rounded-md border p-12 text-left ' +
                          (selectedPerson?.id === member.identityId ? 'border-brand-andaman bg-surface-mint' : 'border-border-line')
                        }
                      >
                        <div className="flex items-start justify-between gap-8">
                          <div>
                            <p className="font-semibold text-text-ink">
                              {member.identity.firstName} {member.identity.lastName}
                            </p>
                            <p className="text-small text-text-secondary">{member.identity.email ?? '—'}</p>
                          </div>
                          <span className="rounded-full bg-surface-ivory px-8 py-4 text-kicker font-semibold uppercase tracking-wider text-brand-andaman">
                            {PRESET_LABELS[member.preset] ?? PRESET_LABELS.custom}
                          </span>
                        </div>
                        <p className="mt-8 text-small text-text-secondary">
                          {member.capabilities.length} {labels['admin.governance.capabilities_suffix']}
                        </p>
                      </button>
                    ))}
                    {!selectedSpace.members.some((member) => member.active) ? (
                      <p className="rounded-md border border-dashed border-border-line p-12 text-small text-text-secondary">
                        {labels['admin.governance.no_managers']}
                      </p>
                    ) : null}
                  </div>

                  <div className="mt-16 border-t border-border-line pt-16">
                    <h3 className="text-small font-semibold uppercase tracking-wider text-text-secondary">{labels['admin.governance.add_person']}</h3>
                    <div className="mt-8 flex gap-8">
                      <input
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        onKeyDown={(event) => event.key === 'Enter' && searchPeople()}
                        placeholder="Name or email"
                        className="h-40 min-w-0 flex-1 rounded-sm border border-border-line px-10"
                      />
                      <button
                        type="button"
                        disabled={busy}
                        onClick={searchPeople}
                        className="rounded-md border border-brand-andaman px-12 text-small font-semibold text-brand-andaman"
                      >
                        Search
                      </button>
                    </div>
                    <div className="mt-8 space-y-6">
                      {searchResults.map((person) => (
                        <button
                          key={person.id}
                          type="button"
                          onClick={() => choosePerson(person)}
                          className="w-full rounded-md border border-border-line p-10 text-left hover:border-brand-andaman/50"
                        >
                          <span className="font-semibold text-text-ink">{person.firstName} {person.lastName}</span>
                          <span className="ml-6 text-small text-text-secondary">{person.email ?? '—'}</span>
                          {person.isAdmin ? <span className="ml-6 text-kicker text-brand-andaman">{labels['admin.governance.root_badge_short']}</span> : null}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-border-line bg-surface-ivory p-16">
                  {selectedPerson ? (
                    <>
                      <p className="font-display text-heading-3 font-semibold text-text-ink">
                        {selectedPerson.firstName} {selectedPerson.lastName}
                      </p>
                      <p className="text-small text-text-secondary">{selectedPerson.email ?? '—'}</p>

                      {selectedPerson.isAdmin ? (
                        <div className="mt-16 rounded-md border border-brand-sun/40 bg-white p-12 text-small text-text-secondary">
                          {labels['admin.governance.root_identity_hint']}
                        </div>
                      ) : (
                        <>
                          <label className="mt-16 block text-small font-semibold text-text-secondary">{labels['admin.governance.preset_label']}</label>
                          <select
                            value={preset}
                            onChange={(event) => applyPreset(event.target.value)}
                            className="mt-6 h-44 w-full rounded-sm border border-border-line bg-white px-10"
                          >
                            {Object.entries(PRESET_LABELS).map(([value, label]) => (
                              <option key={value} value={value}>{label}</option>
                            ))}
                          </select>

                          <div className="mt-16 grid gap-8 sm:grid-cols-2">
                            {CAPABILITIES.map((capability) => (
                              <label key={capability} className="flex items-start gap-8 rounded-md border border-border-line bg-white p-10 text-small">
                                <input
                                  type="checkbox"
                                  checked={capabilities.includes(capability)}
                                  onChange={() => toggleCapability(capability)}
                                />
                                <span>{capability.replace(/_/g, ' ')}</span>
                              </label>
                            ))}
                          </div>

                          <div className="mt-16 flex flex-wrap gap-8">
                            <button
                              type="button"
                              disabled={busy || capabilities.length === 0}
                              onClick={() => saveMember(true)}
                              className="rounded-md bg-brand-deep px-16 py-10 text-small font-semibold text-white disabled:opacity-50"
                            >
                              {activeMember ? labels['admin.governance.update_access'] : labels['admin.governance.assign_access']}
                            </button>
                            {activeMember?.active ? (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => saveMember(false)}
                                className="rounded-md border border-state-error px-16 py-10 text-small font-semibold text-state-error disabled:opacity-50"
                              >
                                {labels['admin.governance.revoke_access']}
                              </button>
                            ) : null}
                          </div>
                        </>
                      )}
                    </>
                  ) : (
                    <p className="text-small text-text-secondary">
                      {labels['admin.governance.select_person_hint']}
                    </p>
                  )}
                </div>
              </div>
            </section>
          </div>
        ) : (
          <div className="stitch-panel p-24 text-body text-text-secondary">
            {labels['admin.governance.empty_space']}
          </div>
        )}
      </section>
    </main>
  );
}
