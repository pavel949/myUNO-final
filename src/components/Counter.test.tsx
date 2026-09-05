import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Counter } from './Counter';

describe('Counter', () => {
  it('renders the current value', () => {
    render(<Counter value={2} onChange={vi.fn()} />);
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('calls onChange with value + 1 on increment', async () => {
    const onChange = vi.fn();
    render(<Counter value={2} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Increase' }));
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it('calls onChange with value - 1 on decrement', async () => {
    const onChange = vi.fn();
    render(<Counter value={2} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Decrease' }));
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it('disables decrement at min and does not call onChange', async () => {
    const onChange = vi.fn();
    render(<Counter value={0} min={0} onChange={onChange} />);
    const decrement = screen.getByRole('button', { name: 'Decrease' });
    expect(decrement).toBeDisabled();
    await userEvent.click(decrement);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('disables increment at max', () => {
    render(<Counter value={4} max={4} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Increase' })).toBeDisabled();
  });
});
