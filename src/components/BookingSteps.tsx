import React from 'react';

export interface BookingStepsLabels {
  aria: string;
  review: string;
  pay: string;
  confirmed: string;
  current: string;
}

/**
 * Familiar checkout progress: numbered steps, the current one marked.
 * Request-only stays include property approval before payment.
 * Pure presentation — booking authority stays with the caller.
 */
export function BookingSteps({ current, labels, approvalLabel }: {
  current: 1 | 2 | 3 | 4;
  labels: BookingStepsLabels;
  approvalLabel?: string;
}) {
  const steps = [labels.review, ...(approvalLabel ? [approvalLabel] : []), labels.pay, labels.confirmed];
  return (
    <nav aria-label={labels.aria} className="mx-auto w-full max-w-3xl px-16 pt-16 md:px-24">
      <ol className="flex items-center gap-8 text-small">
        {steps.map((label, index) => {
          const number = index + 1;
          const done = number < current;
          const active = number === current;
          return (
            <li key={label} aria-current={active ? 'step' : undefined} className="flex min-w-0 flex-1 items-center gap-4 sm:gap-8">
              <span
                aria-hidden="true"
                className={`flex h-24 w-24 shrink-0 items-center justify-center rounded-full border text-small font-semibold ${
                  active
                    ? 'border-brand-andaman bg-brand-andaman text-surface-paper'
                    : done
                      ? 'border-brand-andaman text-brand-andaman'
                      : 'border-border-line text-text-secondary'
                }`}
              >
                {done ? '✓' : number}
              </span>
              <span className={`min-w-0 break-words ${active ? 'font-semibold text-text-ink' : 'text-text-secondary'}`}>
                {label}
                {active ? <span className="sr-only"> — {labels.current}</span> : null}
              </span>
              {number < steps.length ? <span aria-hidden="true" className="h-px flex-1 bg-border-line" /> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
