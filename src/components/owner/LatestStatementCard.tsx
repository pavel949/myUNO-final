'use client';

import React from 'react';
import { Button } from '@/components';

interface LatestStatementCardProps {
  statementId: string | null;
  createdAt?: string;
  onViewStatement?: (statementId: string) => void;
}

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

export const LatestStatementCard = React.forwardRef<HTMLDivElement, LatestStatementCardProps>(
  ({ statementId, createdAt, onViewStatement }, ref) => {
    if (!statementId) {
      return (
        <div ref={ref} className="border border-border-line rounded-md p-24 bg-surface-paper-soft">
          <p className="text-body text-text-secondary">No statement available yet</p>
        </div>
      );
    }

    return (
      <div ref={ref} className="border border-border-line rounded-md p-24 bg-surface-paper hover:bg-surface-paper-soft transition-colors">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-body font-medium text-text-ink">Latest Statement</p>
            {createdAt && (
              <p className="text-small text-text-secondary mt-8">{formatDate(createdAt)}</p>
            )}
          </div>
          {onViewStatement && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onViewStatement(statementId)}
            >
              View
            </Button>
          )}
        </div>
      </div>
    );
  }
);

LatestStatementCard.displayName = 'LatestStatementCard';
