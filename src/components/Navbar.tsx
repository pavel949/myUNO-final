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
  roles: string[]; // distinct RoleType values, e.g. ['owner', 'guest']
}

export interface NavbarLabels {
  findStay: string;
  residences: string;
  services: string;
  owners: string;
  about: string;
  trust: string;
  language: string;
  login: string;
  register: string;
  logout: string;
  myTrips: string;
  saved: string;
  messages: string;
  tickets: string;
  orders: string;
  account: string;
  menu: string;
}

interface NavbarProps {
  user: NavbarUser | null;
  labels: NavbarLabels;
  /**
   * The surfaces this person's roles give them, resolved server-side by
   * `core.availableSurfaces` so the menu and the `/app` landing cannot drift
   * apart. They used to be derived here from a second, hand-maintained list of
   * role checks, which is how resident and juristic members ended up with no
   * way into their own portals.
   */
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

  const userLinks = user
    ? [
        // Everything anyone signed in has, whatever roles they hold: their
        // stays, their conversations, the requests they raised, the services
        // they ordered. Each of these was reachable only from wherever it
        // happened to be linked, which meant an order was findable only if you
        // still had the link.
        { href: '/trips', label: labels.myTrips },
        { href: '/saved', label: labels.saved },
        { href: '/messages', label: labels.messages },
        { href: '/tickets', label: labels.tickets },
        { href: '/services/orders', label: labels.orders },
        // Then the surfaces their roles give them (resolved server-side).
        ...roleLinks,
        // Last, and for everyone: an account is not a role, it is the person.
        { href: '/account', label: labels.account },
      ]
    : [];

  const workspaceLinks = userLinks.filter((link) => link.href !== '/account');

  return (
    <header className="sticky top-0 z-40 border-b border-border-line bg-surface-paper/95 backdrop-blur">
      <nav className="mx-auto flex h-64 max-w-7xl items-center gap-24 px-20 md:px-24">
        <Link
          href="/"
          className="shrink-0 font-display text-heading-3 font-bold tracking-[-0.02em] text-brand-andaman"
          onClick={closeMenu}
        >
          myUNO
        </Link>

        <div className="hidden min-w-0 flex-1 items-center gap-24 lg:flex">
          <Link href="/search" className={navLinkClass(pathname, '/search')}>{labels.findStay}</Link>
          <Link href="/projects" className={navLinkClass(pathname, '/projects')}>{labels.residences}</Link>
          <Link href="/services" className={navLinkClass(pathname, '/services')}>{labels.services}</Link>
          <Link href="/owners" className={navLinkClass(pathname, '/owners')}>{labels.owners}</Link>
          <Link href="/about" className={navLinkClass(pathname, '/about')}>{labels.about}</Link>
          <Link href="/trust" className={navLinkClass(pathname, '/trust')}>{labels.trust}</Link>
        </div>

        <div className="ml-auto hidden shrink-0 items-center gap-12 md:flex">
          <LocaleSwitcher locale={locale} ariaLabel={labels.language} optionLabels={localeOptions} />
          {user ? (
            <>
              <NotificationBell labels={bellLabels} />
              <Link
                href="/account"
                className={navLinkClass(pathname, '/account', 'rounded-full border border-border-line px-12 py-8')}
              >
                {user.firstName}
              </Link>
              <Button variant="ghost" size="sm" onClick={handleLogout} isLoading={loggingOut}>
                {labels.logout}
              </Button>
            </>
          ) : (
            <>
              <Link href="/login"><Button variant="ghost" size="sm">{labels.login}</Button></Link>
              <Link href="/register"><Button variant="primary" size="sm">{labels.register}</Button></Link>
            </>
          )}
        </div>

        <div className="ml-auto flex items-center gap-4 md:hidden">
          {user && <NotificationBell labels={bellLabels} />}
          <button
            type="button"
            aria-label={labels.menu}
            aria-expanded={menuOpen}
            className="flex h-44 w-44 items-center justify-center rounded-full text-text-ink transition-colors hover:bg-surface-ivory"
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

      {user && workspaceLinks.length > 0 && (
        <div className="hidden border-t border-border-line/70 bg-surface-ivory/65 md:block">
          <div className="mx-auto flex max-w-7xl items-center gap-20 overflow-x-auto px-24 py-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {workspaceLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={navLinkClass(pathname, link.href, 'text-small')}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      {menuOpen && (
        <div className="border-t border-border-line bg-surface-paper px-20 py-16 md:hidden">
          <div className="grid gap-2">
            {[
              ['/search', labels.findStay],
              ['/projects', labels.residences],
              ['/services', labels.services],
              ['/owners', labels.owners],
              ['/about', labels.about],
              ['/trust', labels.trust],
            ].map(([href, label]) => (
              <Link key={href} href={href} className={navLinkClass(pathname, href, 'rounded-lg px-12 py-10')} onClick={closeMenu}>
                {label}
              </Link>
            ))}
          </div>

          {user && (
            <div className="mt-12 border-t border-border-line pt-12">
              <div className="grid gap-2">
                {userLinks.map((link) => (
                  <Link key={link.href} href={link.href} className={navLinkClass(pathname, link.href, 'rounded-lg px-12 py-10')} onClick={closeMenu}>
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="mt-16 flex items-center gap-12 border-t border-border-line pt-16">
            <LocaleSwitcher locale={locale} ariaLabel={labels.language} optionLabels={localeOptions} />
            {user ? (
              <Button variant="ghost" size="sm" onClick={handleLogout} isLoading={loggingOut}>{labels.logout}</Button>
            ) : (
              <>
                <Link href="/login" onClick={closeMenu} className="flex-1"><Button variant="ghost" size="sm" fullWidth>{labels.login}</Button></Link>
                <Link href="/register" onClick={closeMenu} className="flex-1"><Button variant="primary" size="sm" fullWidth>{labels.register}</Button></Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
