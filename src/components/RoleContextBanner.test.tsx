import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RoleContextBanner } from './RoleContextBanner';

describe('RoleContextBanner', () => {
  it('uses the info band from the Claude Design shell board', () => {
    render(
      <RoleContextBanner
        message="You are viewing as owner of B-707"
        action={{ label: 'Switch surface', href: '/app' }}
      />
    );
    const banner = screen.getByRole('status');
    expect(banner).toHaveClass('bg-state-info-soft');
    expect(banner).toHaveClass('text-state-info');
    expect(screen.getByRole('link', { name: 'Switch surface' })).toHaveAttribute(
      'href',
      '/app'
    );
  });
});
