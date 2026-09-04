'use client';

import React from 'react';
import Link from 'next/link';

interface Ticket {
  id: string;
  title: string;
  status: string;
  createdAt: string;
}

interface OpenTicketsListProps {
  count: number;
  tickets?: Ticket[];
  labels: {
    empty: string;
    waitingCount: string;
    view: string;
    status: Record<string, string>;
  };
  loading?: boolean;
}

const getStatusStyles = (status: string): { bg: string; text: string } => {
  switch (status) {
    case 'open':
      return { bg: 'bg-state-warning-soft', text: 'text-state-warning' };
    case 'acknowledged':
      return { bg: 'bg-state-info-soft', text: 'text-state-info' };
    case 'in_progress':
      return { bg: 'bg-state-info-soft', text: 'text-state-info' };
    case 'waiting_reporter':
      return { bg: 'bg-state-warning-soft', text: 'text-state-warning' };
    case 'resolved':
      return { bg: 'bg-state-success-soft', text: 'text-state-success' };
    default:
      return { bg: 'bg-surface-ivory', text: 'text-text-stone' };
  }
};

function fill(template: string, params: Record<string, string | number>): string {
  let output = template;
  for (const [key, value] of Object.entries(params)) {
    output = output.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
  }
  return output;
}

export const OpenTicketsList = React.forwardRef<HTMLDivElement, OpenTicketsListProps>(
  ({ count, tickets = [], labels, loading }, ref) => {
    if (loading) {
      return (
        <div ref={ref} className="space-y-12">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-64 bg-surface-paper rounded-md animate-pulse" />
          ))}
        </div>
      );
    }

    if (count === 0) {
      return (
        <div ref={ref} className="text-center py-32">
          <p className="text-body text-text-secondary">{labels.empty}</p>
        </div>
      );
    }

    return (
      <div ref={ref} className="space-y-12">
        {tickets.length > 0 ? (
          tickets.map((ticket) => {
            const styles = getStatusStyles(ticket.status);
            return (
              <div
                key={ticket.id}
                className="border border-border-line rounded-md p-20 hover:bg-surface-paper-soft transition-colors"
              >
                <div className="flex justify-between items-start gap-16">
                  <div className="flex-1">
                    <p className="text-body font-medium text-text-ink">{ticket.title}</p>
                  </div>
                  <span className={`inline-flex items-center px-12 py-6 rounded-full text-small font-medium ${styles.bg} ${styles.text}`}>
                    {labels.status[ticket.status] || ticket.status}
                  </span>
                </div>
                <div className="mt-8">
                  <Link href={`/tickets/${ticket.id}`} className="text-small font-semibold text-brand-andaman hover:underline">
                    {labels.view} →
                  </Link>
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-small text-text-secondary">
            {fill(labels.waitingCount, { count })}
          </p>
        )}
      </div>
    );
  }
);

OpenTicketsList.displayName = 'OpenTicketsList';
