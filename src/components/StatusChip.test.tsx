import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusChip } from './StatusChip';

describe('StatusChip', () => {
  it('never renders the raw status value, only the given label', () => {
    render(<StatusChip status="pending_payment" label="Pending payment" />);
    expect(screen.getByText('Pending payment')).toBeInTheDocument();
    expect(screen.queryByText('pending_payment')).not.toBeInTheDocument();
  });

  it('colors from the §3.4 mapping', () => {
    render(<StatusChip status="confirmed" label="Confirmed" />);
    expect(screen.getByText('Confirmed')).toHaveClass('bg-state-success-soft');
  });

  it('falls back to neutral for an unmapped status', () => {
    render(<StatusChip status="totally_unknown" label="Mystery" />);
    expect(screen.getByText('Mystery')).toHaveClass('bg-surface-paper');
  });

  it('honors an explicit variant override', () => {
    render(<StatusChip status="confirmed" label="Confirmed" variantOverride="error" />);
    expect(screen.getByText('Confirmed')).toHaveClass('bg-state-error-soft');
  });
});
