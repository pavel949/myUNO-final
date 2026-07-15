'use client';

import React from 'react';

interface Ticket {
  id: string;
  title: string;
  status: string;
  createdAt: string;
}

interface OpenTicketsListProps {
  count: number;
  tickets?: Ticket[];
  loading?: boolean;
}

const getStatusStyles = (status: string): { bg: string; text: string } => {
  switch (status) {
    case 'open':
    case 'opened':
      return { bg: 'bg-red-100', text: 'text-red-700' };
    case 'in_progress':
      return { bg: 'bg-yellow-100', text: 'text-yellow-700' };
    case 'resolved':
      return { bg: 'bg-green-100', text: 'text-green-700' };
    default:
      return { bg: 'bg-gray-100', text: 'text-gray-700' };
  }
};

export const OpenTicketsList = React.forwardRef<HTMLDivElement, OpenTicketsListProps>(
  ({ count, tickets = [], loading }, ref) => {
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
          <p className="text-body text-text-secondary">No open tickets</p>
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
                    {ticket.status.replace('_', ' ')}
                  </span>
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-small text-text-secondary">
            {count} ticket{count !== 1 ? 's' : ''} waiting for attention
          </p>
        )}
      </div>
    );
  }
);

OpenTicketsList.displayName = 'OpenTicketsList';
