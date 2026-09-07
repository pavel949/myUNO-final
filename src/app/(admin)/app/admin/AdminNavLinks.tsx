'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface NavItem {
  href: string;
  label: string;
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

export function AdminNavLinks({ sections }: { sections: NavSection[] }) {
  const pathname = usePathname() ?? '';

  return (
    <nav className="flex flex-col gap-16">
      {sections.map((section, idx) => (
        <div key={section.title || idx} className="flex flex-col gap-4">
          {section.title && (
            <p className="text-kicker uppercase font-semibold text-brand-sun tracking-wider mb-4 px-12">
              {section.title}
            </p>
          )}
          <div className="flex md:flex-col gap-4 flex-wrap">
            {section.items.map((item) => {
              const active =
                item.href === '/app/admin'
                  ? pathname === '/app/admin'
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block px-12 py-6 rounded-md text-small transition-colors duration-micro ${
                    active ? 'bg-brand-andaman text-on-dark-text font-semibold' : 'text-on-dark-text hover:bg-brand-andaman/60'
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
