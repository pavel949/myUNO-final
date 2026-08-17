import React from 'react';

/**
 * The statement's loading state (doc 06 §3.2: skeleton compositions per
 * surface). Wordless by design — it mirrors the page's own shape rather than
 * announcing itself, so nothing here needs the content layer.
 */
export default function OwnerStatementLoading() {
  return (
    <div className="min-h-screen bg-surface-background" aria-busy="true">
      <div className="max-w-6xl mx-auto px-24 py-40">
        <div className="mb-40 animate-pulse">
          <div className="h-16 w-96 bg-border-line rounded-sm mb-16" />
          <div className="h-40 w-64 md:w-96 bg-border-line rounded-sm mb-12" />
          <div className="h-16 w-56 bg-border-line rounded-sm" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-20 mb-40">
          {[0, 1, 2, 3].map((tile) => (
            <div
              key={tile}
              className="rounded-md p-24 bg-surface-paper border border-border-line animate-pulse"
            >
              <div className="h-12 w-64 bg-border-line rounded-sm mb-16" />
              <div className="h-24 w-96 bg-border-line rounded-sm" />
            </div>
          ))}
        </div>

        <div className="bg-surface-paper border border-border-line rounded-md">
          {[0, 1, 2, 3, 4].map((row) => (
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
