import React from 'react';

/**
 * The admin content area's loading state.
 *
 * Without a Suspense boundary here, the App Router had nothing to paint while
 * the next admin page rendered on the server: the browser sat on the previous
 * page, giving no sign the click had registered. This boundary sits inside the
 * admin layout, so the sidebar stays put and only the content area swaps —
 * navigation reads as instant even when the page behind it is still assembling.
 *
 * Wordless by design (doc 06 §3.2), so it needs nothing from the content layer.
 */
export default function AdminLoading() {
  return (
    <div aria-busy="true">
      <div className="h-40 w-1/3 bg-border-line rounded-sm mb-24 animate-pulse" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-16 mb-32">
        {[0, 1, 2, 3].map((tile) => (
          <div
            key={tile}
            className="rounded-md p-24 bg-surface-paper border border-border-line animate-pulse"
          >
            <div className="h-12 w-2/3 bg-border-line rounded-sm mb-16" />
            <div className="h-24 w-1/2 bg-border-line rounded-sm" />
          </div>
        ))}
      </div>

      <div className="bg-surface-paper border border-border-line rounded-md">
        {[0, 1, 2, 3, 4, 5].map((row) => (
          <div
            key={row}
            className="flex items-center justify-between gap-16 p-24 border-b border-border-line last:border-b-0 animate-pulse"
          >
            <div className="h-16 w-1/3 bg-border-line rounded-sm" />
            <div className="h-16 w-1/5 bg-border-line rounded-sm" />
          </div>
        ))}
      </div>
    </div>
  );
}
