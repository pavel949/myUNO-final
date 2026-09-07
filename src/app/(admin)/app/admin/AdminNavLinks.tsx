'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export type AdminNavItem = { href: string; label: string };

/**
 * A named section of the admin sidebar (board 03). `label` is null for the
 * ungrouped lead item — the dashboard, which is the index rather than a
 * destination inside a section.
 */
export type AdminNavGroup = { label: string | null; items: AdminNavItem[] };

function isActive(pathname: string, href: string): boolean {
  // The dashboard is the section index, so it matches only exactly; every
  // other destination also owns its children (…/units matches …/units/[id]).
  return href === '/app/admin'
    ? pathname === '/app/admin'
    : pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNavLinks({ groups }: { groups: AdminNavGroup[] }) {
  const pathname = usePathname() ?? '';

  return (
    <nav className="flex md:flex-col gap-16 flex-wrap">
      {groups.map((group, i) => (
        <div key={group.label ?? `lead-${i}`} className="flex md:flex-col gap-8 flex-wrap">
          {group.label ? (
            <p className="text-kicker uppercase text-brand-sun md:mb-4 w-full">{group.label}</p>
          ) : null}
          {group.items.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`block px-12 py-8 rounded-md text-small transition-colors duration-micro ${
                  active ? 'bg-brand-andaman text-on-dark-text' : 'hover:bg-brand-andaman'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
