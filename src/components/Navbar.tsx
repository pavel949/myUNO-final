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
  return `${extra} text-body transition-colors duration-micro ${
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
        { href: '/messages', label: labels.messages },
        { href: '/tickets', label: labels.tickets },
        { href: '/services/orders', label: labels.orders },
        // Then the surfaces their roles give them (resolved server-side).
        ...roleLinks,
        // Last, and for everyone: an account is not a role, it is the person.
        { href: '/account', label: labels.account },
      ]
    : [];

  return (
    <header className="sticky top-0 z-40 bg-surface-paper border-b border-border-line">
      <nav className="max-w-6xl mx-auto flex items-center justify-between h-64 px-24">
        <div className="flex items-center gap-40">
          <Link
            href="/"
            className="font-display text-heading-3 font-bold text-brand-andaman"
            onClick={closeMenu}
          >
            myUNO
          </Link>
          <div className="hidden md:flex items-center gap-24">
            <Link href="/search" className={navLinkClass(pathname, '/search')}>
              {labels.findStay}
            </Link>
            <Link href="/projects" className={navLinkClass(pathname, '/projects')}>
              {labels.residences}
            </Link>
            <Link href="/services" className={navLinkClass(pathname, '/services')}>
              {labels.services}
            </Link>
            <Link href="/owners" className={navLinkClass(pathname, '/owners')}>
              {labels.owners}
            </Link>
            <Link href="/about" className={navLinkClass(pathname, '/about')}>
              {labels.about}
            </Link>
            <Link href="/trust" className={navLinkClass(pathname, '/trust')}>
              {labels.trust}
            </Link>
          </div>
        </div>

        {/* Desktop auth area */}
        <div className="hidden md:flex items-center gap-16">
          <LocaleSwitcher locale={locale} ariaLabel={labels.language} optionLabels={localeOptions} />
          {user ? (
            <>
              {userLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={navLinkClass(pathname, link.href)}
                >
                  {link.label}
                </Link>
              ))}
              <NotificationBell labels={bellLabels} />
              <span className="text-small text-text-secondary">{user.firstName}</span>
              <Button variant="ghost" size="sm" onClick={handleLogout} isLoading={loggingOut}>
                {labels.logout}
              </Button>
            </>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" size="sm">
                  {labels.login}
                </Button>
              </Link>
              <Link href="/register">
                <Button variant="primary" size="sm">
                  {labels.register}
                </Button>
              </Link>
            </>
          )}
        </div>

        {/* Mobile bell + hamburger */}
        <div className="md:hidden flex items-center">
          {user && <NotificationBell labels={bellLabels} />}
        </div>
        <button
          type="button"
          aria-label={labels.menu}
          aria-expanded={menuOpen}
          className="md:hidden flex items-center justify-center w-44 h-44 text-text-ink"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            {menuOpen ? (
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            ) : (
              <path
                d="M4 7h16M4 12h16M4 17h16"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            )}
          </svg>
        </button>
      </nav>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-border-line bg-surface-paper px-24 py-16 flex flex-col gap-16">
          <Link href="/search" className={navLinkClass(pathname, '/search', 'py-8')} onClick={closeMenu}>
            {labels.findStay}
          </Link>
          <Link href="/projects" className={navLinkClass(pathname, '/projects', 'py-8')} onClick={closeMenu}>
            {labels.residences}
          </Link>
          <Link href="/services" className={navLinkClass(pathname, '/services', 'py-8')} onClick={closeMenu}>
            {labels.services}
          </Link>
          <Link href="/owners" className={navLinkClass(pathname, '/owners', 'py-8')} onClick={closeMenu}>
            {labels.owners}
          </Link>
          <Link href="/about" className={navLinkClass(pathname, '/about', 'py-8')} onClick={closeMenu}>
            {labels.about}
          </Link>
          <Link href="/trust" className={navLinkClass(pathname, '/trust', 'py-8')} onClick={closeMenu}>
            {labels.trust}
          </Link>
          {user ? (
            <>
              {userLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={navLinkClass(pathname, link.href, 'py-8')}
                  onClick={closeMenu}
                >
                  {link.label}
                </Link>
              ))}
              <Button variant="ghost" size="sm" onClick={handleLogout} isLoading={loggingOut}>
                {labels.logout}
              </Button>
            </>
          ) : (
            <div className="flex gap-16">
              <Link href="/login" onClick={closeMenu} className="flex-1">
                <Button variant="ghost" size="sm" fullWidth>
                  {labels.login}
                </Button>
              </Link>
              <Link href="/register" onClick={closeMenu} className="flex-1">
                <Button variant="primary" size="sm" fullWidth>
                  {labels.register}
                </Button>
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
