'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/Button';

const UNIT_TYPES = ['villa', 'condo', 'townhouse'];

type Labels = Record<string, string>;
type CategoryOption = {
  id: string;
  projectId: string;
  projectName: string;
  categoryKey: string;
  name: string;
};

export default function CreateUnitForm({
  categories,
  labels,
}: {
  categories: CategoryOption[];
  labels: Labels;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (categories.length === 0) {
    return (
      <p className="text-body text-text-secondary mb-16">
        {labels['admin.units.no_categories']}
      </p>
    );
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
        const inventoryCategoryId = String(form.get('inventoryCategoryId') || '');
        const category = categories.find((item) => item.id === inventoryCategoryId);

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
              projectId: category.projectId,
              categoryKey: category.categoryKey,
              name: String(form.get('name') || '').trim(),
              unitType: form.get('unitType'),
              bedrooms: Number(form.get('bedrooms')),
              bathrooms: Number(form.get('bathrooms')),
              maxGuests: Number(form.get('maxGuests')),
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
        <label className="text-small text-text-secondary md:col-span-2">
          {labels['admin.units.category']}
          <select
            name="inventoryCategoryId"
            required
            className="block h-40 w-full mt-4 rounded-sm border border-border-line px-12 text-body text-text-ink"
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.projectName} — {category.name}
              </option>
            ))}
          </select>
          <span className="mt-4 block text-small text-text-stone">
            {labels['admin.units.category_hint']}
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
