'use client';

import type { BookingRequestBreakdownLine } from '@/modules/booking';

interface BookingRequestInboxDetailsProps {
  nights: number;
  completedStayCount: number;
  breakdownLines: BookingRequestBreakdownLine[];
  labels: Record<string, string>;
}

function formatAmount(amountThb: number): string {
  const prefix = amountThb < 0 ? '-' : '';
  return `${prefix}฿${Math.abs(amountThb).toLocaleString()}`;
}

export default function BookingRequestInboxDetails({
  nights,
  completedStayCount,
  breakdownLines,
  labels,
}: BookingRequestInboxDetailsProps) {
  const historyLabel =
    completedStayCount === 0
      ? labels['booking.request_history.first_stay']
      : completedStayCount === 1
        ? labels['booking.request_history.returning_one']
        : labels['booking.request_history.returning_many'].replace(
            '{count}',
            String(completedStayCount)
          );

  const historyTone =
    completedStayCount === 0
      ? 'bg-surface-ivory text-text-secondary border-border-line'
      : 'bg-brand-andaman-soft text-brand-andaman border-brand-andaman';

  return (
    <div className="mt-8 space-y-8">
      <div className="flex flex-wrap items-center gap-8">
        <span
          className={`inline-flex items-center rounded-full px-10 py-4 text-small font-semibold border ${historyTone}`}
        >
          {historyLabel}
        </span>
        <span className="text-small text-text-secondary">
          {labels['booking.request_breakdown.nights'].replace('{nights}', String(nights))}
        </span>
      </div>
      <ul className="text-small text-text-secondary space-y-4">
        {breakdownLines.map((line) => (
          <li key={line.labelKey} className="flex items-center justify-between gap-16">
            <span>{labels[line.labelKey] || line.labelKey}</span>
            <span className="font-medium text-text-ink tabular-nums">
              {formatAmount(line.amountThb)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
