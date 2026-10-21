import Link from 'next/link';

export interface ReservationSummaryCardProps {
  bookingId: string;
  href: string;
  unitName: string;
  projectName: string;
  guestName: string;
  statusLabel: string;
  channelLabel: string;
  dateFrom: string;
  dateTo: string;
  totalLabel: string;
  paidLabel: string;
  reviewLabel?: string;
  openLabel: string;
}

/** Shared presentation only. All money, permissions and status are resolved by the caller. */
export default function ReservationSummaryCard(props: ReservationSummaryCardProps) {
  return (
    <article data-booking-id={props.bookingId} className="grid gap-12 border-b border-border-line p-16 last:border-0 md:grid-cols-6">
      <div className="min-w-0 md:col-span-2">
        <p className="font-semibold text-text-ink">{props.projectName} · {props.unitName}</p>
        <p className="text-small text-text-secondary">{props.guestName}</p>
      </div>
      <div>
        <p className="text-small font-semibold text-text-ink">{props.statusLabel}</p>
        <p className="text-small text-text-secondary">{props.channelLabel}</p>
      </div>
      <div>
        <p>{props.dateFrom}</p>
        <p className="text-small text-text-secondary">→ {props.dateTo}</p>
      </div>
      <div>
        <p className="font-semibold tabular-nums">{props.totalLabel}</p>
        <p className="text-small text-text-secondary tabular-nums">{props.paidLabel}</p>
        {props.reviewLabel && <p className="text-small text-state-warning">{props.reviewLabel}</p>}
      </div>
      <div>
        <Link href={props.href} className="inline-flex min-h-40 items-center text-small font-semibold text-brand-andaman underline-offset-4 hover:underline">{props.openLabel} →</Link>
      </div>
    </article>
  );
}
