'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/Button';

/**
 * Creating a sellable class (audit F-1).
 *
 * `InventoryCategory` is required before any unit in this project can go
 * live — by `updateUnit`, by the pricing engine, and by a Postgres trigger —
 * and until now no screen, service or route created one. The rows that exist
 * were backfilled once by a migration, which is why their keys read like
 * `villa_3br_2ba_6g_1500000`.
 *
 * Rates are entered in baht, like every other price field an operator sees;
 * the route converts to satang once at its own boundary.
 *
 * The same component edits an existing category. A base rate that can be set
 * once and never corrected is not a commercial system, and the key stays
 * immutable because units, the project catalog and the content key all point
 * at it.
 */

type Labels = Record<string, string>;

const FIELD =
  'block h-40 w-full mt-4 rounded-sm border border-border-line px-12 text-body text-text-ink';

export interface EditableCategory {
  id: string;
  categoryKey: string;
  name: string;
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  /** Baht, already converted by the page. */
  baseNightlyThb: number;
  minNights: number;
}

export default function CreateInventoryCategoryForm({
  projectId,
  policyKeys,
  category,
  onDone,
  labels,
}: {
  projectId: string;
  policyKeys: string[];
  /** When present the form amends this category instead of creating one. */
  category?: EditableCategory;
  onDone?: () => void;
  labels: Labels;
}) {
  const router = useRouter();
  const editing = Boolean(category);
  const [open, setOpen] = useState(editing);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setOpen(false);
    onDone?.();
  };

  if (!open) {
    return (
      <div className="mt-16">
        <Button onClick={() => setOpen(true)}>{labels['admin.project360.category_add']}</Button>
      </div>
    );
  }

  return (
    <form
      className="mt-16 bg-surface-ivory border border-border-line rounded-lg p-20"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget as HTMLFormElement);
        setBusy(true);
        setError(null);
        try {
          const payload = {
            name: String(form.get('name') || '').trim(),
            bedrooms: Number(form.get('bedrooms')),
            bathrooms: Number(form.get('bathrooms')),
            maxGuests: Number(form.get('maxGuests')),
            baseNightlyBaht: Number(form.get('baseNightlyBaht')),
            minNights: Number(form.get('minNights')) || 1,
            cancellationPolicyKey: form.get('cancellationPolicyKey') || null,
          };
          const response = await fetch(
            category
              ? `/api/admin/projects/${projectId}/inventory-categories/${category.id}`
              : `/api/admin/projects/${projectId}/inventory-categories`,
            {
              method: category ? 'PUT' : 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(
                category
                  ? payload
                  : { ...payload, categoryKey: String(form.get('categoryKey') || '').trim() }
              ),
            }
          );
          if (!response.ok) {
            const data = await response.json().catch(() => null);
            throw new Error(data?.error || labels['admin.project360.category_error']);
          }
          close();
          router.refresh();
        } catch (err) {
          setError(err instanceof Error ? err.message : labels['admin.project360.category_error']);
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

      <p className="text-small text-text-secondary mb-16">
        {editing
          ? labels['admin.project360.category_edit_hint']
          : labels['admin.project360.category_form_hint']}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-16">
        <label className="text-small text-text-secondary">
          {labels['admin.project360.category_name']}
          <input name="name" required defaultValue={category?.name} className={FIELD} />
        </label>
        <label className="text-small text-text-secondary">
          {labels['admin.project360.category_key']}
          <input
            name="categoryKey"
            required={!editing}
            readOnly={editing}
            defaultValue={category?.categoryKey}
            pattern="[a-z0-9_]+"
            className={`${FIELD} read-only:bg-surface-paper read-only:text-text-secondary`}
          />
          <span className="block text-micro text-text-secondary mt-4">
            {editing
              ? labels['admin.project360.category_key_locked']
              : labels['admin.project360.category_key_hint']}
          </span>
        </label>
        <label className="text-small text-text-secondary">
          {labels['admin.project360.category_base_rate']}
          <input
            name="baseNightlyBaht"
            type="number"
            min="1"
            required
            defaultValue={category?.baseNightlyThb}
            className={FIELD}
          />
        </label>
        <label className="text-small text-text-secondary">
          {labels['admin.project360.col_beds_baths']}
          <div className="flex gap-8">
            <input
              name="bedrooms"
              type="number"
              min="0"
              defaultValue={category?.bedrooms ?? 1}
              required
              aria-label={labels['admin.units.bedrooms']}
              className={FIELD}
            />
            <input
              name="bathrooms"
              type="number"
              min="0"
              defaultValue={category?.bathrooms ?? 1}
              required
              aria-label={labels['admin.units.bathrooms']}
              className={FIELD}
            />
          </div>
        </label>
        <label className="text-small text-text-secondary">
          {labels['admin.project360.col_guests']}
          <input
            name="maxGuests"
            type="number"
            min="1"
            defaultValue={category?.maxGuests ?? 2}
            required
            className={FIELD}
          />
        </label>
        <label className="text-small text-text-secondary">
          {labels['admin.project360.col_min_stay']}
          <input
            name="minNights"
            type="number"
            min="1"
            defaultValue={category?.minNights ?? 1}
            className={FIELD}
          />
        </label>
        <label className="text-small text-text-secondary">
          {labels['admin.project360.category_policy']}
          <select name="cancellationPolicyKey" className={FIELD} defaultValue="">
            <option value="">{labels['admin.project360.category_policy_none']}</option>
            {policyKeys.map((key) => (
              <option key={key} value={key}>
                {labels[`catalog.cancellation_policies.${key}.label`] || key}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex gap-12 mt-20">
        <Button type="submit" disabled={busy}>
          {busy
            ? labels['admin.project360.category_saving']
            : editing
              ? labels['admin.project360.category_save']
              : labels['admin.project360.category_add']}
        </Button>
        <Button type="button" variant="ghost" onClick={close} disabled={busy}>
          {labels['admin.project360.category_cancel']}
        </Button>
      </div>
    </form>
  );
}
