'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/Button';

const UNIT_TYPES = ['villa', 'condo', 'townhouse'];

type Labels = Record<string, string>;
type Category = {
  id: string;
  projectId: string;
  categoryKey: string;
  name: string;
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  baseNightlyThb: number;
  minNights: number;
};

export default function CreateUnitForm({
  projects,
  categories,
  labels,
}: {
  projects: Array<{ id: string; name: string }>;
  categories: Category[];
  labels: Labels;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '');
  const availableCategories = useMemo(
    () => categories.filter((category) => category.projectId === projectId),
    [categories, projectId]
  );
  const [categoryId, setCategoryId] = useState('');
  const selectedCategory =
    availableCategories.find((category) => category.id === categoryId) ?? availableCategories[0] ?? null;

  if (projects.length === 0) {
    return <p className="text-body text-text-secondary mb-16">{labels['admin.units.no_projects']}</p>;
  }

  if (!open) {
    return (
      <div className="mb-24">
        <Button
          onClick={() => {
            setOpen(true);
            const firstProject = projects[0]?.id ?? '';
            setProjectId(firstProject);
            setCategoryId(categories.find((c) => c.projectId === firstProject)?.id ?? '');
          }}
        >
          {labels['admin.units.create']}
        </Button>
      </div>
    );
  }

  return (
    <form
      className="bg-surface-paper border border-border-line rounded-lg p-24 mb-24"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget as HTMLFormElement);
        const category =
          availableCategories.find((item) => item.id === String(form.get('inventoryCategoryId'))) ?? null;
        if (!category) {
          setError(labels['admin.units.category_required']);
          return;
        }

        setBusy(true);
        setError(null);
        try {
          const response = await fetch('/api/admin/units', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectId,
              inventoryCategoryId: category.id,
              name: String(form.get('name') || '').trim(),
              unitType: form.get('unitType'),
              bedrooms: category.bedrooms,
              bathrooms: category.bathrooms,
              maxGuests: category.maxGuests,
              addressSupplement: String(form.get('addressSupplement') || '').trim(),
            }),
          });
          if (!response.ok) {
            const data = await response.json().catch(() => null);
            throw new Error(data?.error || labels['admin.units.error_generic']);
          }
          const unit = await response.json();
          router.push(`/app/admin/units/${unit.id}`);
        } catch (err) {
          setError(err instanceof Error ? err.message : labels['admin.units.error_generic']);
        } finally {
          setBusy(false);
        }
      }}
    >
      {error && (
        <div className="bg-state-error-soft border border-state-error rounded-lg p-16 mb-16">
          <p className="text-body text-state-error">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-16">
        <label className="text-small text-text-secondary">
          {labels['admin.units.project']}
          <select
            name="projectId"
            value={projectId}
            onChange={(e) => {
              const nextProjectId = e.target.value;
              setProjectId(nextProjectId);
              setCategoryId(categories.find((c) => c.projectId === nextProjectId)?.id ?? '');
            }}
            required
            className="block h-40 w-full mt-4 rounded-sm border border-border-line px-12 text-body text-text-ink"
          >
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-small text-text-secondary md:col-span-2">
          {labels['admin.units.category']}
          <select
            name="inventoryCategoryId"
            value={selectedCategory?.id ?? ''}
            onChange={(e) => setCategoryId(e.target.value)}
            required
            disabled={availableCategories.length === 0}
            className="block h-40 w-full mt-4 rounded-sm border border-border-line px-12 text-body text-text-ink"
          >
            {availableCategories.length === 0 ? (
              <option value="">{labels['admin.units.category_required']}</option>
            ) : (
              availableCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name} · {category.bedrooms}BR · ฿{Math.round(category.baseNightlyThb / 100).toLocaleString()}/night
                </option>
              ))
            )}
          </select>
        </label>

        <label className="text-small text-text-secondary">
          {labels['admin.units.name']}
          <input
            name="name"
            required
            className="block h-40 w-full mt-4 rounded-sm border border-border-line px-12 text-body text-text-ink"
          />
        </label>
        <label className="text-small text-text-secondary">
          {labels['admin.units.type']}
          <select
            name="unitType"
            className="block h-40 w-full mt-4 rounded-sm border border-border-line px-12 text-body text-text-ink"
          >
            {UNIT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <label className="text-small text-text-secondary md:col-span-2">
          {labels['admin.units.address_supplement']}
          <input
            name="addressSupplement"
            required
            className="block h-40 w-full mt-4 rounded-sm border border-border-line px-12 text-body text-text-ink"
          />
        </label>
      </div>

      {selectedCategory && (
        <div className="mt-16 rounded-sm bg-surface-ivory border border-border-line p-12 text-small text-text-secondary">
          {selectedCategory.bedrooms} {labels['admin.units.bedrooms'].toLowerCase()} ·{' '}
          {selectedCategory.bathrooms} {labels['admin.units.bathrooms'].toLowerCase()} ·{' '}
          {selectedCategory.maxGuests} {labels['admin.units.max_guests'].toLowerCase()} ·{' '}
          ฿{Math.round(selectedCategory.baseNightlyThb / 100).toLocaleString()}/night ·{' '}
          {selectedCategory.minNights} min nights
        </div>
      )}

      <div className="flex gap-12 mt-24">
        <Button type="submit" disabled={busy || !selectedCategory}>
          {busy ? labels['admin.units.saving'] : labels['admin.units.create']}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
          {labels['admin.units.cancel']}
        </Button>
      </div>
    </form>
  );
}
