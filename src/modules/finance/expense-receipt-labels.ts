import type { ReportImpact } from './manual-cost.service';

/**
 * What the cost form says, chosen from what the SERVER said.
 *
 * The form never invents an outcome. A success line is built from the
 * `reportImpact` the server computed from live statement state, so the screen
 * cannot promise "it will be on the next report" for a period whose report has
 * already been issued. Every string is a content key (doc 05); this file maps
 * server codes to keys and fills `{start}`/`{end}` — it contains no copy.
 *
 * Imported by a client component. It is pure and its only import is a type
 * (erased at build), so it deliberately bypasses the finance barrel, which
 * carries server-only code (CLAUDE.md, module rule 2 exception).
 */

type Labels = Record<string, string | undefined>;

export const REPORT_IMPACT_LABEL_KEY: Record<ReportImpact['state'], string> = {
  no_statement_yet: 'ops.costs.impact.no_statement',
  draft_regeneration_required: 'ops.costs.impact.draft_stale',
  period_already_issued: 'ops.costs.impact.issued',
};

const fill = (template: string, values: Record<string, string>): string =>
  Object.entries(values).reduce((text, [name, value]) => text.split(`{${name}}`).join(value), template);

/** The sentence shown after a cost is saved (or recognised as already saved). */
export function reportImpactMessage(labels: Labels, impact: ReportImpact, replayed: boolean): string {
  const base = labels[REPORT_IMPACT_LABEL_KEY[impact.state]] ?? '';
  const filled = impact.period ? fill(base, { start: impact.period.start, end: impact.period.end }) : base;
  return replayed && labels['ops.costs.replayed'] ? `${labels['ops.costs.replayed']} ${filled}`.trim() : filled;
}

/** Server `code` of a failed cost request → content key. */
export const COST_ERROR_LABEL_KEY: Record<string, string> = {
  forbidden: 'ops.costs.error.forbidden',
  unit_not_found: 'ops.costs.error.forbidden',
  idempotency_conflict: 'ops.costs.error.conflict',
  date_in_future: 'ops.costs.error.future_date',
  invalid_date: 'ops.costs.error.future_date',
  invalid_amount: 'ops.costs.error.invalid_amount',
  invalid_description: 'ops.costs.error.invalid_description',
};

/** Server `code` of a failed receipt request → content key. */
export const RECEIPT_ERROR_LABEL_KEY: Record<string, string> = {
  unsupported_type: 'ops.costs.receipt_error.unsupported_type',
  content_mismatch: 'ops.costs.receipt_error.unsupported_type',
  too_large: 'ops.costs.receipt_error.too_large',
  empty: 'ops.costs.receipt_error.empty',
  receipt_reused: 'ops.costs.receipt_error.reused',
  statement_locked: 'ops.costs.receipt_error.locked',
  not_attachable: 'ops.costs.receipt_error.locked',
  not_found: 'ops.costs.receipt_error.forbidden',
  idempotency_conflict: 'ops.costs.receipt_error.generic',
  concurrent_change: 'ops.costs.receipt_error.generic',
};

export function costErrorMessage(labels: Labels, code: string | undefined): string {
  return labels[COST_ERROR_LABEL_KEY[code ?? ''] ?? 'ops.costs.error'] ?? labels['ops.costs.error'] ?? '';
}

export function receiptErrorMessage(labels: Labels, code: string | undefined): string {
  return (
    labels[RECEIPT_ERROR_LABEL_KEY[code ?? ''] ?? 'ops.costs.receipt_error.generic'] ??
    labels['ops.costs.receipt_error.generic'] ??
    ''
  );
}
