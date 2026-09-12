'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/Button';

type Labels = Record<string, string>;

/**
 * The orderer's end of the confirm/dispute window (doc 07 F-PROV-3).
 *
 * Confirming closes the order early, waiving the rest of the window — so the
 * copy says what is being given up, and the action asks before it does it.
 */
export default function OrderConfirmPanel({
  orderId,
  hoursRemaining,
  labels,
}: {
  orderId: string;
  hoursRemaining: number | null;
  labels: Labels;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (!window.confirm(labels['service-order.detail.confirm_work_confirm'])) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/service-orders/${orderId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || labels['service-order.detail.confirm_work_error']);
      }
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : labels['service-order.detail.confirm_work_error']
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-surface-paper border border-border-line rounded-lg p-24 mb-24">
      <h2 className="text-heading-3 font-bold text-text-ink mb-8">
        {labels['service-order.detail.confirm_work_title']}
      </h2>
      <p className="text-body text-text-secondary mb-12">
        {labels['service-order.detail.confirm_work_hint']}
      </p>
      {hoursRemaining !== null ? (
        <p className="text-small text-text-secondary mb-12">
          {labels['service-order.detail.confirm_work_remaining'].replace(
            '{hours}',
            String(hoursRemaining)
          )}
        </p>
      ) : null}
      {error ? (
        <p className="text-body text-state-error mb-12" role="alert">
          {error}
        </p>
      ) : null}
      <Button variant="primary" size="sm" onClick={handleConfirm} isLoading={busy}>
        {labels['service-order.detail.confirm_work_submit']}
      </Button>
    </div>
  );
}
