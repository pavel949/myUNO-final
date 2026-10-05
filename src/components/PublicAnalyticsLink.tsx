'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { deviceClass, trackPublicInteraction, type PublicAnalyticsEvent } from '@/components/public-analytics';

export function PublicAnalyticsLink({
  href,
  eventKey,
  dimensions,
  className,
  children,
}: {
  href: string;
  eventKey: PublicAnalyticsEvent;
  dimensions: Record<string, string | number | boolean | null | undefined>;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => trackPublicInteraction(eventKey, {
        ...dimensions,
        deviceClass: deviceClass(),
      })}
    >
      {children}
    </Link>
  );
}
