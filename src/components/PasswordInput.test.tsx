import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PasswordInput } from './PasswordInput';

describe('PasswordInput', () => {
  it('starts masked and reveals in place when the eye toggle is pressed', async () => {
    render(<PasswordInput label="Password" defaultValue="correct-horse" onChange={vi.fn()} />);
    const input = screen.getByLabelText('Password') as HTMLInputElement;
    expect(input.type).toBe('password');

    await userEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(input.type).toBe('text');

    await userEvent.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(input.type).toBe('password');
  });

  it('re-hides on its own after 15 seconds', () => {
    vi.useFakeTimers();
    try {
      render(<PasswordInput label="Password" defaultValue="correct-horse" onChange={vi.fn()} />);
      const input = screen.getByLabelText('Password') as HTMLInputElement;

      fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
      expect(input.type).toBe('text');

      act(() => {
        vi.advanceTimersByTime(15_000);
      });
      expect(input.type).toBe('password');
    } finally {
      vi.useRealTimers();
    }
  });
});
