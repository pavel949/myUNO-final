'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export interface NavItem {
  href: string;
  label: string;
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

function isItemActive(pathname: string, href: string) {
  return href === '/app/admin'
    ? pathname === '/app/admin'
    : pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNavLinks({ sections }: { sections: NavSection[] }) {
  const pathname = usePathname() ?? '';
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    setPending(null);
  }, [pathname]);

  return (
    <nav className="flex flex-col gap-8" aria-label="Admin workspace">
      {sections.map((section, idx) => {
        const hasActiveItem = section.items.some((item) => isItemActive(pathname, item.href));
        const isPrimary = !section.title;

        const links = (
          <div className="flex flex-col gap-2">
            {section.items.map((item) => {
              const active = isItemActive(pathname, item.href);
              const highlighted = active || pending === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setPending(item.href)}
                  aria-current={active ? 'page' : undefined}
                  className={`flex min-h-40 items-center rounded-md px-12 py-8 text-small transition-colors duration-micro ${
                    highlighted
                      ? 'bg-brand-andaman text-on-dark-text font-semibold'
                      : 'text-on-dark-text/90 hover:bg-white/10 hover:text-on-dark-text'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        );

        if (isPrimary) {
          return (
            <div key={idx} className="border-b border-white/10 pb-8">
              {links}
            </div>
          );
        }

        return (
          <details
            key={section.title}
            open={hasActiveItem}
            className="group rounded-md border border-white/10 bg-white/[0.03]"
          >
            <summary className="flex min-h-40 cursor-pointer list-none items-center justify-between gap-8 rounded-md px-12 py-8 text-small font-semibold text-on-dark-text hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-sun [&::-webkit-details-marker]:hidden">
              <span>{section.title}</span>
              <span aria-hidden="true" className="text-on-dark-muted transition-transform group-open:rotate-90">›</span>
            </summary>
            <div className="border-t border-white/10 p-4">{links}</div>
          </details>
        );
      })}
    </nav>
  );
}
