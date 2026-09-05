'use client';

import { useState } from 'react';
import Link from 'next/link';

interface NavItem {
  href: string;
  label: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

/**
 * AdminSidebar — board 20's mobile rule for the admin shell: the sidebar
 * collapses behind a hamburger below `md` instead of always rendering
 * full-height above the page content, and each group becomes a disclosure
 * a person can close once they know they don't need it.
 */
export function AdminSidebar({
  title,
  menuLabel,
  dashboardItem,
  groups,
  backToSiteLabel,
}: {
  title: string;
  menuLabel: string;
  dashboardItem: NavItem;
  groups: NavGroup[];
  backToSiteLabel: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="md:hidden flex items-center justify-between bg-brand-deep text-on-dark-text p-16">
        <p className="text-subtitle font-bold">{title}</p>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="w-44 h-44 flex items-center justify-center shrink-0"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M4 7h16M4 12h16M4 17h16"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          <span className="sr-only">{menuLabel}</span>
        </button>
      </div>
      <aside
        className={`${open ? 'block' : 'hidden'} md:block md:w-56 shrink-0 bg-brand-deep text-on-dark-text p-16 md:min-h-screen overflow-y-auto`}
        style={{ minWidth: '220px' }}
      >
        <p className="hidden md:block text-subtitle font-bold mb-24">{title}</p>
        <nav className="flex flex-col gap-8">
          <Link
            href={dashboardItem.href}
            className="block px-12 py-8 rounded-md text-small hover:bg-brand-andaman transition-colors"
          >
            {dashboardItem.label}
          </Link>
          {groups.map((group) => (
            <details key={group.label} className="pt-16" open>
              <summary className="flex items-center justify-between gap-8 px-12 pb-8 text-small font-medium text-brand-sun-soft uppercase tracking-wide cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                {group.label}
                <span aria-hidden="true" className="text-on-dark-muted normal-case tracking-normal">
                  ▾
                </span>
              </summary>
              <div className="flex flex-col gap-8">
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="block px-12 py-8 rounded-md text-small hover:bg-brand-andaman transition-colors"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </details>
          ))}
        </nav>
        <p className="mt-24">
          <Link href="/" className="text-small text-on-dark-muted hover:underline">
            {backToSiteLabel}
          </Link>
        </p>
      </aside>
    </>
  );
}
