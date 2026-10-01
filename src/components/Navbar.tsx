'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from './Button';
import { LocaleSwitcher } from './LocaleSwitcher';
import { NotificationBell, type BellLabels } from './NotificationBell';

function navLinkClass(pathname: string, href: string, extra = '') {
  const active =
    href === '/'
      ? pathname === '/'
      : pathname === href || pathname.startsWith(`${href}/`);
  return `${extra} whitespace-nowrap text-body transition-colors duration-micro ${
    active ? 'text-brand-andaman font-semibold' : 'text-text-ink hover:text-brand-andaman'
  }`;
}

export interface NavbarUser {
  firstName: string;
  isAdmin: boolean;
  roles: string[];
}

export interface NavbarLabels {
  stay: string;
  monthly: string;
  buy: string;
  sell: string;
  areas: string;
  projects: string;
  services: string;
  owners: string;
  about: string;
  trust: string;
  help: string;
  global: string;
  language: string;
  login: string;
  register: string;
  logout: string;
  myTrips: string;
  saved?: string;
  messages: string;
  tickets: string;
  orders: string;
  account: string;
  menu: string;
}

interface NavbarProps {
  user: NavbarUser | null;
  labels: NavbarLabels;
  roleLinks: { href: string; label: string }[];
  bellLabels: BellLabels;
  locale: string;
  localeOptions: { en: string; ru: string; th: string; zh: string };
}

