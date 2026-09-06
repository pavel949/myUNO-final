import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmptyState, LoadingState, ErrorState, ForbiddenState, PartialState } from './StateComponents';

describe('EmptyState', () => {
  it('renders title, description and an action button', async () => {
    const onClick = vi.fn();
    render(
      <EmptyState
        title="No trips yet"
        description="Book your first stay to see it here."
        action={{ label: 'Search stays', onClick }}
      />
    );
    expect(screen.getByText('No trips yet')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Search stays' }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe('LoadingState', () => {
  it('shows the default message when none is given', () => {
    render(<LoadingState />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('prefers an explicit message over the labels default', () => {
    render(<LoadingState message="Fetching bookings…" labels={{ 'ui.state.loading_default': 'Loading...' }} />);
    expect(screen.getByText('Fetching bookings…')).toBeInTheDocument();
  });
});

describe('ErrorState', () => {
  it('calls onRetry from the retry button', async () => {
    const onRetry = vi.fn();
    render(<ErrorState title="Could not load" onRetry={onRetry} />);
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});

describe('ForbiddenState', () => {
  it('renders a navigational link rather than a button, so it works from a server component', () => {
    render(
      <ForbiddenState
        title="This stay has ended"
        description="Check your trips for what's current."
        action={{ label: 'Go to your trips', href: '/trips' }}
      />
    );
    expect(screen.getByText('This stay has ended')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Go to your trips' });
    expect(link).toHaveAttribute('href', '/trips');
  });

  it('renders without an action when none is given', () => {
    render(<ForbiddenState title="Not visible to you" />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});

describe('PartialState', () => {
  it('renders its message', () => {
    render(<PartialState message="No history yet — trends appear after the first nightly rollup." />);
    expect(
      screen.getByText('No history yet — trends appear after the first nightly rollup.')
    ).toBeInTheDocument();
  });
});
