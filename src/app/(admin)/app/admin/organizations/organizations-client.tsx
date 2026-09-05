'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/Button';

interface AdminOrganizationRow {
  id: string;
  name: string;
  orgType: string;
  projectId: string | null;
  projectName: string | null;
  contactEmail: string;
  contactPhone: string;
  status: string;
  memberCount: number;
  engagementCount: number;
}

type Labels = Record<string, string>;

const ORG_TYPES = [
  { key: 'all', orgType: '', labelKey: 'admin.organizations.filter_all' },
  {
    key: 'mc',
    orgType: 'management_company',
    labelKey: 'admin.organizations.filter_mc',
  },
  {
    key: 'juristic',
    orgType: 'juristic_person',
    labelKey: 'admin.organizations.filter_juristic',
  },
  {
    key: 'developer',
    orgType: 'developer',
    labelKey: 'admin.organizations.filter_developer',
  },
] as const;

function mapOrganization(
  raw: Record<string, unknown>,
  projectNameById: Record<string, string>
): AdminOrganizationRow {
  const roleAssignments = Array.isArray(raw.roleAssignments) ? raw.roleAssignments : [];
  const engagements = Array.isArray(raw.engagements) ? raw.engagements : [];
  const projectId = raw.projectId ? String(raw.projectId) : null;

  return {
    id: String(raw.id),
    name: String(raw.name),
    orgType: String(raw.orgType),
    projectId,
    projectName: projectId ? projectNameById[projectId] || projectId : null,
    contactEmail: String(raw.contactEmail),
    contactPhone: String(raw.contactPhone),
    status: String(raw.status),
    memberCount: roleAssignments.length,
    engagementCount: engagements.length,
  };
}

