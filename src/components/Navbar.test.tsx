import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
          findStay: 'Find a stay',
          residences: 'Residences',
          services: 'Services',
          owners: 'Owners',
          about: 'About',
          trust: 'Trust',
          language: 'Language',
          login: 'Log in',
          register: 'Sign up',
          logout: 'Log out',
          myTrips: 'My trips',
          messages: 'Messages',
          tickets: 'My requests',
          orders: 'My orders',
          account: 'Account',
          menu: 'Menu',
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
  });
});
