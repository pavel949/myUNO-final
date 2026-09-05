'use client';

import { useEffect, useState } from 'react';
import { Sheet } from '@/components/Sheet';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';

interface TypedPaymentSheetProps {
  open: boolean;
  onClose: () => void;
  closeLabel: string;
  title: string;
  subtitle: string;
  amountThb: number;
  amountDueLabel: string;
  refLabel: string;
  refValue: string;
  onRefChange: (value: string) => void;
  refHelpText: string;
  /** When set, a checkbox with this text must be ticked before submit enables (board 20's cash-receipt sheet). Omitted for the simpler transfer-reference sheet. */
  confirmationLabel?: string;
  submitLabel: string;
  requiredHint: string;
  busy: boolean;
  onSubmit: () => void;
}

/**
 * TypedPaymentSheet — board 20 rule 3: typed input (a cash receipt or bank
 * reference) opens as a sheet rather than a field wedged into a table row.
 */
export function TypedPaymentSheet({
  open,
  onClose,
  closeLabel,
  title,
  subtitle,
  amountThb,
  amountDueLabel,
  refLabel,
  refValue,
  onRefChange,
  refHelpText,
  confirmationLabel,
  submitLabel,
  requiredHint,
  busy,
  onSubmit,
}: TypedPaymentSheetProps) {
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (!open) setConfirmed(false);
  }, [open]);

  const ready = refValue.trim().length > 0 && (!confirmationLabel || confirmed);

  return (
    <Sheet open={open} onClose={onClose} closeLabel={closeLabel} title={title}>
      <p className="text-small text-text-secondary mb-16">{subtitle}</p>
      <div className="bg-surface-ivory rounded-md p-16 mb-16">
        <p className="text-small text-text-secondary mb-4">{amountDueLabel}</p>
        <p className="font-display text-heading-2 font-semibold tabular-nums text-text-ink">
          ฿{amountThb.toLocaleString()}
        </p>
      </div>
      <div className="mb-16">
        <Input
          label={refLabel}
          required
          helpText={refHelpText}
          value={refValue}
          onChange={(event) => onRefChange(event.target.value)}
        />
      </div>
      {confirmationLabel && (
        <label className="flex items-start gap-12 mb-20">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            className="mt-2 h-20 w-20 shrink-0"
          />
          <span className="text-body text-text-ink">{confirmationLabel}</span>
        </label>
      )}
      <Button fullWidth variant="sun" disabled={!ready} isLoading={busy} onClick={onSubmit}>
        {submitLabel}
      </Button>
      <p className="text-small text-text-secondary text-center mt-8">{requiredHint}</p>
    </Sheet>
  );
}
