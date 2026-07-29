'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/Button';

/**
 * SA-2: the working "pay now" action on the order detail — opens the
 * checkout seam for an unpaid order (the old server-rendered button was
 * inert and crashed the page: event handlers can't live in RSC).
 */
export default function PayOrderButton({
  orderId,
  label,
  errorLabel,
}: {
  orderId: string;
  label: string;
  errorLabel: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pay = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/service-orders/${orderId}/checkout`, {
        method: 'POST',
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.checkoutUrl) {
        throw new Error(data?.error || errorLabel);
      }
      router.push(data.checkoutUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : errorLabel);
      setBusy(false);
    }
  };

  return (
    <div className="flex-1">
      <Button onClick={pay} isLoading={busy} fullWidth>
        {label}
      </Button>
      {error && <p className="text-small text-state-error mt-8">{error}</p>}
    </div>
  );
}
