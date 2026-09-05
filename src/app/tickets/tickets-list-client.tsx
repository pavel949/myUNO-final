'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

const STATUSES = [
  'open',
  'acknowledged',
  'in_progress',
  'waiting_reporter',
  'resolved',
  'closed',
  'cancelled',
] as const;

const statusStyle: Record<string, string> = {
  open: 'bg-state-warning-soft text-state-warning',
  acknowledged: 'bg-state-info-soft text-state-info',
  in_progress: 'bg-state-info-soft text-state-info',
  waiting_reporter: 'bg-state-warning-soft text-state-warning',
  resolved: 'bg-state-success-soft text-state-success',
  closed: 'bg-surface-ivory text-text-stone',
  cancelled: 'bg-surface-ivory text-text-stone',
};

interface TicketRow {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  place: string | null;
}

export default function TicketsListClient({
  tickets,
  labels,
}: {
  tickets: TicketRow[];
  labels: Record<string, string>;
}) {
  const [filter, setFilter] = useState<string>('all');
  const visible = useMemo(
    () => (filter === 'all' ? tickets : tickets.filter((ticket) => ticket.status === filter)),
    [filter, tickets]
  );

  return (
    <main className="min-h-screen bg-surface-ivory p-24 md:p-32">
      <div className="mx-auto max-w-2xl">
        <div className="mb-24 flex flex-wrap items-end justify-between gap-16">
          <h1 className="font-display text-display-xl font-semibold text-brand-deep">
            {labels['tickets.list.title']}
          </h1>
          <Link href="/trips" className="font-semibold text-brand-andaman hover:underline">
            {labels['tickets.list.raise']}
          </Link>
        </div>

        <div className="mb-16 flex flex-wrap gap-8">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={
              filter === 'all'
                ? 'rounded-full bg-brand-andaman px-16 py-8 text-small text-on-dark-text'
                : 'rounded-full border border-border-line bg-surface-paper px-16 py-8 text-small text-text-ink'
            }
          >
            {labels['tickets.list.filter_all']}
          </button>
          {STATUSES.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setFilter(status)}
              className={
                filter === status
                  ? 'rounded-full bg-brand-andaman px-16 py-8 text-small text-on-dark-text'
                  : 'rounded-full border border-border-line bg-surface-paper px-16 py-8 text-small text-text-ink'
              }
            >
              {labels[`tickets.status.${status}`] || status}
            </button>
          ))}
        </div>

        {visible.length === 0 ? (
          <div className="rounded-lg border border-border-line bg-surface-paper p-32 text-center">
            <p className="text-body text-text-secondary">{labels['tickets.list.empty']}</p>
          </div>
        ) : (
          <div className="rounded-lg border border-border-line bg-surface-paper">
            {visible.map((ticket) => (
              <div
                key={ticket.id}
                className="flex items-center justify-between gap-12 border-b border-border-line p-16 last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-body font-semibold text-text-ink">
                    <Link href={`/tickets/${ticket.id}`} className="hover:underline">
                      {ticket.title}
                    </Link>
                  </p>
                  <p className="text-small text-text-secondary">
                    {ticket.place}
                    {ticket.place ? ' · ' : ''}
                    {new Date(ticket.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-10">
                  <span
                    className={`shrink-0 rounded-full px-12 py-4 text-small font-semibold ${
                      statusStyle[ticket.status] || 'bg-surface-ivory text-text-ink'
                    }`}
                  >
                    {labels[`tickets.status.${ticket.status}`] || ticket.status}
                  </span>
                  <Link
                    href={`/tickets/${ticket.id}`}
                    className="text-small font-semibold text-brand-andaman hover:underline"
                  >
                    {labels['tickets.list.view']}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
