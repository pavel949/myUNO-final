'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface AdminNavItem {
  href: string;
  label: string;
}

export interface AdminNavGroup {
  label: string;
  items: AdminNavItem[];
}

/**
 * The admin sidebar, in named sections (board 03).
 *
 * Thirty-one destinations in one flat list is not a menu, it is an index: a
 * person scans it top to bottom every time because nothing tells them where to
 * start looking. The sections are the whole point — the links themselves are
 * unchanged, and every href the flat list carried is still here, which is what
 * `admin-nav-is-reachable.test.ts` checks.
 *
 * The dashboard sits above the sections rather than inside one. It is the way
 * back to the top, not a peer of the destinations.
 */
export function AdminNavLinks({
  dashboard,
  groups,
}: {
  dashboard: AdminNavItem;
  groups: AdminNavGroup[];
}) {
  const pathname = usePathname() ?? '';

  const isActive = (href: string) =>
    href === '/app/admin'
      ? pathname === '/app/admin'
      : pathname === href || pathname.startsWith(`${href}/`);

  const link = (item: AdminNavItem) => (
    <Link
      key={item.href}
      href={item.href}
      aria-current={isActive(item.href) ? 'page' : undefined}
      className={`block px-12 py-8 rounded-md text-small transition-colors duration-micro ${
        isActive(item.href) ? 'bg-brand-andaman text-on-dark-text' : 'hover:bg-brand-andaman'
      }`}
    >
      {item.label}
    </Link>
  );

  return (
    <nav className="flex md:flex-col gap-8 flex-wrap">
      {link(dashboard)}

      {groups.map((group) => (
        // A section is a group with an accessible name, so a screen reader
        // announces "Money & record" before its thirteen links rather than
        // reading them as one undifferentiated run.
        <section key={group.label} aria-label={group.label} className="md:mt-16 w-full">
          <p className="text-kicker uppercase text-on-dark-muted px-12 mb-4">{group.label}</p>
          <div className="flex md:flex-col gap-8 flex-wrap">{group.items.map(link)}</div>
        </section>
      ))}
    </nav>
  );
}
