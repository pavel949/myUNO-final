'use client';

import NextLink from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { forwardRef, useEffect, useState, type ComponentProps } from 'react';
import { createPortal } from 'react-dom';

/** Keep Next routing intact while acknowledging a navigation before the server replies. */
const FeedbackLink = forwardRef<HTMLAnchorElement, ComponentProps<typeof NextLink>>(function FeedbackLink(
  { children, onClick, ...props }, ref,
) {
  const [pending, setPending] = useState(false);
  const pathname = usePathname();
  const query = useSearchParams()?.toString();
  useEffect(() => { setPending(false); }, [pathname, query]);

  return <>
    <NextLink {...props} ref={ref} aria-busy={pending || props['aria-busy']}
      onClick={event => {
        onClick?.(event);
        // Hash jumps, downloads, new tabs and cancelled/custom actions must keep
        // their native behavior and must not leave a false loading indication.
        const anchor = event.currentTarget;
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ||
          anchor.hasAttribute('download') || (anchor.target && anchor.target !== '_self')) return;
        const destination = new URL(anchor.href);
        if (destination.origin !== window.location.origin ||
          (destination.pathname === window.location.pathname && destination.search === window.location.search)) return;
        setPending(true);
      }}>
      {children}
    </NextLink>
    {pending && createPortal(
      <div aria-hidden="true" data-navigation-feedback="pending"
        className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-4 bg-brand-andaman/20">
        <div className="h-full w-2/3 bg-brand-andaman motion-safe:animate-pulse" />
      </div>, document.body,
    )}
  </>;
});

export default FeedbackLink;
