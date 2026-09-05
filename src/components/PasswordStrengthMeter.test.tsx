import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PasswordStrengthMeter, scorePasswordStrength } from './PasswordStrengthMeter';

describe('scorePasswordStrength', () => {
  it('scores an empty password 0', () => {
    expect(scorePasswordStrength('')).toBe(0);
  });

  it('scores a short simple password low', () => {
    expect(scorePasswordStrength('abc')).toBe(0);
  });

  it('scores a long password with mixed case and digits at the top', () => {
    expect(scorePasswordStrength('CorrectHorseBattery99')).toBe(4);
  });
});

describe('PasswordStrengthMeter', () => {
  it('renders four segments with an accessible strength label', () => {
    render(<PasswordStrengthMeter password="CorrectHorseBattery99" />);
    expect(screen.getByRole('img', { name: 'Password strength: 4 of 4' })).toBeInTheDocument();
  });
});
