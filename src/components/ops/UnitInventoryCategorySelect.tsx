'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface CategoryOption {
  id: string;
  name: string;
  categoryKey: string;
}

interface Props {
  unitId: string;
  currentCategoryId: string | null;
  categories: CategoryOption[];
  canEdit: boolean;
  labels: Record<string, string>;
}

export default function UnitInventoryCategorySelect({
  unitId,
  currentCategoryId,
  categories,
  canEdit,
  labels,
}: Props) {
  const router = useRouter();
  const [value, setValue] = useState(currentCategoryId || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canEdit) {
    const current = categories.find((category) => category.id === currentCategoryId);
    return current ? (
      <div>
        <p className="text-text-ink">{current.name}</p>
        <p className="text-micro text-text-secondary">{current.categoryKey}</p>
      </div>
    ) : (
      <span className="text-state-warning">{labels['staff.inventory.uncategorized']}</span>
    );
  }

  return (
    <div>
      <select
        value={value}
        disabled={busy || categories.length === 0}
        className="h-36 min-w-[180px] rounded-sm border border-border-line bg-surface-paper px-8 text-small text-text-ink"
        onChange={async (event) => {
          const next = event.target.value;
          if (!next || next === value) return;
          const previous = value;
          setValue(next);
          setBusy(true);
          setError(null);
          try {
            const response = await fetch(`/api/admin/units/${unitId}/inventory-category`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ categoryId: next }),
            });
            if (!response.ok) {
              const payload = await response.json().catch(() => null);
              throw new Error(payload?.error || labels['staff.inventory.error']);
            }
            router.refresh();
          } catch (err) {
            setValue(previous);
            setError(err instanceof Error ? err.message : labels['staff.inventory.error']);
          } finally {
            setBusy(false);
          }
        }}
      >
        <option value="" disabled>{labels['staff.inventory.choose_category']}</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </select>
      {error ? <p className="text-micro text-state-error mt-3 max-w-[220px]">{error}</p> : null}
    </div>
  );
}
