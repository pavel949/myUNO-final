'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { pmsNavigationHref } from '@/lib/pms-navigation';
import type { ReactNode } from 'react';

export interface StitchWorkspaceNavItem {
  href: string;
  label: string;
}

export function StitchWorkspaceShell({
  title,
  eyebrow,
  items,
  children,
  preservePmsContext = false,
}: {
  title: string;
  eyebrow?: string;
  items: StitchWorkspaceNavItem[];
  children: ReactNode;
  preservePmsContext?: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const spaceId = searchParams.get('spaceId') || (pathname.startsWith('/ops/spaces/') ? decodeURIComponent(pathname.split('/')[3] || '') : '');

  const nav = (
    <nav className="space-y-4" aria-label={title}>
      {items.map((item) => {
        const itemPath = item.href.split('?')[0];
        const href = preservePmsContext ? pmsNavigationHref(item.href, { spaceId, projectId: searchParams.get('projectId') || '' }) : item.href;
        const depth = itemPath.split('/').filter(Boolean).length;
        const active =
          pathname === itemPath ||
          (depth > 1 && pathname.startsWith(itemPath + '/'));
        return (
          <Link
            key={item.href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={
              active
                ? 'flex min-h-44 items-center rounded-md border border-white/10 bg-console-hover px-12 py-8 text-small font-semibold text-white'
                : 'flex min-h-44 items-center rounded-md border border-transparent px-12 py-8 text-small font-medium text-on-dark-muted transition hover:bg-console-hover hover:text-white'
            }
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="pms-touch stitch-workspace flex min-h-screen flex-col md:flex-row">
      <aside className="sticky top-64 z-40 shrink-0 border-b border-console-border bg-console-deep text-on-dark-text shadow-float md:h-[calc(100dvh-64px)] md:w-[256px] md:border-b-0 md:border-r">
        <div className="p-12 md:flex md:h-full md:flex-col md:p-16">
          {eyebrow ? (
            <p className="stitch-kicker text-brand-sun-soft">{eyebrow}</p>
          ) : null}
          <p className="mt-4 font-sans text-subtitle font-semibold">{title}</p>

          <details className="mt-12 md:hidden">
            <summary className="cursor-pointer rounded-md border border-white/15 px-12 py-12 text-small font-semibold">
              {title}
            </summary>
            <div className="mt-8 max-h-[60vh] overflow-y-auto">{nav}</div>
          </details>

          <div className="mt-20 hidden min-h-0 flex-1 overflow-y-auto md:block">
            {nav}
          </div>
        </div>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function StitchConsumerShell({ children }: { children: ReactNode }) {
  return <div className="stitch-workspace stitch-consumer-scope">{children}</div>;
}
