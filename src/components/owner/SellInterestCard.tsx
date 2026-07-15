'use client';

import React from 'react';
import { Button } from '@/components';

interface SellInterestCardProps {
  onExpressInterest?: () => void;
}

export const SellInterestCard = React.forwardRef<HTMLDivElement, SellInterestCardProps>(
  ({ onExpressInterest }, ref) => {
    return (
      <div
        ref={ref}
        className="border border-border-line rounded-md p-32 bg-gradient-to-br from-brand-sun-soft to-surface-paper hover:shadow-md transition-shadow"
      >
        <div className="max-w-sm">
          <h3 className="text-heading-3 font-semibold text-text-ink mb-12">Thinking of selling?</h3>
          <p className="text-body text-text-secondary mb-24">
            We connect you with qualified buyers. Share your interest and let's explore options together.
          </p>
          <Button
            variant="sun"
            size="md"
            onClick={onExpressInterest}
          >
            Express Interest
          </Button>
        </div>
      </div>
    );
  }
);

SellInterestCard.displayName = 'SellInterestCard';
