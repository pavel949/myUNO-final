'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from './Button';
import { NotificationBell, type BellLabels } from './NotificationBell';

export interface NavbarUser {
  firstName: string;
  isAdmin: boolean;
  roles: string[]; // distinct RoleType values, e.g. ['owner', 'guest']
}

export interface NavbarLabels {
  findStay: string;
  services: string;
  trust: string;
  login: string;
  register: string;
  logout: string;
  myTrips: string;
  messages: string;
  ownerDashboard: string;
  providerPortal: string;
  mcPortal: string;
  opsBoard: string;
  admin: string;
  menu: string;
}

interface NavbarProps {
  user: NavbarUser | null;
  labels: NavbarLabels;
  bellLabels: BellLabels;
  locale: string;
}

export function Navbar({ user, labels, bellLabels, locale }: NavbarProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      setLoggingOut(false);
      setMenuOpen(false);
      router.push('/');
      router.refresh();
    }
  };

  const closeMenu = () => setMenuOpen(false);

  const userLinks = user
    ? [
        { href: '/trips', label: labels.myTrips },
        { href: '/messages', label: labels.messages },
        ...(user.roles.includes('owner')
          ? [{ href: '/owner', label: labels.ownerDashboard }]
          : []),
        ...(user.roles.includes('provider_member')
          ? [{ href: '/provider', label: labels.providerPortal }]
          : []),
        ...(user.roles.includes('mc_member')
          ? [{ href: '/mc', label: labels.mcPortal }]
          : []),
        ...(user.roles.includes('staff_ops') || user.isAdmin
          ? [{ href: '/ops', label: labels.opsBoard }]
          : []),
        ...(user.isAdmin ? [{ href: '/app/admin/signals', label: labels.admin }] : []),
      ]
    : [];

  return (
    <header className="sticky top-0 z-40 bg-surface-paper border-b border-border-line">
      <nav className="max-w-6xl mx-auto flex items-center justify-between h-64 px-24">
        <div className="flex items-center gap-40">
          <Link
            href="/"
            className="text-heading-3 font-bold text-brand-andaman"
            onClick={closeMenu}
          >
            myUNO
          </Link>
          <div className="hidden md:flex items-center gap-24">
            <Link
              href="/search"
              className="text-body text-text-ink hover:text-brand-andaman transition-colors"
            >
              {labels.findStay}
            </Link>
            <Link
              href="/services"
              className="text-body text-text-ink hover:text-brand-andaman transition-colors"
            >
              {labels.services}
            </Link>
            <Link
              href="/trust"
              className="text-body text-text-ink hover:text-brand-andaman transition-colors"
            >
              {labels.trust}
            </Link>
          </div>
        </div>

        {/* Desktop auth area */}
        <div className="hidden md:flex items-center gap-16">
          <select
            aria-label="Language"
            value={locale}
            onChange={(e) => {
              document.cookie = `locale=${e.target.value}; path=/; max-age=31536000; samesite=lax`;
              router.refresh();
            }}
            className="h-40 px-8 rounded-sm bg-surface-paper border border-border-line text-small text-text-ink"
          >
            <option value="en">EN</option>
            <option value="ru">RU</option>
            <option value="th">TH</option>
          </select>
          {user ? (
            <>
              {userLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-body text-text-ink hover:text-brand-andaman transition-colors"
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
          <Link href="/search" className="text-body text-text-ink py-8" onClick={closeMenu}>
            {labels.findStay}
          </Link>
          <Link href="/services" className="text-body text-text-ink py-8" onClick={closeMenu}>
            {labels.services}
          </Link>
          <Link href="/trust" className="text-body text-text-ink py-8" onClick={closeMenu}>
            {labels.trust}
          </Link>
          {user ? (
            <>
              {userLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-body text-text-ink py-8"
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
