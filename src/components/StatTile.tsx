'use client';

import React from 'react';

interface StatTileProps {
  label: string;
  value: React.ReactNode;
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
      neutral: '',
    };

    return (
      <div
        ref={ref}
        className={`stitch-panel min-w-0 p-24 ${variantClasses[variant]}`}
      >
        <p className="text-small text-text-stone mb-8">{label}</p>
        <div className="flex flex-wrap items-baseline gap-8">
          <p className="min-w-0 break-words font-numeric text-display font-semibold text-brand-andaman tabular-nums">{value}</p>
          {secondary && <p className="text-body text-text-stone">{secondary}</p>}
        </div>
        {delta ? <div className="mt-8">{delta}</div> : null}
      </div>
    );
  }
);

StatTile.displayName = 'StatTile';
