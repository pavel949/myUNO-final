'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/Button';

export interface DeclineReasonOption {
  code: string;
  label: string;
}

interface BookingRequestRespondActionsProps {
  bookingId: string;
  labels: {
    approve: string;
    decline: string;
    decline_reason: string;
    decline_reason_required: string;
    confirm_decline: string;
    error_generic: string;
  };
  declineReasons: DeclineReasonOption[];
  onComplete?: () => void;
}

export default function BookingRequestRespondActions({
  bookingId,
  labels,
  declineReasons,
  onComplete,
}: BookingRequestRespondActionsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reasonCode, setReasonCode] = useState(declineReasons[0]?.code ?? '');

  const respond = async (action: 'approve' | 'decline') => {
    if (action === 'decline') {
      if (!reasonCode) {
        setError(labels.decline_reason_required);
        return;
      }
      if (!window.confirm(labels.confirm_decline)) {
        return;
      }
    }

    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/bookings/${bookingId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          action === 'decline' ? { action, reasonCode } : { action }
        ),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || labels.error_generic);
      }
      onComplete?.();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : labels.error_generic);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-stretch gap-8 shrink-0">
      {error ? <p className="text-small text-state-error">{error}</p> : null}
      <label className="flex flex-col gap-4">
        <span className="text-small text-text-secondary">{labels.decline_reason}</span>
        <select
          value={reasonCode}
          onChange={(event) => setReasonCode(event.target.value)}
          disabled={busy}
          className="h-40 px-12 rounded-sm bg-surface-paper border border-border-line text-small text-text-ink focus:border-brand-andaman focus:outline-none"
        >
          {declineReasons.map((reason) => (
            <option key={reason.code} value={reason.code}>
              {reason.label}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-center gap-8">
        <Button
          size="sm"
          variant="sun"
          onClick={() => void respond('approve')}
          isLoading={busy}
        >
          {labels.approve}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => void respond('decline')}
          isLoading={busy}
        >
          {labels.decline}
        </Button>
      </div>
    </div>
  );
}
