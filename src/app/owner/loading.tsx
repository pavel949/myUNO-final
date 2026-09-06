import React from 'react';

/**
 * The owner dashboard's loading state (doc 06 §3.2: skeleton compositions
 * per surface). Mirrors the page's own shape — greeting, stat tiles, trend
 * chart, unit list — rather than a generic spinner, per board 19's state
 * coverage matrix.
 */
export default function OwnerDashboardLoading() {
  return (
    <div className="min-h-screen bg-surface-background" aria-busy="true">
      <div className="max-w-6xl mx-auto px-24 py-40">
        <div className="mb-40 animate-pulse">
          <div className="h-32 w-96 bg-border-line rounded-sm mb-12" />
          <div className="h-16 w-64 bg-border-line rounded-sm" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-20 mb-40">
          {[0, 1].map((tile) => (
            <div
              key={tile}
              className="rounded-md p-24 bg-surface-paper border border-border-line animate-pulse"
            >
              <div className="h-12 w-96 bg-border-line rounded-sm mb-16" />
              <div className="h-24 w-64 bg-border-line rounded-sm" />
            </div>
          ))}
        </div>

        <div className="rounded-md p-24 bg-surface-paper border border-border-line mb-40 animate-pulse">
          <div className="h-16 w-96 bg-border-line rounded-sm mb-20" />
          <div className="h-96 bg-border-line rounded-sm" />
        </div>

        <div className="bg-surface-paper border border-border-line rounded-md">
          {[0, 1, 2].map((row) => (
            <div
              key={row}
              className="flex items-center justify-between gap-16 p-24 border-b border-border-line last:border-b-0 animate-pulse"
            >
              <div className="h-16 w-96 bg-border-line rounded-sm" />
              <div className="h-16 w-64 bg-border-line rounded-sm" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
