'use client';

import React from 'react';

interface StatTileProps {
  label: string;
  value: string | number;
  secondary?: string;
  variant?: 'occupancy' | 'revenue' | 'neutral';
  /** Optional delta chip / adornment rendered under the value (doc 06 §3.2). */
  delta?: React.ReactNode;
}

/**
 * StatTile — the shared KPI tile (doc 06 §3.2): kicker label + display
 * number + optional delta chip. The single implementation used by the
 * owner, MC, and admin dashboards.
 */
export const StatTile = React.forwardRef<HTMLDivElement, StatTileProps>(
  ({ label, value, secondary, variant = 'neutral', delta }, ref) => {
    const variantClasses = {
      occupancy: 'border-l-4 border-l-brand-andaman',
      revenue: 'border-l-4 border-l-brand-sun',
      neutral: 'border border-border-line',
    };

    return (
      <div
        ref={ref}
        className={`rounded-md p-24 bg-surface-paper transition-colors ${variantClasses[variant]}`}
      >
        <p className="text-small text-text-secondary mb-8">{label}</p>
        <div className="flex items-baseline gap-16">
          <p className="text-heading-2 font-semibold text-text-ink">{value}</p>
          {secondary && <p className="text-body text-text-secondary">{secondary}</p>}
        </div>
        {delta ? <div className="mt-8">{delta}</div> : null}
      </div>
    );
  }
);

StatTile.displayName = 'StatTile';
