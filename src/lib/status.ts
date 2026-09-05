/**
 * Status → color mapping — doc 06 §3.4, the single source. Every status
 * chip and status-colored element in the product resolves its color through
 * this function; nobody picks a status color ad hoc (CURSOR_PROMPT ground
 * rule 4: every enum reaches the screen through one mapping).
 */
export type StatusVariant = 'success' | 'warning' | 'error' | 'neutral' | 'info';

const STATUS_VARIANT: Record<string, StatusVariant> = {
  // success
  confirmed: 'success',
  paid: 'success',
  filed: 'success',
  resolved: 'success',
  active: 'success',
  won: 'success',
  // warning
  pending_payment: 'warning',
  requested: 'warning',
  vetting: 'warning',
  in_progress: 'warning',
  needs_review: 'warning',
  // error
  cancelled: 'error',
  declined: 'error',
  failed: 'error',
  expired: 'error',
  breached: 'error',
  lost: 'error',
  // neutral (stone)
  draft: 'neutral',
  completed: 'neutral',
  closed: 'neutral',
  not_required: 'neutral',
  // info
  checked_in: 'info',
  accepted: 'info',
  published: 'info',
};

/**
 * Resolves a raw status/enum value to its doc 06 §3.4 color variant.
 * Unmapped statuses fall back to `neutral` rather than throwing — the
 * mapping table is expected to grow as new enums are added, and a screen
 * should never crash over a status nobody has classified yet.
 */
export function getStatusVariant(status: string): StatusVariant {
  return STATUS_VARIANT[status] ?? 'neutral';
}

export const STATUS_VARIANT_CLASSES: Record<StatusVariant, string> = {
  success: 'bg-state-success-soft text-state-success',
  warning: 'bg-state-warning-soft text-state-warning',
  error: 'bg-state-error-soft text-state-error',
  neutral: 'bg-surface-paper text-text-stone border border-border-line',
  info: 'bg-state-info-soft text-state-info',
};
