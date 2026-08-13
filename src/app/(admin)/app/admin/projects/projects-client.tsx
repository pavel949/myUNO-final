'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/Button';

interface AdminProject {
  id: string;
  slug: string;
  name: string;
  status: string;
  address: string;
}

type Labels = Record<string, string>;

const STATUSES = ['draft', 'live', 'archived'] as const;

export default function ProjectsAdminClient({
  projects,
  labels,
}: {
  projects: AdminProject[];
  labels: Labels;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, Partial<AdminProject>>>({});
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    slug: '',
    name: '',
    address: '',
    latitude: '',
    longitude: '',
  });

  const fieldClass =
    'h-40 px-12 rounded-sm bg-surface-paper border border-border-line text-small text-text-ink w-full';

  const saveProject = async (projectId: string) => {
    setBusyId(projectId);
    setError(null);
    try {
      const response = await fetch(`/api/admin/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(edits[projectId] || {}),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || labels['admin.projects.error_generic']);
      }
      setEditingId(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : labels['admin.projects.error_generic']);
    } finally {
      setBusyId(null);
    }
  };

  const createProject = async () => {
    setBusyId('new');
    setError(null);
    try {
      const response = await fetch('/api/admin/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: draft.slug,
          name: draft.name,
          address: draft.address,
          latitude: Number(draft.latitude),
          longitude: Number(draft.longitude),
          // Content keys follow the project.{slug}.* convention (doc 05 §4)
          areaLabelKey: `project.${draft.slug}.area`,
          descriptionKey: `project.${draft.slug}.description`,
          handbookKey: `project.${draft.slug}.handbook`,
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || labels['admin.projects.error_generic']);
      }
      setDraft({ slug: '', name: '', address: '', latitude: '', longitude: '' });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : labels['admin.projects.error_generic']);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex flex-col gap-16">
      {error ? (
        <div className="bg-state-error/10 border border-state-error rounded-lg p-16">
          <p className="text-body text-state-error">{error}</p>
        </div>
      ) : null}

      {projects.length === 0 ? (
        <p className="text-body text-text-secondary">{labels['admin.projects.empty']}</p>
      ) : null}

      {projects.map((project) => {
        const edit = edits[project.id] || {};
        const isEditing = editingId === project.id;
        return (
          <div
            key={project.id}
            className="bg-surface-paper border border-border-line rounded-lg p-16 flex flex-col gap-8"
          >
            <div className="flex flex-wrap items-center justify-between gap-8">
              <div>
                <p className="text-subtitle font-semibold text-text-ink">
                  {project.name}{' '}
                  <span className="text-small text-text-secondary">/{project.slug}</span>
                </p>
                <p className="text-small text-text-secondary">{project.address}</p>
              </div>
              <div className="flex items-center gap-8">
                <span className="px-12 py-4 rounded-full text-small font-semibold bg-surface-ivory text-text-ink">
                  {project.status}
                </span>
                <Link
                  href={`/app/admin/config?projectId=${project.id}`}
                  className="text-small text-brand-andaman font-semibold"
                >
                  {labels['admin.projects.config_link']}
                </Link>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setEditingId(isEditing ? null : project.id);
                    setEdits((prev) => ({ ...prev, [project.id]: {} }));
                  }}
                >
                  {isEditing
                    ? labels['admin.projects.cancel_edit']
                    : labels['admin.projects.edit']}
                </Button>
              </div>
            </div>
            {isEditing ? (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-8 items-end">
                <div>
                  <label className="text-small text-text-secondary block mb-4">
                    {labels['admin.projects.name']}
                  </label>
                  <input
                    className={fieldClass}
                    defaultValue={project.name}
                    onChange={(e) =>
                      setEdits((prev) => ({
                        ...prev,
                        [project.id]: { ...prev[project.id], name: e.target.value },
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="text-small text-text-secondary block mb-4">
                    {labels['admin.projects.address']}
                  </label>
                  <input
                    className={fieldClass}
                    defaultValue={project.address}
                    onChange={(e) =>
                      setEdits((prev) => ({
                        ...prev,
                        [project.id]: { ...prev[project.id], address: e.target.value },
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="text-small text-text-secondary block mb-4">
                    {labels['admin.projects.status']}
                  </label>
                  <select
                    className={fieldClass}
                    defaultValue={project.status}
                    onChange={(e) =>
                      setEdits((prev) => ({
                        ...prev,
                        [project.id]: { ...prev[project.id], status: e.target.value },
                      }))
                    }
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <Button
                  size="sm"
                  variant="sun"
                  onClick={() => saveProject(project.id)}
                  isLoading={busyId === project.id}
                  disabled={Object.keys(edit).length === 0}
                >
                  {labels['admin.projects.save']}
                </Button>
              </div>
            ) : null}
          </div>
        );
      })}

      <div className="bg-surface-paper border border-border-line rounded-lg p-16">
        <p className="text-subtitle font-semibold text-text-ink mb-12">
          {labels['admin.projects.create_title']}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 items-end">
          <div>
            <label className="text-small text-text-secondary block mb-4">
              {labels['admin.projects.slug']}
            </label>
            <input
              className={fieldClass}
              value={draft.slug}
              onChange={(e) => setDraft((d) => ({ ...d, slug: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-small text-text-secondary block mb-4">
              {labels['admin.projects.name']}
            </label>
            <input
              className={fieldClass}
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-small text-text-secondary block mb-4">
              {labels['admin.projects.address']}
            </label>
            <input
              className={fieldClass}
              value={draft.address}
              onChange={(e) => setDraft((d) => ({ ...d, address: e.target.value }))}
            />
          </div>
          <div className="flex gap-8">
            <input
              className={fieldClass}
              placeholder={labels['admin.projects.latitude']}
              value={draft.latitude}
              onChange={(e) => setDraft((d) => ({ ...d, latitude: e.target.value }))}
            />
            <input
              className={fieldClass}
              placeholder={labels['admin.projects.longitude']}
              value={draft.longitude}
              onChange={(e) => setDraft((d) => ({ ...d, longitude: e.target.value }))}
            />
          </div>
          <Button
            size="sm"
            onClick={createProject}
            isLoading={busyId === 'new'}
            disabled={
              !draft.slug ||
              !draft.name ||
              !draft.address ||
              !Number.isFinite(Number(draft.latitude)) ||
              !Number.isFinite(Number(draft.longitude)) ||
              draft.latitude === '' ||
              draft.longitude === ''
            }
          >
            {labels['admin.projects.create']}
          </Button>
        </div>
      </div>
    </div>
  );
}
