import type { ReactNode } from 'react';

/**
 * PMS status pill (Stitch myuno_pms): clean / in-house / dirty / out-of-order.
 * Presentation only; the caller passes the already-localised label.
 */
export type OpsPillTone = 'clean' | 'inhouse' | 'attention' | 'blocked' | 'neutral';

const toneClass: Record<OpsPillTone, string> = {
  clean: 'border-brand-andaman/20 bg-surface-mint text-brand-andaman',
  inhouse: 'border-brand-deep bg-brand-deep text-white',
  attention: 'border-brand-sun/40 bg-brand-sun/15 text-brand-deep',
  blocked: 'border-state-warning/40 bg-state-warning-soft text-text-ink',
  neutral: 'border-border-line bg-surface-sand text-text-secondary',
};

/** Housekeeping / task state key to pill tone. Unknown states stay neutral. */
export function opsStateTone(state: string): OpsPillTone {
  switch (state) {
    case 'ready':
    case 'clean':
    case 'inspected':
      return 'clean';
    case 'occupied':
    case 'in_house':
    case 'in_progress':
    case 'cleaning':
      return 'inhouse';
    case 'dirty':
    case 'awaiting_inspection':
    case 'planned':
    case 'assigned':
      return 'attention';
    case 'maintenance':
    case 'blocked':
      return 'blocked';
    default:
      return 'neutral';
  }
}

export default function OpsStatusPill({
  tone = 'neutral',
  children,
}: {
  tone?: OpsPillTone;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-8 py-4 text-kicker font-semibold uppercase tracking-wider ${toneClass[tone]}`}
    >
      {children}
    </span>
  );
}
