'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Client-side page-view beacon — calls POST /api/track so analytics events
 * can be recorded from the browser without server rendering context.
 */
export function AnalyticsBeacon() {
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || pathname === lastPath.current) return;
    lastPath.current = pathname;

    void fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventKey: 'page_viewed',
        dimensions: { path: pathname },
      }),
    }).catch(() => {
      // Analytics must never break navigation.
    });
  }, [pathname]);

  return null;
}
