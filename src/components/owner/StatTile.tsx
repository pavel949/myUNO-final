'use client';

import React from 'react';

interface StatTileProps {
  label: string;
  value: string | number;
  secondary?: string;
  variant?: 'occupancy' | 'revenue';
}

export const StatTile = React.forwardRef<HTMLDivElement, StatTileProps>(
  ({ label, value, secondary, variant = 'occupancy' }, ref) => {
    const variantClasses = {
      occupancy: 'border-l-4 border-l-brand-andaman bg-surface-paper hover:bg-surface-paper-soft',
      revenue: 'border-l-4 border-l-brand-sun bg-surface-paper hover:bg-surface-paper-soft',
    };

    return (
      <div
        ref={ref}
        className={`rounded-md p-24 transition-colors ${variantClasses[variant]}`}
      >
        <p className="text-small text-text-secondary mb-8">{label}</p>
        <div className="flex items-baseline gap-16">
          <p className="text-heading-2 font-semibold text-text-ink">{value}</p>
          {secondary && <p className="text-body text-text-secondary">{secondary}</p>}
        </div>
      </div>
    );
  }
);

StatTile.displayName = 'StatTile';
