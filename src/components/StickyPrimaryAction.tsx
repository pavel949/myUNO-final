'use client';

import { useEffect, useRef, useState } from 'react';

interface StickyPrimaryActionProps {
  children: React.ReactNode;
}

/**
 * StickyPrimaryAction — board 20's mobile rule: the page's one primary
 * action (book my own stay, sign off a statement) pins to a fixed bottom
 * bar once the page scrolls past it. Desktop is unaffected — the pinned
 * bar never renders at `lg` and above.
 */
export function StickyPrimaryAction({ children }: StickyPrimaryActionProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => setPinned(entry.boundingClientRect.top < 0),
      { threshold: 0 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div ref={sentinelRef}>{children}</div>
      {pinned && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border-line bg-surface-paper p-16 shadow-float [&_button]:w-full">
          {children}
        </div>
      )}
    </>
  );
}
