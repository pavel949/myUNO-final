'use client';

import { useState, useRef, useEffect } from 'react';
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
  /**
   * The surfaces this person's roles give them, resolved server-side by
   * `core.availableSurfaces`.
   */
  roleLinks: { href: string; label: string }[];
  bellLabels: BellLabels;
  locale: string;
  localeOptions: { en: string; ru: string; th: string; zh: string };
}

export function Navbar({ user, labels, roleLinks, bellLabels, locale, localeOptions }: NavbarProps) {
  const pathname = usePathname() ?? '';
  const [menuOpen, setMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      setLoggingOut(false);
      setMenuOpen(false);
      setUserDropdownOpen(false);
      window.location.assign('/');
    }
  };

  const closeMenu = () => {
    setMenuOpen(false);
    setUserDropdownOpen(false);
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const guestJourneyLinks = [
    { href: '/trips', label: labels.myTrips },
    { href: '/saved', label: labels.saved || 'Saved' },
    { href: '/messages', label: labels.messages },
    { href: '/tickets', label: labels.tickets },
    { href: '/services/orders', label: labels.orders },
  ];

  const userLinks = [
    ...guestJourneyLinks,
    ...roleLinks,
    { href: '/account', label: labels.account },
  ];

  return (
    <header className="sticky top-0 z-40 bg-surface-paper border-b border-border-line">
      <nav className="max-w-6xl mx-auto flex items-center justify-between min-h-64 px-24 py-8">
        <div className="flex items-center gap-32">
          <Link
            href="/"
            className="font-display text-heading-3 font-bold text-brand-andaman flex-shrink-0"
            onClick={closeMenu}
          >
            myUNO
          </Link>
          <div className="hidden md:flex items-center gap-x-20">
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
        <div className="hidden md:flex items-center gap-x-16">
          <LocaleSwitcher locale={locale} ariaLabel={labels.language} optionLabels={localeOptions} />
          {user ? (
            <div className="relative flex items-center gap-12" ref={dropdownRef}>
              <NotificationBell labels={bellLabels} />

              <button
                type="button"
                onClick={() => setUserDropdownOpen((prev) => !prev)}
                className="flex items-center gap-8 px-12 py-6 rounded-md border border-border-line hover:border-brand-andaman bg-surface-paper transition-colors text-small text-text-ink font-medium"
                aria-expanded={userDropdownOpen}
                aria-label={user.firstName}
              >
                <div className="w-24 h-24 rounded-full bg-brand-andaman text-on-dark-text flex items-center justify-center text-caption font-bold uppercase">
                  {user.firstName.charAt(0)}
                </div>
                <span>{user.firstName}</span>
                <svg
                  className={`w-16 h-16 transition-transform duration-micro ${userDropdownOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {userDropdownOpen && (
                <div className="absolute right-0 top-full mt-8 w-240 bg-surface-paper rounded-md border border-border-line shadow-card p-8 flex flex-col gap-4 z-50">
                  {/* Journey links */}
                  <div className="flex flex-col gap-2 pb-8 border-b border-border-line">
                    {guestJourneyLinks.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={closeMenu}
                        className={`px-12 py-8 rounded-sm text-small transition-colors ${
                          pathname === link.href || pathname.startsWith(`${link.href}/`)
                            ? 'bg-brand-andaman/10 text-brand-andaman font-semibold'
                            : 'text-text-ink hover:bg-surface-sand/50'
                        }`}
                      >
                        {link.label}
                      </Link>
                    ))}
                  </div>

                  {/* Role Portals */}
                  {roleLinks.length > 0 && (
                    <div className="flex flex-col gap-2 py-8 border-b border-border-line">
                      {roleLinks.map((link) => (
                        <Link
                          key={link.href}
                          href={link.href}
                          onClick={closeMenu}
                          className={`px-12 py-8 rounded-sm text-small transition-colors ${
                            pathname === link.href || pathname.startsWith(`${link.href}/`)
                              ? 'bg-brand-andaman/10 text-brand-andaman font-semibold'
                              : 'text-text-ink hover:bg-surface-sand/50'
                          }`}
                        >
                          {link.label}
                        </Link>
                      ))}
                    </div>
                  )}

                  {/* Account & Logout */}
                  <div className="flex flex-col gap-2 pt-4">
                    <Link
                      href="/account"
                      onClick={closeMenu}
                      className={`px-12 py-8 rounded-sm text-small transition-colors ${
                        pathname === '/account'
                          ? 'bg-brand-andaman/10 text-brand-andaman font-semibold'
                          : 'text-text-ink hover:bg-surface-sand/50'
                      }`}
                    >
                      {labels.account}
                    </Link>
                    <button
                      type="button"
                      onClick={handleLogout}
                      disabled={loggingOut}
                      className="w-full text-left px-12 py-8 rounded-sm text-small text-state-error hover:bg-state-error/10 transition-colors"
                    >
                      {labels.logout}
                    </button>
                  </div>
                </div>
              )}
            </div>
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
        <div className="md:hidden flex items-center gap-12">
          {user && <NotificationBell labels={bellLabels} />}
          <button
            type="button"
            aria-label={labels.menu}
            aria-expanded={menuOpen}
            className="flex items-center justify-center w-44 h-44 text-text-ink"
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
        </div>
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
              <div className="border-t border-border-line pt-16 flex flex-col gap-8">
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
              </div>
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
