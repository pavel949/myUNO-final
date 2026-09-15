'use client';

import { useMemo, useState } from 'react';
import { bahtToSatang } from '@/lib/money';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/Button';

/**
 * Creating a unit.
 *
 * `POST /api/admin/units` existed but no screen called it, so every unit had to
 * be created by hand-writing a request — which is not an onboarding flow, it is
 * a workaround the founder cannot use.
 *
 * The form does not offer a status field. `createUnit` refuses to create a unit
 * live (permitted use is a legal gate), so a status picker here could only
 * offer draft — a control with one option is noise, and one with two would
 * invite the error the service exists to refuse.
 *
 * It does offer a **category**, because a unit cannot reach live without one
 * (audit F-1) and discovering that at go-live is the worst moment to learn it.
 * When a category is chosen, its base rate and minimum stay are the ones that
 * apply — `createUnit` copies them onto the unit's compatibility columns — so
 * the price and min-stay inputs are shown as read-only mirrors rather than
 * pretending the operator is setting a second, competing price.
 */

const UNIT_TYPES = ['villa', 'condo', 'townhouse'];

type Labels = Record<string, string>;

interface CategoryOption {
  categoryKey: string;
  name: string;
  baseNightlyBaht: number;
  minNights: number;
}

interface ProjectOption {
  id: string;
  name: string;
  categories: CategoryOption[];
}

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
  const [categoryKey, setCategoryKey] = useState('');

  const categories = useMemo(
    () => projects.find((project) => project.id === projectId)?.categories ?? [],
    [projects, projectId]
  );
  const selectedCategory = categories.find((category) => category.categoryKey === categoryKey);

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
        setBusy(true);
        setError(null);
        try {
          const response = await fetch('/api/admin/units', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectId,
              name: String(form.get('name') || '').trim(),
              unitType: form.get('unitType'),
              ...(categoryKey ? { categoryKey } : {}),
              bedrooms: Number(form.get('bedrooms')),
              bathrooms: Number(form.get('bathrooms')),
              maxGuests: Number(form.get('maxGuests')),
              addressSupplement: String(form.get('addressSupplement') || '').trim(),
              // A linked category owns these terms; `createUnit` overwrites
              // whatever is sent with the category's own values. They are sent
              // anyway so a project without categories can still draft a unit.
              baseNightlyThb: bahtToSatang(
                selectedCategory
                  ? selectedCategory.baseNightlyBaht
                  : Number(form.get('baseNightlyThb'))
              ),
              minNights: selectedCategory
                ? selectedCategory.minNights
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
              setProjectId(event.target.value);
              setCategoryKey('');
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
            value={categoryKey}
            onChange={(event) => setCategoryKey(event.target.value)}
            className="block h-40 w-full mt-4 rounded-sm border border-border-line px-12 text-body text-text-ink"
          >
            <option value="">{labels['admin.units.category_none']}</option>
            {categories.map((category) => (
              <option key={category.categoryKey} value={category.categoryKey}>
                {category.name}
              </option>
            ))}
          </select>
          <span className="block text-micro text-text-secondary mt-4">
            {categories.length === 0
              ? labels['admin.units.category_missing']
              : labels['admin.units.category_hint']}
          </span>
        </label>
        <label className="text-small text-text-secondary">
          {labels['admin.units.name']}
          <input name="name" required className="block h-40 w-full mt-4 rounded-sm border border-border-line px-12 text-body text-text-ink" />
        </label>
        <label className="text-small text-text-secondary">
          {labels['admin.units.type']}
          <select name="unitType" className="block h-40 w-full mt-4 rounded-sm border border-border-line px-12 text-body text-text-ink">
            {UNIT_TYPES.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </label>
        <label className="text-small text-text-secondary">
          {labels['admin.units.bedrooms']}
          <input name="bedrooms" type="number" min="0" defaultValue={1} required className="block h-40 w-full mt-4 rounded-sm border border-border-line px-12 text-body text-text-ink" />
        </label>
        <label className="text-small text-text-secondary">
          {labels['admin.units.bathrooms']}
          <input name="bathrooms" type="number" min="0" defaultValue={1} required className="block h-40 w-full mt-4 rounded-sm border border-border-line px-12 text-body text-text-ink" />
        </label>
        <label className="text-small text-text-secondary">
          {labels['admin.units.max_guests']}
          <input name="maxGuests" type="number" min="1" defaultValue={2} required className="block h-40 w-full mt-4 rounded-sm border border-border-line px-12 text-body text-text-ink" />
        </label>
        <label className="text-small text-text-secondary md:col-span-2">
          {labels['admin.units.address_supplement']}
          <input name="addressSupplement" required className="block h-40 w-full mt-4 rounded-sm border border-border-line px-12 text-body text-text-ink" />
        </label>
        <label className="text-small text-text-secondary">
          {labels['admin.units.base_nightly']}
          <input
            name="baseNightlyThb"
            type="number"
            min="0"
            required={!selectedCategory}
            readOnly={Boolean(selectedCategory)}
            value={selectedCategory ? selectedCategory.baseNightlyBaht : undefined}
            onChange={selectedCategory ? () => undefined : undefined}
            className="block h-40 w-full mt-4 rounded-sm border border-border-line px-12 text-body text-text-ink read-only:bg-surface-ivory read-only:text-text-secondary"
          />
        </label>
        <label className="text-small text-text-secondary">
          {labels['admin.units.min_nights']}
          <input
            name="minNights"
            type="number"
            min="1"
            readOnly={Boolean(selectedCategory)}
            {...(selectedCategory
              ? { value: selectedCategory.minNights, onChange: () => undefined }
              : { defaultValue: 1 })}
            className="block h-40 w-full mt-4 rounded-sm border border-border-line px-12 text-body text-text-ink read-only:bg-surface-ivory read-only:text-text-secondary"
          />
        </label>
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