export function Navbar({ user, labels, roleLinks, bellLabels, locale, localeOptions }: NavbarProps) {
  const pathname = usePathname() ?? '';
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      setLoggingOut(false);
      setMenuOpen(false);
      window.location.assign('/');
    }
  };

  const closeMenu = () => setMenuOpen(false);

  const publicLinks: ReadonlyArray<{ href: string; label: string; activeBase?: string }> = [
    { href: '/search', label: labels.stay },
    { href: '/homes?intent=rent', label: labels.monthly, activeBase: '/homes' },
    { href: '/homes?intent=buy', label: labels.buy, activeBase: '/homes' },
    { href: '/sell', label: labels.sell },
    { href: '/projects', label: labels.projects },
    { href: '/services', label: labels.services },
  ];

  const userLinks = user
    ? [
        { href: '/trips', label: labels.myTrips },
        { href: '/saved', label: labels.saved || 'Saved' },
        { href: '/property/onboard', label: 'Add a property' },
        { href: '/messages', label: labels.messages },
        { href: '/tickets', label: labels.tickets },
        { href: '/services/orders', label: labels.orders },
        ...roleLinks,
        { href: '/account', label: labels.account },
      ]
    : [];

  return (
    <header className="sticky top-0 z-40 border-b border-border-line bg-surface-paper/95 backdrop-blur">
      <nav className="mx-auto flex min-h-64 max-w-7xl items-center justify-between gap-16 px-20 py-8 md:px-32">
        <div className="flex min-w-0 items-center gap-32 xl:gap-40">
          <Link
            href="/"
            className="shrink-0 font-display text-heading-3 font-bold tracking-[-0.02em] text-brand-andaman"
            onClick={closeMenu}
          >
            myUNO
          </Link>

          <div className="hidden items-center gap-x-20 xl:flex">
            {publicLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={navLinkClass(pathname, link.activeBase || link.href)}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="hidden items-center justify-end gap-x-12 lg:flex">
          <Link href="/owners" className={navLinkClass(pathname, '/owners')}>
            {labels.owners}
          </Link>

          <details className="relative">
            <summary className="cursor-pointer list-none rounded-lg px-8 py-8 text-body text-text-ink hover:text-brand-andaman">
              {labels.about}
            </summary>
            <div className="absolute right-0 top-full z-50 mt-12 flex min-w-[220px] flex-col gap-12 rounded-xl border border-border-line bg-surface-paper p-20 shadow-float">
              <Link href="/about" className={navLinkClass(pathname, '/about')}>{labels.about}</Link>
              <Link href="/trust" className={navLinkClass(pathname, '/trust')}>{labels.trust}</Link>
              <Link href="/help" className={navLinkClass(pathname, '/help')}>{labels.help}</Link>
              <Link href="/desks" className={navLinkClass(pathname, '/desks')}>{labels.global}</Link>
              <Link href="/areas" className={navLinkClass(pathname, '/areas')}>{labels.areas}</Link>
              <Link href="/developers" className={navLinkClass(pathname, '/developers')}>Developers</Link>
              <Link href="/buyers" className={navLinkClass(pathname, '/buyers')}>Buyers</Link>
              <Link href="/management-companies" className={navLinkClass(pathname, '/management-companies')}>Management</Link>
            </div>
          </details>

          <LocaleSwitcher locale={locale} ariaLabel={labels.language} optionLabels={localeOptions} />

          {user ? (
            <>
              <details className="relative">
                <summary className="cursor-pointer list-none rounded-full border border-border-line px-16 py-10 text-small font-semibold text-brand-andaman hover:border-border-line-2">
                  {user.firstName} · My UNO
                </summary>
                <div className="absolute right-0 top-full z-50 mt-12 flex max-h-[70vh] min-w-[250px] flex-col gap-10 overflow-y-auto rounded-xl border border-border-line bg-surface-paper p-20 shadow-float">
                  {userLinks.map((link) => (
                    <Link key={link.href} href={link.href} className={navLinkClass(pathname, link.href)}>
                      {link.label}
                    </Link>
                  ))}
                </div>
              </details>
              <NotificationBell labels={bellLabels} />
              <Button variant="ghost" size="sm" onClick={handleLogout} isLoading={loggingOut}>
                {labels.logout}
              </Button>
            </>
          ) : (
            <Link href="/login">
              <Button variant="ghost" size="sm">
                {labels.login}
              </Button>
            </Link>
          )}
        </div>

        <div className="flex items-center gap-4 lg:hidden">
          {user ? <NotificationBell labels={bellLabels} /> : null}
          <button
            type="button"
            aria-label={labels.menu}
            aria-expanded={menuOpen}
            className="flex h-44 w-44 items-center justify-center text-text-ink"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              {menuOpen ? (
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>
      </nav>

      {menuOpen ? (
        <div className="max-h-[calc(100vh-64px)] overflow-y-auto border-t border-border-line bg-surface-paper px-20 py-20 lg:hidden">
          <p className="mb-12 text-kicker uppercase tracking-[0.18em] text-text-secondary">Explore</p>
          <div className="flex flex-col">
            {publicLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={navLinkClass(pathname, link.activeBase || link.href, 'border-b border-border-line py-14')}
                onClick={closeMenu}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <p className="mb-12 mt-24 text-kicker uppercase tracking-[0.18em] text-text-secondary">Property</p>
          <div className="flex flex-col">
            <Link href="/owners" className={navLinkClass(pathname, '/owners', 'border-b border-border-line py-14')} onClick={closeMenu}>
              {labels.owners}
            </Link>
            <Link href="/areas" className={navLinkClass(pathname, '/areas', 'border-b border-border-line py-14')} onClick={closeMenu}>
              {labels.areas}
            </Link>
            <Link href="/developers" className={navLinkClass(pathname, '/developers', 'border-b border-border-line py-14')} onClick={closeMenu}>
              Developers
            </Link>
            <Link href="/management-companies" className={navLinkClass(pathname, '/management-companies', 'border-b border-border-line py-14')} onClick={closeMenu}>
              Management
            </Link>
          </div>

          <p className="mb-12 mt-24 text-kicker uppercase tracking-[0.18em] text-text-secondary">myUNO</p>
          <div className="flex flex-col">
            <Link href="/about" className={navLinkClass(pathname, '/about', 'border-b border-border-line py-14')} onClick={closeMenu}>
              {labels.about}
            </Link>
            <Link href="/trust" className={navLinkClass(pathname, '/trust', 'border-b border-border-line py-14')} onClick={closeMenu}>
              {labels.trust}
            </Link>
            <Link href="/help" className={navLinkClass(pathname, '/help', 'border-b border-border-line py-14')} onClick={closeMenu}>
              {labels.help}
            </Link>
            <Link href="/desks" className={navLinkClass(pathname, '/desks', 'border-b border-border-line py-14')} onClick={closeMenu}>
              {labels.global}
            </Link>
          </div>

          {user ? (
            <>
              <p className="mb-12 mt-24 text-kicker uppercase tracking-[0.18em] text-text-secondary">My UNO</p>
              <div className="flex flex-col">
                {userLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={navLinkClass(pathname, link.href, 'border-b border-border-line py-14')}
                    onClick={closeMenu}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
              <Button className="mt-20" variant="secondary" size="md" fullWidth onClick={handleLogout} isLoading={loggingOut}>
                {labels.logout}
              </Button>
            </>
          ) : (
            <div className="mt-24 grid grid-cols-2 gap-12">
              <Link href="/login" onClick={closeMenu}>
                <Button variant="secondary" size="md" fullWidth>{labels.login}</Button>
              </Link>
              <Link href="/register" onClick={closeMenu}>
                <Button variant="primary" size="md" fullWidth>{labels.register}</Button>
              </Link>
            </div>
          )}

          <div className="mt-24">
            <LocaleSwitcher locale={locale} ariaLabel={labels.language} optionLabels={localeOptions} />
          </div>
        </div>
      ) : null}
    </header>
  );
}
