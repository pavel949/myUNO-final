import React from 'react';
import { getStatusVariant, STATUS_VARIANT_CLASSES, type StatusVariant } from '@/lib/status';

interface StatusChipProps {
  /** Raw status enum value (e.g. `confirmed`, `pending_payment`). Resolved to a color via doc 06 §3.4 — never choose the color yourself. */
  status: string;
  /** Already-translated label to render. StatusChip never renders a raw enum value (CURSOR_PROMPT ground rule 4). */
  label: string;
  /** Escape hatch for a status not yet in the §3.4 table — still requires an explicit variant, never guessed. */
  variantOverride?: StatusVariant;
  className?: string;
}

export const StatusChip: React.FC<StatusChipProps> = ({ status, label, variantOverride, className }) => {
  const variant = variantOverride ?? getStatusVariant(status);
  return (
    <span
      className={`inline-flex items-center px-16 py-8 rounded-full text-small font-medium whitespace-normal ${STATUS_VARIANT_CLASSES[variant]} ${className || ''}`}
    >
      {label}
    </span>
  );
};
