'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface MobileTabBarLabels {
  residences: string;
  explore: string;
  saved: string;
  concierge: string;
  profile: string;
}

const ICONS: Record<string, string> = {
  residences: 'M4 20V9l8-5 8 5v11M9 20v-6h6v6',
  explore: 'M12 3a9 9 0 100 18 9 9 0 000-18zm3.5 5.5l-2 5-5 2 2-5 5-2z',
  saved: 'M7 4h10v16l-5-3-5 3V4z',
  concierge: 'M3 17h18M5 17a7 7 0 0114 0M12 7V5',
  profile: 'M12 12a4 4 0 100-8 4 4 0 000 8zm-7 8a7 7 0 0114 0',
};

/**
 * Stitch mobile pattern: five-tab bottom bar on small screens only. Links go to
 * existing routes; labels reuse nav content keys.
 */
export function MobileTabBar({
  labels,
  profileHref,
}: {
  labels: MobileTabBarLabels;
  profileHref: string;
}) {
  const pathname = usePathname() ?? '/';
  const tabs = [
    { id: 'residences', href: '/projects', label: labels.residences },
    { id: 'explore', href: '/search', label: labels.explore },
    { id: 'saved', href: '/saved', label: labels.saved },
    { id: 'concierge', href: '/services', label: labels.concierge },
    { id: 'profile', href: profileHref, label: labels.profile },
  ];
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border-line bg-surface-ivory/90 backdrop-blur-xl md:hidden"
    >
      <ul className="mx-auto flex max-w-content items-stretch justify-between px-8">
        {tabs.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <li key={tab.id} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-56 flex-col items-center justify-center gap-4 text-small ${
                  active ? 'font-semibold text-brand-andaman' : 'text-text-secondary'
                }`}
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-24 w-24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d={ICONS[tab.id]} />
                </svg>
                <span>{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
