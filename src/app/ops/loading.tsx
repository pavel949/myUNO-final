import React from 'react';

/**
 * The ops board's loading state (doc 06 §3.2: skeleton compositions per
 * surface). Mirrors the page's own shape — a stack of section cards, each
 * with a couple of rows — rather than a generic spinner, per board 19's
 * state coverage matrix.
 */
export default function OpsBoardLoading() {
  return (
    <div className="min-h-screen bg-surface-background" aria-busy="true">
      <div className="max-w-6xl mx-auto px-24 py-40">
        <div className="mb-24 animate-pulse">
          <div className="h-32 w-96 bg-border-line rounded-sm mb-12" />
          <div className="h-16 w-64 bg-border-line rounded-sm" />
        </div>

        {[0, 1, 2].map((section) => (
          <div
            key={section}
            className="bg-surface-paper border border-border-line rounded-lg p-24 mb-24 animate-pulse"
          >
            <div className="h-16 w-96 bg-border-line rounded-sm mb-20" />
            {[0, 1].map((row) => (
              <div
                key={row}
                className="flex items-center justify-between gap-16 py-16 border-b border-border-line last:border-b-0"
              >
                <div className="h-16 w-96 bg-border-line rounded-sm" />
                <div className="h-40 w-96 bg-border-line rounded-md" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
