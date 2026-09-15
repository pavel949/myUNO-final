'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/Button';

interface InventoryCategoryPricingEditorProps {
  categoryId: string;
  baseNightlyBaht: number;
  minNights: number;
  canEdit: boolean;
  labels: {
    baseRate: string;
    minNights: string;
    save: string;
    saving: string;
    saved: string;
    error: string;
    adminOnly: string;
  };
}

export default function InventoryCategoryPricingEditor({
  categoryId,
  baseNightlyBaht,
  minNights,
  canEdit,
  labels,
}: InventoryCategoryPricingEditorProps) {
  const router = useRouter();
  const [baseRate, setBaseRate] = useState(String(baseNightlyBaht));
  const [minimumStay, setMinimumStay] = useState(String(minNights));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!canEdit) {
    return (
      <div className="flex flex-wrap items-center gap-x-16 gap-y-4 text-small">
        <span className="text-text-ink">
          <span className="text-text-secondary">{labels.baseRate}:</span>{' '}
          ฿{baseNightlyBaht.toLocaleString()}
        </span>
        <span className="text-text-ink">
          <span className="text-text-secondary">{labels.minNights}:</span>{' '}
          {minNights}
        </span>
        <span className="text-micro text-text-muted">{labels.adminOnly}</span>
      </div>
    );
  }

  return (
    <form
      className="flex flex-wrap items-end gap-8"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setMessage(null);
        setError(null);
        try {
          const baseNightlyThb = Math.round(Number(baseRate) * 100);
          const minNightsValue = Number(minimumStay);
          if (!Number.isFinite(baseNightlyThb) || baseNightlyThb < 0) {
            throw new Error(labels.error);
          }
          if (!Number.isInteger(minNightsValue) || minNightsValue < 1) {
            throw new Error(labels.error);
          }

          const response = await fetch(`/api/admin/inventory-categories/${categoryId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              baseNightlyThb,
              minNights: minNightsValue,
            }),
          });

          if (!response.ok) {
            const payload = await response.json().catch(() => null);
            throw new Error(payload?.error || labels.error);
          }

          setMessage(labels.saved);
          router.refresh();
        } catch (err) {
          setError(err instanceof Error ? err.message : labels.error);
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="text-micro text-text-secondary">
        {labels.baseRate}
        <input
          type="number"
          min="0"
          step="1"
          value={baseRate}
          onChange={(event) => setBaseRate(event.target.value)}
          className="block h-36 w-36 mt-4 rounded-sm border border-border-line bg-surface-paper px-8 text-small text-text-ink"
        />
      </label>
      <label className="text-micro text-text-secondary">
        {labels.minNights}
        <input
          type="number"
          min="1"
          step="1"
          value={minimumStay}
          onChange={(event) => setMinimumStay(event.target.value)}
          className="block h-36 w-20 mt-4 rounded-sm border border-border-line bg-surface-paper px-8 text-small text-text-ink"
        />
      </label>
      <Button type="submit" size="sm" disabled={busy}>
        {busy ? labels.saving : labels.save}
      </Button>
      {message ? <span className="text-micro text-state-success">{message}</span> : null}
      {error ? <span className="text-micro text-state-error">{error}</span> : null}
    </form>
  );
}
