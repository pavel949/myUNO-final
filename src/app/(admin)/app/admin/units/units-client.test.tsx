// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import UnitsAdminClient from './units-client';

// Board 19's state coverage matrix names this as a genuine gap: the list
// rendered nothing at all — no message — when there were zero units.
describe('UnitsAdminClient — empty state (board 19)', () => {
  it('shows an empty message instead of a bare wrapper when there are no units', () => {
    render(
      <UnitsAdminClient
        units={[]}
        labels={{ 'admin.units.empty': 'No units yet. Add one to get started.' }}
      />
    );
    expect(screen.getByText('No units yet. Add one to get started.')).toBeInTheDocument();
  });
});
