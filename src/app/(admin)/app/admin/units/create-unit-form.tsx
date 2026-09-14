'use client';

import { useMemo, useState } from 'react';
import { bahtToSatang } from '@/lib/money';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/Button';

/**
 * Creating a unit.
 *
 * A physical unit belongs to a sellable InventoryCategory. When a project has
 * canonical categories, the operator selects one and commercial defaults are
 * copied from that category only for the legacy Unit compatibility columns.
 * Draft creation is still allowed for a project whose categories have not yet
 * been configured, but the go-live guard will refuse publication until one is
 * assigned.
 */

const UNIT_TYPES = ['villa', 'condo', 'townhouse'];

type Labels = Record<string, string>;
type CategoryOption = {
  id: string;
  categoryKey: string;
  name: string;
  baseNightlyBaht: number;
  minNights: number;
};
type ProjectOption = {
  id: string;
  name: string;
  categories: CategoryOption[];
};

export default function CreateUnitForm({
  projects,
  labels,
}: {
  projects: ProjectOption[];
  labels: Labels;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '');
  const selectedProject = useMemo(
    () => projects.find((project) => project.id === projectId) ?? projects[0],
    [projectId, projects]
  );
  const [categoryKey, setCategoryKey] = useState(
    projects[0]?.categories[0]?.categoryKey ?? ''
  );

  const categories = selectedProject?.categories ?? [];
  const effectiveCategoryKey = categories.some((category) => category.categoryKey === categoryKey)
    ? categoryKey
    : categories[0]?.categoryKey ?? '';
  const selectedCategory = categories.find(
    (category) => category.categoryKey === effectiveCategoryKey
  );

  if (projects.length === 0) {
    return <p className="text-body text-text-secondary mb-16">{labels['admin.units.no_projects']}</p>;
  }

  if (!open) {
    return (
      <div className="mb-24">
        <Button onClick={() => setOpen(true)}>{labels['admin.units.create']}</Button>
      </div>
    );
  }

  return (
    <form
      className="bg-surface-paper border border-border-line rounded-lg p-24 mb-24"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget as HTMLFormElement);
        const formProjectId = String(form.get('projectId') || '');
        const project = projects.find((item) => item.id === formProjectId);
        const formCategoryKey = String(form.get('categoryKey') || '');
        const category = project?.categories.find(
          (item) => item.categoryKey === formCategoryKey
        );

        setBusy(true);
        setError(null);
        try {
          const response = await fetch('/api/admin/units', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectId: formProjectId,
              ...(category && { categoryKey: category.categoryKey }),
              name: String(form.get('name') || '').trim(),
              unitType: form.get('unitType'),
              bedrooms: Number(form.get('bedrooms')),
              bathrooms: Number(form.get('bathrooms')),
              maxGuests: Number(form.get('maxGuests')),
              addressSupplement: String(form.get('addressSupplement') || '').trim(),
              // Unit commercial columns remain compatibility storage while
              // legacy fixtures/consumers migrate. For a canonical unit they
              // mirror, rather than independently define, the category terms.
              baseNightlyThb: category
                ? bahtToSatang(category.baseNightlyBaht)
                : bahtToSatang(Number(form.get('baseNightlyThb'))),
              minNights: category
                ? category.minNights
                : Number(form.get('minNights')) || 1,
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
            required
            value={projectId}
            onChange={(event) => {
              const nextProjectId = event.target.value;
              setProjectId(nextProjectId);
              const nextProject = projects.find((project) => project.id === nextProjectId);
              setCategoryKey(nextProject?.categories[0]?.categoryKey ?? '');
            }}
            className="block h-40 w-full mt-4 rounded-sm border border-border-line px-12 text-body text-text-ink"
          >
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-small text-text-secondary">
          {labels['admin.units.category']}
          <select
            name="categoryKey"
            required={categories.length > 0}
            disabled={categories.length === 0}
            value={effectiveCategoryKey}
            onChange={(event) => setCategoryKey(event.target.value)}
            className="block h-40 w-full mt-4 rounded-sm border border-border-line px-12 text-body text-text-ink disabled:opacity-60"
          >
            {categories.length === 0 ? (
              <option value="">—</option>
            ) : (
              categories.map((category) => (
                <option key={category.id} value={category.categoryKey}>
                  {category.name}
                </option>
              ))
            )}
          </select>
          {selectedCategory && (
            <span className="mt-4 block text-small text-text-stone">
              {labels['admin.units.category_hint']} ฿{selectedCategory.baseNightlyBaht.toLocaleString()} · {selectedCategory.minNights} nights
            </span>
          )}
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
        <label className="text-small text-text-secondary">
          {labels['admin.units.bedrooms']}
          <input
            name="bedrooms"
            type="number"
            min="0"
            defaultValue={1}
            required
            className="block h-40 w-full mt-4 rounded-sm border border-border-line px-12 text-body text-text-ink"
          />
        </label>
        <label className="text-small text-text-secondary">
          {labels['admin.units.bathrooms']}
          <input
            name="bathrooms"
            type="number"
            min="0"
            defaultValue={1}
            required
            className="block h-40 w-full mt-4 rounded-sm border border-border-line px-12 text-body text-text-ink"
          />
        </label>
        <label className="text-small text-text-secondary">
          {labels['admin.units.max_guests']}
          <input
            name="maxGuests"
            type="number"
            min="1"
            defaultValue={2}
            required
            className="block h-40 w-full mt-4 rounded-sm border border-border-line px-12 text-body text-text-ink"
          />
        </label>
        <label className="text-small text-text-secondary md:col-span-2">
          {labels['admin.units.address_supplement']}
          <input
            name="addressSupplement"
            required
            className="block h-40 w-full mt-4 rounded-sm border border-border-line px-12 text-body text-text-ink"
          />
        </label>

        {categories.length === 0 && (
          <>
            <div className="md:col-span-3 rounded-sm border border-state-warning bg-state-warning-soft p-12 text-small text-text-secondary">
              {labels['admin.units.no_categories']}
            </div>
            <label className="text-small text-text-secondary">
              {labels['admin.units.base_nightly']}
              <input
                name="baseNightlyThb"
                type="number"
                min="0"
                required
                className="block h-40 w-full mt-4 rounded-sm border border-border-line px-12 text-body text-text-ink"
              />
            </label>
            <label className="text-small text-text-secondary">
              {labels['admin.units.min_nights']}
              <input
                name="minNights"
                type="number"
                min="1"
                defaultValue={1}
                className="block h-40 w-full mt-4 rounded-sm border border-border-line px-12 text-body text-text-ink"
              />
            </label>
          </>
        )}
      </div>

      <div className="flex gap-12 mt-24">
        <Button type="submit" disabled={busy}>
          {busy ? labels['admin.units.saving'] : labels['admin.units.create']}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
          {labels['admin.units.cancel']}
        </Button>
      </div>
    </form>
  );
}
