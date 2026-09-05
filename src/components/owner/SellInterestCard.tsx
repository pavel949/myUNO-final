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
        className="border border-border-line rounded-md p-32 bg-gradient-to-br from-brand-sun-soft to-surface-paper hover:shadow-md transition-shadow"
      >
        <div className="max-w-sm">
          <h3 className="text-heading-3 font-semibold text-text-ink mb-12">{labels.title}</h3>
          <p className="text-body text-text-secondary mb-24">{labels.description}</p>
          <Button variant="sun" size="md" onClick={onExpressInterest}>
            {labels.action}
          </Button>
        </div>
      </div>
    );
  }
);

SellInterestCard.displayName = 'SellInterestCard';
