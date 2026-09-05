'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function AdminNavLinks({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname() ?? '';

  return (
    <nav className="flex md:flex-col gap-8 flex-wrap">
      {items.map((item) => {
        const active =
          item.href === '/app/admin'
            ? pathname === '/app/admin'
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`block px-12 py-8 rounded-md text-small transition-colors duration-micro ${
              active ? 'bg-brand-andaman text-on-dark-text' : 'hover:bg-brand-andaman'
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
