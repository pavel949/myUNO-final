'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
}: {
  title: string;
  eyebrow?: string;
  items: StitchWorkspaceNavItem[];
  children: ReactNode;
}) {
  const pathname = usePathname();

  const nav = (
    <nav className="space-y-4" aria-label={title}>
      {items.map((item) => {
        const depth = item.href.split('/').filter(Boolean).length;
        const active =
          pathname === item.href ||
          (depth > 1 && pathname.startsWith(item.href + '/'));
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={
              active
                ? 'flex min-h-40 items-center rounded-md bg-white/10 px-12 py-8 text-small font-semibold text-white'
                : 'flex min-h-40 items-center rounded-md px-12 py-8 text-small font-semibold text-on-dark-muted transition hover:bg-white/5 hover:text-white'
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
      <aside className="sticky top-0 z-40 shrink-0 border-b border-white/10 bg-brand-deep text-on-dark-text shadow-float md:h-screen md:w-[248px] md:border-b-0 md:border-r">
        <div className="p-12 md:flex md:h-full md:flex-col md:p-16">
          {eyebrow ? (
            <p className="stitch-kicker text-brand-sun-soft">{eyebrow}</p>
          ) : null}
          <p className="mt-4 font-display text-subtitle font-bold">{title}</p>

          <details className="mt-12 md:hidden">
            <summary className="cursor-pointer rounded-md border border-white/15 px-12 py-10 text-small font-semibold">
              Workspace navigation
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
