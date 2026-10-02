import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Navbar } from './Navbar';

vi.mock('next/navigation', () => ({
  usePathname: () => '/owner',
}));

vi.mock('./NotificationBell', () => ({
  NotificationBell: () => <div data-testid="bell" />,
}));

describe('Navbar', () => {
  it('marks the current role surface in andaman', () => {
    render(
      <Navbar
        user={{ firstName: 'Pavel', isAdmin: false, roles: ['owner'] }}
        labels={{
          stay: 'Stay',
          monthly: 'Monthly',
          buy: 'Buy',
          homes: 'Homes',
          sell: 'Sell',
          rentOut: 'Rent Out',
          manage: 'Manage',
          explore: 'Explore',
          areas: 'Areas',
          projects: 'Projects',
          services: 'Services',
          owners: 'Owners',
          about: 'About',
          trust: 'Trust',
          help: 'Help',
          global: 'Global',
          language: 'Language',
          login: 'Log in',
          register: 'Sign up',
          logout: 'Log out',
          myTrips: 'My trips',
          saved: 'Saved', addProperty: 'Add property',
          developers: 'Developers', buyers: 'Buyers', management: 'Management',
          messages: 'Messages',
          tickets: 'My requests',
          orders: 'My orders',
          account: 'Account',
          menu: 'Menu',
          more: 'More',
        }}
        roleLinks={[{ href: '/owner', label: 'Owner dashboard' }]}
        bellLabels={{ aria: 'Notifications', empty: 'Empty', markAll: 'Mark all' }}
        locale="en"
        localeOptions={{ en: 'EN', ru: 'RU', th: 'TH', zh: 'ZH' }}
      />
    );
    const owner = screen.getAllByRole('link', { name: 'Owner dashboard' })[0];
    expect(owner).toHaveClass('text-brand-andaman');
    expect(owner).toHaveClass('font-semibold');
    const trips = screen.getAllByRole('link', { name: 'My trips' })[0];
    expect(trips).not.toHaveClass('font-semibold');
    const menu = screen.getByRole('button', { name: 'Menu' });
    expect(menu.parentElement).toHaveClass('xl:hidden');
    fireEvent.click(menu);
    expect(menu).toHaveAttribute('aria-expanded', 'true');
    expect(document.getElementById('mobile-navigation')).toHaveClass('xl:hidden');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(menu).toHaveAttribute('aria-expanded', 'false');
    expect(menu).toHaveFocus();
  });
});
