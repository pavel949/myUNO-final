'use client';

import React from 'react';
import Link from 'next/link';
import { Chip } from '@/components/Chip';

interface Ticket {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  unitName?: string;
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

const ticketChipStatus = (
  status: string
): 'requested' | 'checked_in' | 'confirmed' | 'closed' | 'default' => {
  switch (status) {
    case 'open':
    case 'waiting_reporter':
      return 'requested';
    case 'acknowledged':
    case 'in_progress':
      return 'checked_in';
    case 'resolved':
      return 'confirmed';
    case 'closed':
    case 'cancelled':
      return 'closed';
    default:
      return 'default';
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
          tickets.map((ticket) => (
              <div
                key={ticket.id}
                className="bg-surface-paper border border-border-line rounded-md p-16"
              >
                <div className="flex justify-between items-start gap-16">
                  <div className="flex-1">
                    <p className="text-body font-semibold text-text-ink m-0">{ticket.title}</p>
                    {ticket.unitName ? (
                      <p className="text-small text-text-stone mt-4 m-0">{ticket.unitName}</p>
                    ) : null}
                  </div>
                  <Chip variant="status" status={ticketChipStatus(ticket.status)}>
                    {labels.status[ticket.status] || ticket.status}
                  </Chip>
                </div>
                <div className="mt-8">
                  <Link href={`/tickets/${ticket.id}`} className="text-small font-semibold text-brand-andaman hover:underline">
                    {labels.view}
                  </Link>
                </div>
              </div>
          ))
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
