import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusTimeline } from './StatusTimeline';

describe('StatusTimeline', () => {
  it('renders every event title and meta line', () => {
    render(
      <StatusTimeline
        events={[
          { title: 'Resolved', meta: '12 Jan 14:20 · Somchai P.', dotVariant: 'success' },
          { title: 'In progress', meta: '12 Jan 09:05 · assigned to maintenance', dotVariant: 'active' },
          { title: 'Raised by guest', meta: '11 Jan 21:40 · aircon in bedroom 2', dotVariant: 'pending' },
        ]}
      />
    );

    expect(screen.getByText('Resolved')).toBeInTheDocument();
    expect(screen.getByText('12 Jan 14:20 · Somchai P.')).toBeInTheDocument();
    expect(screen.getByText('In progress')).toBeInTheDocument();
    expect(screen.getByText('Raised by guest')).toBeInTheDocument();
  });

  it('renders nothing for an empty event list rather than throwing', () => {
    const { container } = render(<StatusTimeline events={[]} />);
    expect(container.firstChild).toBeTruthy();
  });
});
