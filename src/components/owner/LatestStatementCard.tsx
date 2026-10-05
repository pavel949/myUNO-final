'use client';

import React from 'react';
import { Button } from '@/components';
import { formatDate as formatDateIn } from '@/lib/date';
import { useLocale } from '@/components/LocaleProvider';

interface LatestStatementCardProps {
  statementId: string | null;
  createdAt?: string;
  onViewStatement?: (statementId: string) => void;
}

export const LatestStatementCard = React.forwardRef<HTMLDivElement, LatestStatementCardProps>(
  ({ statementId, createdAt, onViewStatement }, ref) => {
    const locale = useLocale();
    const formatDate = (dateStr: string): string => formatDateIn(dateStr, locale, 'monthYear');
    if (!statementId) {
      return (
        <div ref={ref} className="stitch-panel p-24 -soft">
          <p className="text-body text-text-secondary">No statement available yet</p>
        </div>
      );
    }

    return (
      <div ref={ref} className="stitch-panel p-24 hover:bg-surface-paper-soft transition-colors">
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