export default function AdminOrganizationsClient({
  labels,
  projects,
}: {
  labels: Labels;
  projects: Array<{ id: string; name: string }>;
}) {
  const [activeFilter, setActiveFilter] =
    useState<(typeof ORG_TYPES)[number]['key']>('all');
  const [organizations, setOrganizations] = useState<AdminOrganizationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edits, setEdits] = useState<
    Record<string, { name: string; contactEmail: string; contactPhone: string }>
  >({});
  const [draft, setDraft] = useState({
    name: '',
    orgType: 'management_company',
    projectId: '',
    contactEmail: '',
    contactPhone: '',
  });

  const projectNameById = useMemo(
    () => Object.fromEntries(projects.map((p) => [p.id, p.name])),
    [projects]
  );

  const load = useCallback(
    async (filter: (typeof ORG_TYPES)[number]['key']) => {
      setLoading(true);
      setError(null);
      const orgType = ORG_TYPES.find((item) => item.key === filter)?.orgType ?? '';
      const params = new URLSearchParams();
      if (orgType) params.set('orgType', orgType);
      try {
        const response = await fetch(`/api/admin/organizations?${params.toString()}`);
        if (!response.ok) {
          throw new Error(labels['admin.organizations.error']);
        }
        const data = await response.json();
        const rows = Array.isArray(data.organizations) ? data.organizations : [];
        setOrganizations(
          rows.map((row: Record<string, unknown>) => mapOrganization(row, projectNameById))
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : labels['admin.organizations.error']);
        setOrganizations([]);
      } finally {
        setLoading(false);
      }
    },
    [labels, projectNameById]
  );

  useEffect(() => {
    void load(activeFilter);
  }, [activeFilter, load]);

  const typeLabel = (type: string) =>
    labels[`admin.organizations.type.${type}`] || type;

  const startEdit = (org: AdminOrganizationRow) => {
    setEditingId(org.id);
    setEdits((prev) => ({
      ...prev,
      [org.id]: {
        name: org.name,
        contactEmail: org.contactEmail,
        contactPhone: org.contactPhone,
      },
    }));
  };

  const saveEdit = async (orgId: string) => {
    const edit = edits[orgId];
    if (!edit) return;
    setBusyId(orgId);
    setError(null);
    try {
      const response = await fetch(`/api/admin/organizations/${orgId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(edit),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || labels['admin.organizations.error']);
      }
      setEditingId(null);
      await load(activeFilter);
    } catch (err) {
      setError(err instanceof Error ? err.message : labels['admin.organizations.error']);
    } finally {
      setBusyId(null);
    }
  };

  const createOrg = async () => {
    if (!draft.name.trim() || !draft.contactEmail.trim() || !draft.contactPhone.trim()) {
      return;
    }
    setBusyId('new');
    setError(null);
    try {
      const response = await fetch('/api/admin/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: draft.name.trim(),
          orgType: draft.orgType,
          contactEmail: draft.contactEmail.trim(),
          contactPhone: draft.contactPhone.trim(),
          ...(draft.projectId ? { projectId: draft.projectId } : {}),
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || labels['admin.organizations.error']);
      }
      setDraft({
        name: '',
        orgType: 'management_company',
        projectId: '',
        contactEmail: '',
        contactPhone: '',
      });
      await load(activeFilter);
    } catch (err) {
      setError(err instanceof Error ? err.message : labels['admin.organizations.error']);
    } finally {
      setBusyId(null);
    }
  };

  const deleteOrg = async (org: AdminOrganizationRow) => {
    if (
      !window.confirm(
        labels['admin.organizations.confirm_delete'].replace('{name}', org.name)
      )
    ) {
      return;
    }
    setBusyId(org.id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/organizations/${org.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || labels['admin.organizations.error']);
      }
      await load(activeFilter);
    } catch (err) {
      setError(err instanceof Error ? err.message : labels['admin.organizations.error']);
    } finally {
      setBusyId(null);
    }
  };

  const fieldClass =
    'h-40 px-12 rounded-sm bg-surface-paper border border-border-line text-small text-text-ink w-full';

  return (
    <div>
      {error && (
        <div className="bg-state-error-soft border border-state-error rounded-lg p-16 mb-24">
          <p className="text-body text-state-error">{error}</p>
        </div>
      )}

      <section className="bg-surface-paper border border-border-line rounded-lg p-24 mb-24">
        <h2 className="text-heading-3 font-semibold text-text-ink mb-16">
          {labels['admin.organizations.create_title']}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 mb-16">
          <label className="block">
            <span className="text-small text-text-secondary">
              {labels['admin.organizations.col_name']}
            </span>
            <input
              type="text"
              value={draft.name}
              onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
              className={fieldClass}
            />
          </label>
          <label className="block">
            <span className="text-small text-text-secondary">
              {labels['admin.organizations.col_type']}
            </span>
            <select
              value={draft.orgType}
              onChange={(e) => setDraft((prev) => ({ ...prev, orgType: e.target.value }))}
              className={fieldClass}
            >
              <option value="management_company">
                {labels['admin.organizations.type.management_company']}
              </option>
              <option value="juristic_person">
                {labels['admin.organizations.type.juristic_person']}
              </option>
              <option value="developer">{labels['admin.organizations.type.developer']}</option>
            </select>
          </label>
          <label className="block">
            <span className="text-small text-text-secondary">
              {labels['admin.organizations.col_project']}
            </span>
            <select
              value={draft.projectId}
              onChange={(e) => setDraft((prev) => ({ ...prev, projectId: e.target.value }))}
              className={fieldClass}
            >
              <option value="">{labels['admin.organizations.project_any']}</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-small text-text-secondary">
              {labels['admin.organizations.col_email']}
            </span>
            <input
              type="email"
              value={draft.contactEmail}
              onChange={(e) => setDraft((prev) => ({ ...prev, contactEmail: e.target.value }))}
              className={fieldClass}
            />
          </label>
          <label className="block">
            <span className="text-small text-text-secondary">
              {labels['admin.organizations.col_phone']}
            </span>
            <input
              type="tel"
              value={draft.contactPhone}
              onChange={(e) => setDraft((prev) => ({ ...prev, contactPhone: e.target.value }))}
              className={fieldClass}
            />
          </label>
        </div>
        <Button size="sm" onClick={createOrg} isLoading={busyId === 'new'}>
          {labels['admin.organizations.create_submit']}
        </Button>
      </section>

      <div className="flex flex-wrap gap-8 mb-24">
        {ORG_TYPES.map((filter) => (
          <button
            key={filter.key}
            type="button"
            onClick={() => setActiveFilter(filter.key)}
            className={
              activeFilter === filter.key
                ? 'px-12 py-8 rounded-full text-small bg-brand-andaman text-on-dark-text'
                : 'px-12 py-8 rounded-full text-small bg-surface-paper border border-border-line text-text-ink hover:border-brand-andaman'
            }
          >
            {labels[filter.labelKey]}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-body text-text-secondary">{labels['admin.organizations.loading']}</p>
      ) : organizations.length === 0 ? (
        <p className="text-body text-text-secondary">{labels['admin.organizations.empty']}</p>
      ) : (
        <div className="overflow-x-auto border border-border-line rounded-lg">
          <table className="w-full text-left text-small">
            <thead className="bg-surface-ivory border-b border-border-line">
              <tr>
                <th className="p-12 font-semibold">{labels['admin.organizations.col_name']}</th>
                <th className="p-12 font-semibold">{labels['admin.organizations.col_type']}</th>
                <th className="p-12 font-semibold">{labels['admin.organizations.col_project']}</th>
                <th className="p-12 font-semibold">{labels['admin.organizations.col_contact']}</th>
                <th className="p-12 font-semibold">{labels['admin.organizations.col_members']}</th>
                <th className="p-12 font-semibold">{labels['admin.organizations.col_action']}</th>
              </tr>
            </thead>
            <tbody>
              {organizations.map((org) => {
                const isEditing = editingId === org.id;
                const edit = edits[org.id];
                return (
                  <tr key={org.id} className="border-b border-border-line last:border-0">
                    <td className="p-12">
                      {isEditing ? (
                        <input
                          type="text"
                          value={edit?.name || ''}
                          onChange={(e) =>
                            setEdits((prev) => ({
                              ...prev,
                              [org.id]: { ...prev[org.id], name: e.target.value },
                            }))
                          }
                          className={fieldClass}
                        />
                      ) : (
                        <span className="text-text-ink font-medium">{org.name}</span>
                      )}
                    </td>
                    <td className="p-12 text-text-secondary">{typeLabel(org.orgType)}</td>
                    <td className="p-12 text-text-secondary">{org.projectName || '—'}</td>
                    <td className="p-12">
                      {isEditing ? (
                        <div className="flex flex-col gap-8">
                          <input
                            type="email"
                            value={edit?.contactEmail || ''}
                            onChange={(e) =>
                              setEdits((prev) => ({
                                ...prev,
                                [org.id]: { ...prev[org.id], contactEmail: e.target.value },
                              }))
                            }
                            className={fieldClass}
                          />
                          <input
                            type="tel"
                            value={edit?.contactPhone || ''}
                            onChange={(e) =>
                              setEdits((prev) => ({
                                ...prev,
                                [org.id]: { ...prev[org.id], contactPhone: e.target.value },
                              }))
                            }
                            className={fieldClass}
                          />
                        </div>
                      ) : (
                        <div className="text-text-secondary">
                          <div>{org.contactEmail}</div>
                          <div>{org.contactPhone}</div>
                        </div>
                      )}
                    </td>
                    <td className="p-12 text-text-secondary">
                      {org.memberCount} / {org.engagementCount}
                    </td>
                    <td className="p-12">
                      <div className="flex flex-wrap gap-8">
                        {isEditing ? (
                          <>
                            <Button
                              size="sm"
                              onClick={() => saveEdit(org.id)}
                              isLoading={busyId === org.id}
                            >
                              {labels['admin.organizations.save']}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingId(null)}
                            >
                              {labels['admin.organizations.cancel']}
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button size="sm" variant="secondary" onClick={() => startEdit(org)}>
                              {labels['admin.organizations.edit']}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteOrg(org)}
                              isLoading={busyId === org.id}
                              disabled={org.engagementCount > 0}
                            >
                              {labels['admin.organizations.delete']}
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
