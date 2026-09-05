'use client';

import React from 'react';
import { Button } from '@/components';

interface SellInterestCardProps {
  labels: {
    title: string;
    description: string;
    action: string;
  };
  onExpressInterest?: () => void;
}

export const SellInterestCard = React.forwardRef<HTMLDivElement, SellInterestCardProps>(
  ({ labels, onExpressInterest }, ref) => {
    return (
      <div
        ref={ref}
        className="bg-surface-paper border border-border-line rounded-md p-24 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-24"
      >
        <div>
          <h3 className="font-display text-title font-semibold text-text-ink m-0 mb-4">
            {labels.title}
          </h3>
          <p className="text-body text-text-stone m-0">{labels.description}</p>
        </div>
        <Button variant="secondary" size="md" onClick={onExpressInterest}>
          {labels.action}
        </Button>
      </div>
    );
  }
);

SellInterestCard.displayName = 'SellInterestCard';
