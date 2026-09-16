'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/Button';

interface ProjectOption {
  id: string;
  name: string;
}

interface Props {
  projects: ProjectOption[];
  defaultProjectId: string | null;
  labels: Record<string, string>;
}

export default function CreateInventoryCategoryForm({ projects, defaultProjectId, labels }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        {labels['staff.inventory.category_create']}
      </Button>
    );
  }

  return (
    <form
      className="rounded-lg border border-border-line bg-surface-ivory p-16 mt-12"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError(null);
        const form = new FormData(event.currentTarget as HTMLFormElement);
        try {
          const response = await fetch('/api/admin/inventory-categories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectId: form.get('projectId'),
              categoryKey: String(form.get('categoryKey') || '').trim(),
              name: String(form.get('name') || '').trim(),
              bedrooms: Number(form.get('bedrooms')),
              bathrooms: Number(form.get('bathrooms')),
              maxGuests: Number(form.get('maxGuests')),
              baseNightlyThb: Math.round(Number(form.get('baseNightlyBaht')) * 100),
              minNights: Number(form.get('minNights')),
            }),
          });
          if (!response.ok) {
            const payload = await response.json().catch(() => null);
            throw new Error(payload?.error || labels['staff.inventory.error']);
          }
          setOpen(false);
          router.refresh();
        } catch (err) {
          setError(err instanceof Error ? err.message : labels['staff.inventory.error']);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-12">
        <label className="text-micro text-text-secondary">
          {labels['staff.inventory.project']}
          <select
            name="projectId"
            defaultValue={defaultProjectId || projects[0]?.id || ''}
            required
            className="block h-40 w-full mt-4 rounded-sm border border-border-line bg-surface-paper px-10 text-small text-text-ink"
          >
            {projects.map((project) => (
              <option key={project.id} value={project.id}>{project.name}</option>
            ))}
          </select>
        </label>
        <label className="text-micro text-text-secondary">
          {labels['staff.inventory.category_name']}
          <input name="name" required className="block h-40 w-full mt-4 rounded-sm border border-border-line bg-surface-paper px-10 text-small text-text-ink" />
        </label>
        <label className="text-micro text-text-secondary">
          {labels['staff.inventory.category_key']}
          <input
            name="categoryKey"
            required
            pattern="[a-z0-9]+(?:_[a-z0-9]+)*"
            placeholder={labels['staff.inventory.category_key_placeholder']}
            className="block h-40 w-full mt-4 rounded-sm border border-border-line bg-surface-paper px-10 text-small text-text-ink"
          />
        </label>
        <label className="text-micro text-text-secondary">
          {labels['staff.inventory.base_rate']}
          <input name="baseNightlyBaht" type="number" min="0" step="1" required className="block h-40 w-full mt-4 rounded-sm border border-border-line bg-surface-paper px-10 text-small text-text-ink" />
        </label>
        <label className="text-micro text-text-secondary">
          {labels['staff.inventory.bedrooms']}
          <input name="bedrooms" type="number" min="0" defaultValue="2" required className="block h-40 w-full mt-4 rounded-sm border border-border-line bg-surface-paper px-10 text-small text-text-ink" />
        </label>
        <label className="text-micro text-text-secondary">
          {labels['staff.inventory.bathrooms']}
          <input name="bathrooms" type="number" min="0" defaultValue="2" required className="block h-40 w-full mt-4 rounded-sm border border-border-line bg-surface-paper px-10 text-small text-text-ink" />
        </label>
        <label className="text-micro text-text-secondary">
          {labels['staff.inventory.max_guests']}
          <input name="maxGuests" type="number" min="1" defaultValue="4" required className="block h-40 w-full mt-4 rounded-sm border border-border-line bg-surface-paper px-10 text-small text-text-ink" />
        </label>
        <label className="text-micro text-text-secondary">
          {labels['staff.inventory.min_nights']}
          <input name="minNights" type="number" min="1" defaultValue="1" required className="block h-40 w-full mt-4 rounded-sm border border-border-line bg-surface-paper px-10 text-small text-text-ink" />
        </label>
      </div>
      <p className="text-micro text-text-muted mt-8">{labels['staff.inventory.category_key_hint']}</p>
      {error ? <p className="text-small text-state-error mt-8">{error}</p> : null}
      <div className="flex gap-8 mt-12">
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? labels['staff.inventory.saving'] : labels['staff.inventory.category_create']}
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => setOpen(false)}>
          {labels['staff.inventory.cancel']}
        </Button>
      </div>
    </form>
  );
}
