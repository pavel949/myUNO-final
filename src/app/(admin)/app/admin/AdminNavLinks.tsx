'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export interface AdminNavItem {
  href: string;
  label: string;
}

export interface AdminNavGroup {
  heading: string;
  items: AdminNavItem[];
}

function isActive(href: string, pathname: string): boolean {
  return href === '/app/admin'
    ? pathname === '/app/admin'
    : pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNavLinks({ groups }: { groups: AdminNavGroup[] }) {
  const pathname = usePathname() ?? '';

  // The href the visitor just clicked, highlighted straight away. Server
  // navigation can take a moment; without this the sidebar gave no sign the
  // click had landed, which is what made the app feel unresponsive. Cleared
  // once the route actually changes.
  const [pending, setPending] = useState<string | null>(null);
  useEffect(() => {
    setPending(null);
  }, [pathname]);

  return (
    <nav className="flex md:flex-col gap-24 flex-wrap">
      {groups.map((group) => (
        <div key={group.heading}>
          <p className="text-caption uppercase tracking-wide text-on-dark-muted px-12 mb-8">
            {group.heading}
          </p>
          <div className="flex md:flex-col gap-4 flex-wrap">
            {group.items.map((item) => {
              const active = isActive(item.href, pathname);
              const highlighted = active || pending === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setPending(item.href)}
                  aria-current={active ? 'page' : undefined}
                  className={`block px-12 py-8 rounded-md text-small transition-colors duration-micro ${
                    highlighted ? 'bg-brand-andaman text-on-dark-text' : 'hover:bg-brand-andaman'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
