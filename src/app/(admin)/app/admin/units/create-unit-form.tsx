'use client';

import { useState } from 'react';
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
 */

const UNIT_TYPES = ['villa', 'condo', 'townhouse'];

type Labels = Record<string, string>;

export default function CreateUnitForm({
  projects,
  labels,
}: {
  projects: Array<{ id: string; name: string }>;
  labels: Labels;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (projects.length === 0) {
    // Without a project there is nothing to create a unit inside, and an empty
    // picker is a dead end rather than an explanation.
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
              projectId: form.get('projectId'),
              name: String(form.get('name') || '').trim(),
              unitType: form.get('unitType'),
              bedrooms: Number(form.get('bedrooms')),
              bathrooms: Number(form.get('bathrooms')),
              maxGuests: Number(form.get('maxGuests')),
              addressSupplement: String(form.get('addressSupplement') || '').trim(),
              baseNightlyThb: Number(form.get('baseNightlyThb')),
              minNights: Number(form.get('minNights')) || 1,
            }),
          });
          if (!response.ok) {
            const data = await response.json().catch(() => null);
            throw new Error(data?.error || labels['admin.units.error_generic']);
          }
          const unit = await response.json();
          // Straight into the onboarding workspace: a created unit is the
          // beginning of mobilization, not the end of a form.
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
